import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';

const CLI = path.resolve(__dirname, '../dist/index.js');

describe('CLI integration tests', () => {
  const TEST_DIR = path.join(__dirname, '__test_projects__');

  beforeEach(() => {
    fs.removeSync(TEST_DIR);
  });

  afterEach(() => {
    fs.removeSync(TEST_DIR);
  });

  test('sorobix --version', () => {
    const result = execSync(`node ${CLI} --version`, { encoding: 'utf-8' });
    expect(result.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('sorobix --help', () => {
    const result = execSync(`node ${CLI} --help`, { encoding: 'utf-8' });
    expect(result).toContain('init');
    expect(result).toContain('list');
    expect(result).toContain('upgrade');
  });

  test('sorobix list', () => {
    const result = execSync(`node ${CLI} list`, { encoding: 'utf-8' });
    expect(result).toContain('basic');
    expect(result).toContain('token');
    expect(result).toContain('nft');
    expect(result).toContain('multisig');
    expect(result).toContain('timelock');
    expect(result).toContain('vesting');
  });

  test('sorobix init basic project', () => {
    execSync(`node ${CLI} init test-project -t basic`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    const projectPath = path.join(TEST_DIR, 'test-project');
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'Cargo.toml'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'src', 'lib.rs'))).toBe(true);
  });

  test('sorobix init with author flag', () => {
    execSync(`node ${CLI} init test-author -a "Test Author"`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    const cargoToml = fs.readFileSync(
      path.join(TEST_DIR, 'test-author', 'Cargo.toml'),
      'utf-8'
    );
    expect(cargoToml).toContain('Test Author');
  });

  test('sorobix init token project', () => {
    execSync(`node ${CLI} init token-proj -t token`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    expect(fs.existsSync(path.join(TEST_DIR, 'token-proj', 'Cargo.toml'))).toBe(true);
  });

  test('sorobix init nft project', () => {
    execSync(`node ${CLI} init nft-proj -t nft`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });
    expect(fs.existsSync(path.join(TEST_DIR, 'nft-proj', 'src', 'lib.rs'))).toBe(true);
  });

  test('sorobix init invalid template fails', () => {
    expect(() => {
      execSync(`node ${CLI} init fail-proj -t nonexistent`, {
        cwd: TEST_DIR,
        encoding: 'utf-8',
      });
    }).toThrow();
  });
});
