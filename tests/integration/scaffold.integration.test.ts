import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { execFileSync, execSync } from 'node:child_process';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'dist', 'index.js');

// CI checks the templates repo out inside the workspace rather than beside it,
// so the env var has to win over the local sibling-directory convention.
const TEMPLATES_DIR = process.env.SOROBIX_TEMPLATES_DIR?.trim()
  ? path.resolve(process.env.SOROBIX_TEMPLATES_DIR.trim())
  : path.resolve(REPO_ROOT, '..', 'soroban-scaffold-templates', 'templates');

function hasCargo(): boolean {
  try {
    execSync('cargo --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasTemplates(): boolean {
  return fs.existsSync(TEMPLATES_DIR);
}

// Integration coverage depends on a Rust toolchain and the sibling templates
// checkout. Where either is absent the suite skips rather than fails, so a
// contributor without Rust installed still gets a green unit run.
const CARGO_AVAILABLE = hasCargo();
const TEMPLATES_AVAILABLE = hasTemplates();
const CAN_RUN = CARGO_AVAILABLE && TEMPLATES_AVAILABLE;

const describeIntegration = CAN_RUN ? describe : describe.skip;

if (!CAN_RUN) {
  console.warn(
    `Skipping scaffold integration tests — ` +
      `cargo: ${CARGO_AVAILABLE ? 'found' : 'missing'}, ` +
      `templates (${TEMPLATES_DIR}): ${TEMPLATES_AVAILABLE ? 'found' : 'missing'}`
  );
}

interface TemplateExpectation {
  template: string;
  expectedFiles: string[];
  expectedTestCount: number;
  libMarker: string;
}

const EXPECTATIONS: TemplateExpectation[] = [
  {
    template: 'basic',
    expectedFiles: ['Cargo.toml', 'Cargo.lock', '.gitignore', 'README.md', 'src/lib.rs', 'src/test.rs'],
    expectedTestCount: 7,
    libMarker: 'pub struct CounterContract',
  },
  {
    template: 'token',
    expectedFiles: ['Cargo.toml', 'Cargo.lock', '.gitignore', 'README.md', 'src/lib.rs', 'src/test.rs'],
    expectedTestCount: 9,
    libMarker: 'pub struct TokenContract',
  },
  {
    template: 'escrow',
    expectedFiles: ['Cargo.toml', 'Cargo.lock', '.gitignore', 'README.md', 'src/lib.rs', 'src/test.rs'],
    expectedTestCount: 7,
    libMarker: 'pub struct EscrowContract',
  },
];

function parseTestTotal(cargoOutput: string): number {
  // "test result: ok. 7 passed; 0 failed; ..." — sum the unit-test line(s),
  // ignoring the doc-test line which is always 0 here.
  const matches = [...cargoOutput.matchAll(/test result: ok\. (\d+) passed/g)];
  return matches.reduce((total, match) => total + Number(match[1]), 0);
}

describeIntegration('scaffolded projects build and pass their own tests', () => {
  let workDir: string;

  beforeAll(async () => {
    // The compiled CLI is what users actually run, so integration exercises
    // dist/ rather than the TypeScript sources.
    execSync('npm run build', { cwd: REPO_ROOT, stdio: 'ignore' });
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-integration-'));
  }, 180_000);

  afterAll(async () => {
    if (workDir) {
      await fs.remove(workDir);
    }
  });

  it.each(EXPECTATIONS)(
    'scaffolds $template and passes cargo test --locked',
    async ({ template, expectedFiles, expectedTestCount, libMarker }) => {
      const projectName = `it-${template}`;
      const projectDir = path.join(workDir, projectName);

      execFileSync(
        process.execPath,
        [CLI, 'init', projectName, '--template', template, '--author', 'Integration Test'],
        {
          cwd: workDir,
          env: { ...process.env, SOROBIX_TEMPLATES_DIR: TEMPLATES_DIR },
          stdio: 'ignore',
        }
      );

      for (const relativePath of expectedFiles) {
        expect(
          await fs.pathExists(path.join(projectDir, relativePath))
        ).toBe(true);
      }

      const cargoToml = await fs.readFile(path.join(projectDir, 'Cargo.toml'), 'utf-8');
      expect(cargoToml).toContain(`name = "${projectName}"`);
      expect(cargoToml).toContain('authors = ["Integration Test"]');

      const libRs = await fs.readFile(path.join(projectDir, 'src', 'lib.rs'), 'utf-8');
      expect(libRs).toContain(libMarker);

      // No template variable may survive into a generated project.
      for (const relativePath of expectedFiles) {
        const contents = await fs.readFile(path.join(projectDir, relativePath), 'utf-8');
        expect(contents).not.toMatch(/\{\{[A-Z_]+\}\}/);
      }

      const cargoOutput = execSync('cargo test --locked 2>&1', {
        cwd: projectDir,
        encoding: 'utf-8',
        maxBuffer: 32 * 1024 * 1024,
      });

      expect(cargoOutput).toContain('test result: ok.');
      expect(cargoOutput).not.toContain('test result: FAILED');
      expect(parseTestTotal(cargoOutput)).toBe(expectedTestCount);
    },
    600_000
  );
});
