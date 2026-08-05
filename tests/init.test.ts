import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { init } from '../src/commands/init.js';

describe('init command', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorokit-test-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
  });

  it('creates a project directory with rendered template files', async () => {
    await init('my-project', 'Test Author');

    const projectDir = path.join(tmpDir, 'my-project');
    expect(await fs.pathExists(projectDir)).toBe(true);

    const cargoToml = await fs.readFile(path.join(projectDir, 'Cargo.toml'), 'utf-8');
    expect(cargoToml).toContain('name = "my-project"');
    expect(cargoToml).toContain('authors = ["Test Author"]');

    const libRs = await fs.readFile(path.join(projectDir, 'src', 'lib.rs'), 'utf-8');
    expect(libRs).toContain('pub struct CounterContract');

    expect(await fs.pathExists(path.join(projectDir, '.gitignore'))).toBe(true);
  });

  it('throws a clear error when the project directory already exists', async () => {
    await fs.ensureDir(path.join(tmpDir, 'existing-project'));

    await expect(init('existing-project', 'Test Author')).rejects.toThrow(
      /already exists/
    );
  });
});
