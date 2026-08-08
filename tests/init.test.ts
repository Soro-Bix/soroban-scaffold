import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init } from '../src/commands/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_TEMPLATES_DIR = path.join(__dirname, 'fixtures', 'templates');

describe('init command', () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalTemplatesDirEnv: string | undefined;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalTemplatesDirEnv = process.env.SOROBIX_TEMPLATES_DIR;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-test-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
    if (originalTemplatesDirEnv === undefined) {
      delete process.env.SOROBIX_TEMPLATES_DIR;
    } else {
      process.env.SOROBIX_TEMPLATES_DIR = originalTemplatesDirEnv;
    }
  });

  it('creates a project directory with rendered template files (basic, default)', async () => {
    await init('my-project', 'Test Author', 'basic', FIXTURE_TEMPLATES_DIR);

    const projectDir = path.join(tmpDir, 'my-project');
    expect(await fs.pathExists(projectDir)).toBe(true);

    const cargoToml = await fs.readFile(path.join(projectDir, 'Cargo.toml'), 'utf-8');
    expect(cargoToml).toContain('name = "my-project"');
    expect(cargoToml).toContain('authors = ["Test Author"]');

    const libRs = await fs.readFile(path.join(projectDir, 'src', 'lib.rs'), 'utf-8');
    expect(libRs).toContain('pub struct my-projectContract');

    expect(await fs.pathExists(path.join(projectDir, '.gitignore'))).toBe(true);
  });

  it('creates a project directory from the token template', async () => {
    await init('my-token', 'Test Author', 'token', FIXTURE_TEMPLATES_DIR);

    const projectDir = path.join(tmpDir, 'my-token');
    const libRs = await fs.readFile(path.join(projectDir, 'src', 'lib.rs'), 'utf-8');
    expect(libRs).toContain('pub struct my-tokenTokenContract');
  });

  it('creates a project directory from the escrow template', async () => {
    await init('my-escrow', 'Test Author', 'escrow', FIXTURE_TEMPLATES_DIR);

    const projectDir = path.join(tmpDir, 'my-escrow');
    const libRs = await fs.readFile(path.join(projectDir, 'src', 'lib.rs'), 'utf-8');
    expect(libRs).toContain('pub struct my-escrowEscrowContract');
  });

  it('rejects an invalid template name with a clear error', async () => {
    await expect(
      init('my-project', 'Test Author', 'nonexistent', FIXTURE_TEMPLATES_DIR)
    ).rejects.toThrow(/Invalid template "nonexistent".*basic, token, escrow/);

    expect(await fs.pathExists(path.join(tmpDir, 'my-project'))).toBe(false);
  });

  it('throws a clear error when the project directory already exists', async () => {
    await fs.ensureDir(path.join(tmpDir, 'existing-project'));

    await expect(
      init('existing-project', 'Test Author', 'basic', FIXTURE_TEMPLATES_DIR)
    ).rejects.toThrow(/already exists/);
  });

  it('honors SOROBIX_TEMPLATES_DIR to override the default templates path', async () => {
    process.env.SOROBIX_TEMPLATES_DIR = FIXTURE_TEMPLATES_DIR;

    await init('env-project', 'Test Author', 'basic');

    const projectDir = path.join(tmpDir, 'env-project');
    const libRs = await fs.readFile(path.join(projectDir, 'src', 'lib.rs'), 'utf-8');
    expect(libRs).toContain('pub struct env-projectContract');
  });
});
