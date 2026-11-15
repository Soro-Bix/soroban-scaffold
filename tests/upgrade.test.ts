import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { upgrade } from '../src/commands/upgrade.js';
import { extractTarGz } from '../src/utils/tar.js';
import {
  diffTemplateTrees,
  type FetchLike,
} from '../src/utils/upgrade.js';

function writeOctal(buf: Buffer, offset: number, length: number, value: number): void {
  const octal = value.toString(8).padStart(length - 1, '0');
  buf.write(octal, offset, length - 1, 'ascii');
  buf[offset + length - 1] = 0;
}

function createTarHeader(entryPath: string, size: number, typeFlag: string = '0'): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(entryPath, 0, Math.min(Buffer.byteLength(entryPath), 100), 'utf-8');
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  // Checksum field is treated as spaces when computing the header checksum.
  header.fill(0x20, 148, 156);
  header[156] = typeFlag.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += header[i];
  }
  const checksum = sum.toString(8).padStart(6, '0');
  header.write(checksum, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

/**
 * Builds an in-memory `.tar.gz` archive matching GitHub's `<repo>-<sha>/...`
 * release/tarball layout so unit tests exercise real gzip + tar extraction.
 */
function buildMockTemplatesTarGz(
  files: Record<string, string>,
  rootPrefix: string = 'Soro-Bix-soroban-scaffold-templates-abc1234'
): Buffer {
  const chunks: Buffer[] = [];

  for (const [relPath, content] of Object.entries(files)) {
    const fullEntryPath = rootPrefix ? `${rootPrefix}/${relPath}` : relPath;
    const payload = Buffer.from(content, 'utf-8');

    // Use a PAX extended header whenever a path exceeds USTAR's 100-byte name field.
    if (Buffer.byteLength(fullEntryPath) > 100) {
      const recordBody = `path=${fullEntryPath}\n`;
      // Compute exact total byte length including digits + space.
      let totalLen = Buffer.byteLength(recordBody) + 3;
      const candidate = `${totalLen} ${recordBody}`;
      totalLen = Buffer.byteLength(candidate);
      const paxPayload = Buffer.from(`${totalLen} ${recordBody}`, 'utf-8');
      chunks.push(createTarHeader('PaxHeader/entry', paxPayload.length, 'x'));
      chunks.push(paxPayload);
      const paxPad = (512 - (paxPayload.length % 512)) % 512;
      if (paxPad > 0) chunks.push(Buffer.alloc(paxPad, 0));
      chunks.push(createTarHeader('truncated-entry-name', payload.length, '0'));
    } else {
      chunks.push(createTarHeader(fullEntryPath, payload.length, '0'));
    }

    chunks.push(payload);
    const pad = (512 - (payload.length % 512)) % 512;
    if (pad > 0) {
      chunks.push(Buffer.alloc(pad, 0));
    }
  }

  // Two zero blocks mark end-of-archive.
  chunks.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(chunks));
}

function mockFetchForRelease(options: {
  tag?: string;
  archive?: Buffer;
  noReleases?: boolean;
  commitSha?: string;
  apiStatus?: number;
  networkError?: Error;
}): FetchLike {
  return jest.fn(async (url: string) => {
    if (options.networkError) {
      throw options.networkError;
    }

    if (options.apiStatus && options.apiStatus >= 400) {
      return {
        ok: false,
        status: options.apiStatus,
        statusText: options.apiStatus === 403 ? 'Forbidden' : 'Internal Server Error',
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }

    if (url.endsWith('/releases/latest')) {
      if (options.noReleases) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          tag_name: options.tag ?? 'v0.2.0',
          tarball_url: 'https://api.github.com/repos/Soro-Bix/soroban-scaffold-templates/tarball/v0.2.0',
        }),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }

    if (url.endsWith('/commits/main')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ sha: options.commitSha ?? '9f8e7d6c5b4a3210' }),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }

    const buf = options.archive ?? Buffer.alloc(0);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    };
  });
}

describe('upgrade command & utilities', () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof jest.spyOn>;
  let errorSpy: ReturnType<typeof jest.spyOn>;
  let originalStdinTTY: boolean | undefined;
  let originalStdoutTTY: boolean | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-upgrade-test-'));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    originalStdinTTY = process.stdin.isTTY;
    originalStdoutTTY = process.stdout.isTTY;
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.stdin.isTTY = originalStdinTTY as boolean;
    process.stdout.isTTY = originalStdoutTTY as boolean;
    await fs.remove(tmpDir);
  });

  function loggedOutput(): string {
    return logSpy.mock.calls.map((c) => String(c[0])).join('\n');
  }

  function errorOutput(): string {
    return errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
  }

  it('shows a diff summary before confirming and installs updated templates on confirmation', async () => {
    await fs.outputFile(
      path.join(tmpDir, 'basic', 'src', 'lib.rs.template'),
      'pub struct OldBasic;\n'
    );
    await fs.outputFile(
      path.join(tmpDir, 'basic', 'obsolete.template'),
      'remove me\n'
    );

    const archive = buildMockTemplatesTarGz({
      'templates/basic/src/lib.rs.template': 'pub struct NewBasic;\npub fn version() -> u32 { 2 }\n',
      'templates/token/src/lib.rs.template': 'pub struct BrandNewToken;\n',
    });

    let diffShownBeforeConfirm = false;
    const confirmFn = jest.fn(async () => {
      const textSoFar = loggedOutput();
      diffShownBeforeConfirm =
        textSoFar.includes('Template changes (v0.2.0)') &&
        textSoFar.includes('basic/src/lib.rs.template') &&
        textSoFar.includes('basic/obsolete.template') &&
        textSoFar.includes('token/src/lib.rs.template');
      // Local file must NOT be overwritten before the user confirms!
      const stillOld = await fs.readFile(
        path.join(tmpDir, 'basic', 'src', 'lib.rs.template'),
        'utf-8'
      );
      expect(stillOld).toBe('pub struct OldBasic;\n');
      return true;
    });

    const updated = await upgrade({
      templatesDir: tmpDir,
      fetchImpl: mockFetchForRelease({ tag: 'v0.2.0', archive }),
      confirmFn,
    });

    expect(updated).toBe(true);
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(diffShownBeforeConfirm).toBe(true);

    const updatedBasic = await fs.readFile(
      path.join(tmpDir, 'basic', 'src', 'lib.rs.template'),
      'utf-8'
    );
    expect(updatedBasic).toContain('pub struct NewBasic;');
    expect(await fs.pathExists(path.join(tmpDir, 'basic', 'obsolete.template'))).toBe(false);
    expect(
      await fs.readFile(path.join(tmpDir, 'token', 'src', 'lib.rs.template'), 'utf-8')
    ).toContain('BrandNewToken');
  });

  it('leaves local templates untouched when the user declines confirmation', async () => {
    const filePath = path.join(tmpDir, 'basic', 'src', 'lib.rs.template');
    await fs.outputFile(filePath, 'pub struct KeepMe;\n');

    const archive = buildMockTemplatesTarGz({
      'templates/basic/src/lib.rs.template': 'pub struct Overwritten;\n',
    });

    const updated = await upgrade({
      templatesDir: tmpDir,
      fetchImpl: mockFetchForRelease({ tag: 'v0.3.0', archive }),
      confirmFn: async () => false,
    });

    expect(updated).toBe(false);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('pub struct KeepMe;\n');
    expect(loggedOutput()).toContain('Upgrade cancelled');
  });

  it('reports up-to-date and skips confirmation when nothing changed', async () => {
    await fs.outputFile(
      path.join(tmpDir, 'basic', 'src', 'lib.rs.template'),
      'pub struct Same;\n'
    );

    const archive = buildMockTemplatesTarGz({
      'templates/basic/src/lib.rs.template': 'pub struct Same;\n',
    });
    const confirmFn = jest.fn(async () => true);

    const updated = await upgrade({
      templatesDir: tmpDir,
      fetchImpl: mockFetchForRelease({ tag: 'v0.2.0', archive }),
      confirmFn,
    });

    expect(updated).toBe(false);
    expect(confirmFn).not.toHaveBeenCalled();
    expect(loggedOutput()).toContain('already up to date');
  });

  it('falls back to the main branch tarball when no GitHub release exists yet', async () => {
    const archive = buildMockTemplatesTarGz({
      'templates/basic/Cargo.toml.template': '[package]\nname = "{{PROJECT_NAME}}"\n',
    });

    const updated = await upgrade({
      templatesDir: tmpDir,
      yes: true,
      fetchImpl: mockFetchForRelease({
        noReleases: true,
        commitSha: 'deadbeef12345678',
        archive,
      }),
    });

    expect(updated).toBe(true);
    expect(loggedOutput()).toContain('main@deadbee');
    expect(await fs.pathExists(path.join(tmpDir, 'basic', 'Cargo.toml.template'))).toBe(true);
  });

  it('surfaces a clear error message on network failure or HTTP error without corrupting files', async () => {
    const filePath = path.join(tmpDir, 'basic', 'src', 'lib.rs.template');
    await fs.outputFile(filePath, 'pub struct Intact;\n');

    await expect(
      upgrade({
        templatesDir: tmpDir,
        yes: true,
        fetchImpl: mockFetchForRelease({
          networkError: new Error('getaddrinfo ENOTFOUND api.github.com'),
        }),
      })
    ).rejects.toThrow(/Network error while contacting GitHub.*ENOTFOUND/);

    expect(errorOutput()).toContain('Check your internet connection');
    expect(await fs.readFile(filePath, 'utf-8')).toBe('pub struct Intact;\n');

    await expect(
      upgrade({
        templatesDir: tmpDir,
        yes: true,
        fetchImpl: mockFetchForRelease({ apiStatus: 403 }),
      })
    ).rejects.toThrow(/HTTP 403.*GITHUB_TOKEN/);
  });

  it('refuses to block on stdin in non-interactive mode unless --yes is passed', async () => {
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;

    const archive = buildMockTemplatesTarGz({
      'templates/basic/src/lib.rs.template': 'pub struct Updated;\n',
    });

    await expect(
      upgrade({
        templatesDir: tmpDir,
        fetchImpl: mockFetchForRelease({ archive }),
      })
    ).rejects.toThrow(/--yes/);
  });

  it('handles PAX extended headers for long paths and rejects path-traversal entries', async () => {
    const longSubpath =
      'templates/nft/deeply/nested/directory/structure/with/a/very/long/path/that/exceeds/one/hundred/bytes/file.rs.template';
    const archive = buildMockTemplatesTarGz({ [longSubpath]: '// pax ok\n' });
    const extractDir = path.join(tmpDir, 'pax-out');
    await extractTarGz(archive, extractDir, 1);
    expect(await fs.readFile(path.join(extractDir, longSubpath), 'utf-8')).toBe('// pax ok\n');

    const traversalArchive = buildMockTemplatesTarGz({
      '../../evil.txt': 'nope',
    });
    await expect(extractTarGz(traversalArchive, path.join(tmpDir, 'safe-out'), 1)).rejects.toThrow(
      /escapes destination/
    );
  });

  it('computes accurate added, modified, removed, and unchanged counts across templates', async () => {
    const dirA = path.join(tmpDir, 'a');
    const dirB = path.join(tmpDir, 'b');

    await fs.outputFile(path.join(dirA, 'basic', 'same.txt'), 'alpha\nbeta\n');
    await fs.outputFile(path.join(dirA, 'basic', 'mod.txt'), 'line1\nline2\n');
    await fs.outputFile(path.join(dirA, 'basic', 'gone.txt'), 'bye\n');

    await fs.outputFile(path.join(dirB, 'basic', 'same.txt'), 'alpha\nbeta\n');
    await fs.outputFile(path.join(dirB, 'basic', 'mod.txt'), 'line1\nline2_changed\nline3\n');
    await fs.outputFile(path.join(dirB, 'basic', 'added.txt'), 'hello\n');

    const diff = await diffTemplateTrees(dirA, dirB);
    expect(diff.hasChanges).toBe(true);
    expect(diff.templates).toEqual([
      { template: 'basic', added: 1, modified: 1, removed: 1, unchanged: 1 },
    ]);
  });
});
