import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import fs from 'fs-extra';
import ora from 'ora';
import { copyTemplate, createProjectDir } from '../utils/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VALID_TEMPLATES = ['basic', 'token', 'escrow', 'nft', 'multisig', 'timelock', 'vesting'] as const;
export type TemplateName = (typeof VALID_TEMPLATES)[number];

function isValidTemplate(value: string): value is TemplateName {
  return (VALID_TEMPLATES as readonly string[]).includes(value);
}

const DEFAULT_TEMPLATES_DIR = path.join(
  __dirname,
  '../../../soroban-scaffold-templates/templates'
);

function resolveTemplatesDir(): string {
  const override = process.env.SOROBIX_TEMPLATES_DIR;
  return override && override.trim() ? override.trim() : DEFAULT_TEMPLATES_DIR;
}

function resolveAuthor(authorOption?: string): string {
  if (authorOption && authorOption.trim()) {
    return authorOption.trim();
  }

  try {
    const gitAuthor = execSync('git config user.name', { encoding: 'utf-8' }).trim();
    if (gitAuthor) {
      return gitAuthor;
    }
  } catch {
    // git not installed, or no user.name configured — fall through to default
  }

  return 'Unknown';
}

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  basic: 'Minimal contract skeleton with basic structure and tests',
  token: 'SEP-41 compliant fungible token with mint, transfer, approve',
  escrow: 'Time-locked escrow with multi-milestone release',
  nft: 'Non-fungible token with mint, transfer, and metadata',
  multisig: 'Multi-signature wallet with threshold approvals',
  timelock: 'Time-based token lock with beneficiary release',
  vesting: 'Token vesting schedule with cliff and linear release',
};

export function listTemplates(): void {
  const templatesDir = resolveTemplatesDir();
  console.log(chalk.bold('Template          Description'));
  console.log(chalk.bold('--------          -----------'));
  
  for (const name of VALID_TEMPLATES) {
    const tmplPath = path.join(templatesDir, name);
    const exists = fs.existsSync(tmplPath);
    const status = exists ? chalk.green('✓') : chalk.red('✗');
    const desc = TEMPLATE_DESCRIPTIONS[name] || 'No description available';
    console.log(` ${status} ${chalk.cyan(name.padEnd(16))} ${desc}`);
  }
  console.log('');
}

export function upgradeProject(projectPath: string): void {
  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`Project path not found: ${absPath}`));
    return;
  }

  console.log(chalk.blue(`Project path: ${absPath}`));

  // Check if this is a Sorobix-generated project
  const cargoToml = path.join(absPath, 'Cargo.toml');
  if (!fs.existsSync(cargoToml)) {
    console.error(chalk.red('Not a valid Soroban project (Cargo.toml not found)'));
    return;
  }

  const cargoContent = fs.readFileSync(cargoToml, 'utf-8');
  const sorobanSdkMatch = cargoContent.match(/soroban-sdk\s*=\s*"([^"]+)"/);
  const currentVersion = sorobanSdkMatch ? sorobanSdkMatch[1] : 'unknown';

  console.log(chalk.blue(`Current soroban-sdk version: ${currentVersion}`));
  console.log(chalk.blue(`Latest soroban-sdk version: 22.0.0`));

  if (currentVersion === '22.0.0') {
    console.log(chalk.green('✓ Project is already up to date!'));
    return;
  }

  // Upgrade soroban-sdk version
  const upgraded = cargoContent.replace(
    /soroban-sdk\s*=\s*"[^"]+"/g,
    'soroban-sdk = "22.0.0"'
  );

  if (upgraded !== cargoContent) {
    fs.writeFileSync(cargoToml, upgraded);
    console.log(chalk.green('✓ Upgraded soroban-sdk to 22.0.0'));
  }

  console.log(chalk.green('\nUpgrade complete! Run `cargo build` to verify.'));
}

const TEMPLATE_DESC: Record<string, string> = TEMPLATE_DESCRIPTIONS;

export async function init(
  projectName: string,
  authorOption?: string,
  template: string = 'basic',
  templatesDir: string = resolveTemplatesDir()
): Promise<void> {
  const author = resolveAuthor(authorOption);
  const spinner = ora(`Initializing ${template} project: ${projectName}`).start();

  try {
    if (!isValidTemplate(template)) {
      throw new Error(
        `Invalid template "${template}". Valid options are: ${VALID_TEMPLATES.join(', ')}`
      );
    }

    const projectPath = createProjectDir(projectName);
    await copyTemplate(template, projectPath, templatesDir, {
      projectName,
      author,
    });

    spinner.succeed(chalk.green(`Project created at ${projectPath}`));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white(`  cd ${projectName}`));
    console.log(chalk.white('  cargo build'));
    console.log(chalk.white('  cargo test'));
    console.log('');
  } catch (err) {
    spinner.fail(chalk.red(`Failed to create project: ${err}`));
    throw err;
  }
}
