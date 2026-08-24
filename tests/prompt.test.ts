import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEMPLATE, isInteractive, resolveTemplate } from '../src/utils/prompt.js';
import { init } from '../src/commands/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_TEMPLATES_DIR = path.join(__dirname, 'fixtures', 'templates');

describe('resolveTemplate', () => {
  let originalStdinTTY: boolean | undefined;
  let originalStdoutTTY: boolean | undefined;

  beforeEach(() => {
    originalStdinTTY = process.stdin.isTTY;
    originalStdoutTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    process.stdin.isTTY = originalStdinTTY as boolean;
    process.stdout.isTTY = originalStdoutTTY as boolean;
  });

  it('returns an explicitly provided template without prompting', async () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;

    // Would hang if it tried to prompt, since no input is ever supplied.
    await expect(resolveTemplate('escrow')).resolves.toBe('escrow');
  });

  it('treats an explicit --template basic as a choice, not as "unspecified"', async () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;

    await expect(resolveTemplate('basic')).resolves.toBe('basic');
  });

  it('falls back to the default template when not interactive', async () => {
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;

    await expect(resolveTemplate()).resolves.toBe(DEFAULT_TEMPLATE);
  });

  it('does not block when stdin is not a TTY and no template is given', async () => {
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;

    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      resolveTemplate(),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error('resolveTemplate hung waiting on stdin')), 3000);
      }),
    ]).finally(() => clearTimeout(timer));

    expect(result).toBe(DEFAULT_TEMPLATE);
  });
});

describe('isInteractive', () => {
  let originalStdinTTY: boolean | undefined;
  let originalStdoutTTY: boolean | undefined;

  beforeEach(() => {
    originalStdinTTY = process.stdin.isTTY;
    originalStdoutTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    process.stdin.isTTY = originalStdinTTY as boolean;
    process.stdout.isTTY = originalStdoutTTY as boolean;
  });

  it('is false when stdin is not a TTY', () => {
    process.stdin.isTTY = false;
    process.stdout.isTTY = true;
    expect(isInteractive()).toBe(false);
  });

  it('is false when stdout is not a TTY (output is being piped)', () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = false;
    expect(isInteractive()).toBe(false);
  });

  it('is true only when both streams are TTYs', () => {
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    expect(isInteractive()).toBe(true);
  });
});

describe('init template selection (non-interactive)', () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalStdinTTY: boolean | undefined;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalStdinTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-select-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
    process.stdin.isTTY = originalStdinTTY as boolean;
  });

  it('scaffolds the default template when --template is omitted and there is no TTY', async () => {
    await init('defaulted', 'Test Author', undefined, FIXTURE_TEMPLATES_DIR);

    const libRs = await fs.readFile(
      path.join(tmpDir, 'defaulted', 'src', 'lib.rs'),
      'utf-8'
    );
    // The basic fixture's marker, confirming the default was applied.
    expect(libRs).toContain('pub struct defaultedContract');
  });

  it('still honors an explicit --template when one is given', async () => {
    await init('explicit', 'Test Author', 'token', FIXTURE_TEMPLATES_DIR);

    const libRs = await fs.readFile(
      path.join(tmpDir, 'explicit', 'src', 'lib.rs'),
      'utf-8'
    );
    expect(libRs).toContain('pub struct explicitTokenContract');
  });
});
