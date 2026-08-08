import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import fs from 'fs-extra';
import ora from 'ora';
import { copyTemplate, createProjectDir } from '../utils/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VALID_TEMPLATES = ['basic', 'token', 'escrow'] as const;
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

    const templateDir = path.join(templatesDir, template);
    if (!(await fs.pathExists(templateDir))) {
      throw new Error(
        `Template "${template}" not found at ${templateDir}. ` +
          'Set SOROBIX_TEMPLATES_DIR to point at a directory containing basic/, token/, and escrow/ subdirectories.'
      );
    }

    const destDir = createProjectDir(projectName);
    await copyTemplate(templateDir, destDir, { projectName, author });

    spinner.succeed(chalk.green(`Project "${projectName}" created successfully!`));
    console.log(chalk.green('\nNext steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan('  cargo build'));
    console.log(chalk.cyan('  cargo test'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to create project.'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    throw error;
  }
}
