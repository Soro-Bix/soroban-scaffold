import select from '@inquirer/select';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { isInteractive } from '../utils/prompt.js';
import {
  diffTemplateTrees,
  fetchLatestTemplates,
  installFetchedTemplates,
  resolveUpgradeTargetDir,
  type FetchLike,
  type TemplateTreeDiff,
} from '../utils/upgrade.js';

export interface UpgradeOptions {
  yes?: boolean;
  templatesDir?: string;
  fetchImpl?: FetchLike;
  confirmFn?: () => Promise<boolean>;
}

export async function promptUpgradeConfirmation(targetDir: string): Promise<boolean> {
  return select({
    message: `Overwrite local templates in ${targetDir}?`,
    choices: [
      { name: 'Yes, update local templates', value: true },
      { name: 'No, keep current templates', value: false },
    ],
    default: true,
  });
}

function renderDiffSummary(diff: TemplateTreeDiff, version: string, targetDir: string): void {
  console.log(chalk.bold(`\nTemplate changes (${version}):\n`));

  for (const summary of diff.templates) {
    const parts: string[] = [];
    if (summary.added > 0) parts.push(chalk.green(`${summary.added} added`));
    if (summary.modified > 0) parts.push(chalk.yellow(`${summary.modified} modified`));
    if (summary.removed > 0) parts.push(chalk.red(`${summary.removed} removed`));
    if (parts.length === 0) {
      parts.push(chalk.dim(`unchanged (${summary.unchanged} files)`));
    }
    console.log(`  ${chalk.cyan(summary.template.padEnd(10))} ${parts.join(', ')}`);
  }

  console.log('');
  for (const file of diff.files) {
    if (file.kind === 'added') {
      console.log(
        `  ${chalk.green('+')} ${file.relativePath} ${chalk.green(`(+${file.addedLines} lines)`)}`
      );
    } else if (file.kind === 'removed') {
      console.log(
        `  ${chalk.red('-')} ${file.relativePath} ${chalk.red(`(-${file.removedLines} lines)`)}`
      );
    } else {
      console.log(
        `  ${chalk.yellow('~')} ${file.relativePath} ${chalk.yellow(
          `(+${file.addedLines} / -${file.removedLines} lines)`
        )}`
      );
    }
  }

  console.log(chalk.dim(`\nTarget directory: ${targetDir}\n`));
}

/**
 * Fetches the latest templates from `Soro-Bix/soroban-scaffold-templates`,
 * prints a summary of what changed compared with the local cache, asks for
 * confirmation (unless `--yes` is passed), and installs the updated templates.
 */
export async function upgrade(options: UpgradeOptions = {}): Promise<boolean> {
  const targetDir = resolveUpgradeTargetDir(options.templatesDir);
  let spinner: Ora | undefined;

  try {
    spinner = ora('Checking Soro-Bix/soroban-scaffold-templates for updates…').start();
    const fetched = await fetchLatestTemplates(options.fetchImpl);
    spinner.stop();
    spinner = undefined;

    try {
      const diff = await diffTemplateTrees(targetDir, fetched.templatesDir);

      if (!diff.hasChanges) {
        console.log(
          chalk.green(`Templates are already up to date (${fetched.version}) at ${targetDir}.`)
        );
        return false;
      }

      renderDiffSummary(diff, fetched.version, targetDir);

      let confirmed: boolean;
      if (options.yes) {
        confirmed = true;
      } else if (options.confirmFn) {
        confirmed = await options.confirmFn();
      } else if (isInteractive()) {
        confirmed = await promptUpgradeConfirmation(targetDir);
      } else {
        throw new Error(
          'Confirmation required in non-interactive mode. Re-run with --yes to overwrite local templates.'
        );
      }

      if (!confirmed) {
        console.log(chalk.yellow('Upgrade cancelled. Local templates were not modified.'));
        return false;
      }

      spinner = ora(`Updating templates to ${fetched.version}…`).start();
      const updated = await installFetchedTemplates(fetched.templatesDir, targetDir);
      spinner.succeed(
        chalk.green(
          `Updated ${updated.length} template(s) (${updated.join(', ')}) to ${fetched.version}.`
        )
      );
      return true;
    } finally {
      await fetched.cleanup();
    }
  } catch (error) {
    spinner?.fail(chalk.red('Failed to upgrade templates.'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    throw error;
  }
}
