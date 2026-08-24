import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { FALLBACK_AUTHOR, readGitAuthor, resolveAuthor } from '../src/utils/author.js';

// Jest's node test environment sandboxes process.env, so assigning to it does
// NOT reach spawned child processes. Git config layers must therefore be
// controlled by passing an explicit env through to execSync.
function envWithoutGitIdentity(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  };
}

describe('readGitAuthor', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-git-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
  });

  it('reads a configured user.name from the repository', () => {
    execSync('git init --quiet', { cwd: tmpDir });
    execSync('git config user.name "Configured Person"', { cwd: tmpDir });
    process.chdir(tmpDir);

    expect(readGitAuthor()).toBe('Configured Person');
  });

  it('returns null rather than throwing when no user.name is configured anywhere', () => {
    execSync('git init --quiet', { cwd: tmpDir });
    process.chdir(tmpDir);

    expect(readGitAuthor(envWithoutGitIdentity())).toBeNull();
  });

  it('returns null when not inside a git repository and no global identity exists', () => {
    process.chdir(tmpDir);

    expect(readGitAuthor(envWithoutGitIdentity())).toBeNull();
  });
});

describe('resolveAuthor', () => {
  let originalCwd: string;
  let tmpDir: string;
  let originalIsTTY: boolean | undefined;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalIsTTY = process.stdin.isTTY;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-author-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
    process.stdin.isTTY = originalIsTTY as boolean;
  });

  it('uses the --author flag value directly when provided', async () => {
    await expect(resolveAuthor('Alice')).resolves.toBe('Alice');
  });

  it('trims surrounding whitespace from the flag value', async () => {
    await expect(resolveAuthor('  Alice Smith  ')).resolves.toBe('Alice Smith');
  });

  it('falls back to git config user.name when no flag is given', async () => {
    execSync('git init --quiet', { cwd: tmpDir });
    execSync('git config user.name "Repo Configured Name"', { cwd: tmpDir });
    process.chdir(tmpDir);

    await expect(resolveAuthor()).resolves.toBe('Repo Configured Name');
  });

  it('does not prompt (and does not hang) when stdin is not a TTY', async () => {
    process.chdir(tmpDir);
    process.stdin.isTTY = false;

    // The guarantee that matters for CI: this resolves rather than blocking
    // forever on stdin that will never produce input.
    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      resolveAuthor(),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error('resolveAuthor hung waiting on stdin')), 3000);
      }),
    ]).finally(() => clearTimeout(timer));

    expect(typeof result).toBe('string');
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it('never resolves to an empty string, so templates cannot render a blank author', async () => {
    process.chdir(tmpDir);
    process.stdin.isTTY = false;

    const fromFlag = await resolveAuthor('   ');
    const fromFallback = await resolveAuthor();

    expect(fromFlag.trim().length).toBeGreaterThan(0);
    expect(fromFallback.trim().length).toBeGreaterThan(0);
  });
});

describe('FALLBACK_AUTHOR', () => {
  it('is a non-empty string', () => {
    expect(FALLBACK_AUTHOR.trim().length).toBeGreaterThan(0);
  });
});
