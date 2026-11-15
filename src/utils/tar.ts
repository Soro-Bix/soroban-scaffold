import fs from 'fs-extra';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const BLOCK_SIZE = 512;

function readNullTerminated(buf: Buffer, start: number, end: number): string {
  let stop = start;
  while (stop < end && buf[stop] !== 0) {
    stop++;
  }
  return buf.subarray(start, stop).toString('utf-8');
}

function parseTarSize(buf: Buffer, offset: number, length: number): number {
  const first = buf[offset];
  // Base-256 binary encoding (high bit set) used for very large entries.
  if ((first & 0x80) !== 0) {
    let value = 0;
    for (let i = 1; i < length; i++) {
      value = value * 256 + buf[offset + i];
    }
    return value;
  }

  const raw = readNullTerminated(buf, offset, offset + length).trim();
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 8);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Malformed tar entry size: "${raw}"`);
  }
  return parsed;
}

function isZeroBlock(buf: Buffer, offset: number): boolean {
  for (let i = offset; i < offset + BLOCK_SIZE; i++) {
    if (buf[i] !== 0) return false;
  }
  return true;
}

function parsePaxRecords(payload: Buffer): Record<string, string> {
  const records: Record<string, string> = {};
  let cursor = 0;
  const text = payload.toString('utf-8');

  while (cursor < text.length) {
    const spaceIdx = text.indexOf(' ', cursor);
    if (spaceIdx === -1) break;
    const byteLen = Number.parseInt(text.slice(cursor, spaceIdx), 10);
    if (!Number.isFinite(byteLen) || byteLen <= 0) break;

    // PAX record length is measured in UTF-8 bytes, including the length prefix
    // and trailing newline. Walk line-by-line if multi-byte chars are present.
    const newlineIdx = text.indexOf('\n', spaceIdx + 1);
    if (newlineIdx === -1) break;
    const body = text.slice(spaceIdx + 1, newlineIdx);
    const eqIdx = body.indexOf('=');
    if (eqIdx !== -1) {
      records[body.slice(0, eqIdx)] = body.slice(eqIdx + 1);
    }
    cursor = newlineIdx + 1;
  }

  return records;
}

function sanitizeRelativePath(entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter((segment) => segment.length > 0 && segment !== '.');

  if (parts.some((segment) => segment === '..')) {
    throw new Error(`Refusing archive entry that escapes destination: "${entryPath}"`);
  }

  return parts.join('/');
}

/**
 * Extracts a gzipped POSIX/USTAR/PAX `.tar.gz` archive (such as a GitHub
 * release or commit tarball) into `destDir`, stripping `stripComponents`
 * leading path segments (1 by default to remove GitHub's `<repo>-<sha>/` root).
 */
export async function extractTarGz(
  compressed: Buffer | Uint8Array,
  destDir: string,
  stripComponents: number = 1
): Promise<number> {
  let tarBuffer: Buffer;
  try {
    tarBuffer = gunzipSync(compressed);
  } catch (error) {
    throw new Error(
      `Invalid or corrupted template archive: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  await fs.ensureDir(destDir);
  const resolvedDestRoot = path.resolve(destDir);

  let offset = 0;
  let pendingPathOverride: string | undefined;
  let filesWritten = 0;

  while (offset + BLOCK_SIZE <= tarBuffer.length) {
    if (isZeroBlock(tarBuffer, offset)) {
      break;
    }

    const name = readNullTerminated(tarBuffer, offset, offset + 100);
    const size = parseTarSize(tarBuffer, offset + 124, 12);
    const typeFlagByte = tarBuffer[offset + 156];
    const typeFlag = typeFlagByte === 0 ? '0' : String.fromCharCode(typeFlagByte);
    const prefix = readNullTerminated(tarBuffer, offset + 345, offset + 500);

    const dataStart = offset + BLOCK_SIZE;
    const dataEnd = dataStart + size;
    if (dataEnd > tarBuffer.length) {
      throw new Error('Truncated tar archive while reading entry payload');
    }

    const payload = tarBuffer.subarray(dataStart, dataEnd);
    const paddedPayloadBlocks = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
    offset = dataStart + paddedPayloadBlocks;

    // Global PAX header ('g'), e.g. GitHub commit comment metadata — ignore.
    if (typeFlag === 'g') {
      continue;
    }

    // Per-entry PAX extended header ('x') — capture path override for next file.
    if (typeFlag === 'x') {
      const pax = parsePaxRecords(payload);
      if (pax.path) {
        pendingPathOverride = pax.path;
      }
      continue;
    }

    // GNU LongLink ('L') — payload contains the full path of the next entry.
    if (typeFlag === 'L') {
      pendingPathOverride = readNullTerminated(payload, 0, payload.length);
      continue;
    }

    const rawPath = pendingPathOverride ?? (prefix ? `${prefix}/${name}` : name);
    pendingPathOverride = undefined;

    const cleanPath = sanitizeRelativePath(rawPath);
    if (!cleanPath) continue;

    const segments = cleanPath.split('/');
    if (segments.length <= stripComponents) {
      continue;
    }

    const strippedRelPath = segments.slice(stripComponents).join('/');
    const targetPath = path.resolve(resolvedDestRoot, strippedRelPath);
    const relativeToRoot = path.relative(resolvedDestRoot, targetPath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Refusing archive entry outside destination: "${rawPath}"`);
    }

    if (typeFlag === '5') {
      await fs.ensureDir(targetPath);
    } else if (typeFlag === '0') {
      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, payload);
      filesWritten++;
    }
  }

  return filesWritten;
}
