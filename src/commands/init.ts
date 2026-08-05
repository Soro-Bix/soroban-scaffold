import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { copyTemplate, createProjectDir } from '../utils/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export async function init(projectName: string, authorOption?: string): Promise<void> {
  const author = resolveAuthor(authorOption);
  // TODO: make configurable (--template flag) once token/ and escrow/ are populated
  const templateDir = path.join(
    __dirname,
    '../../../soroban-scaffold-templates/templates/basic'
  );

  const spinner = ora('Scaffolding your Soroban project...').start();

  try {
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
