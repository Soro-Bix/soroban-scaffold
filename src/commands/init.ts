import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import ora, { type Ora } from 'ora';
import { resolveAuthor } from '../utils/author.js';
import { copyTemplate, createProjectDir } from '../utils/files.js';
import { resolveTemplate } from '../utils/prompt.js';
import { isValidTemplate, resolveTemplatesDir, VALID_TEMPLATES } from '../utils/templates.js';

export async function init(
  projectName: string,
  authorOption?: string,
  templateOption?: string,
  templatesDir: string = resolveTemplatesDir()
): Promise<void> {
  let spinner: Ora | undefined;

  try {
    const template = await resolveTemplate(templateOption);

    // Validated before resolving the author: prompting someone for their name
    // and then failing on an unknown template wastes the answer.
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

    // Resolved before the spinner starts, so an interactive prompt is not
    // rendered underneath a spinning frame.
    const author = await resolveAuthor(authorOption);

    spinner = ora(`Initializing ${template} project: ${projectName}`).start();

    const destDir = createProjectDir(projectName);
    await copyTemplate(templateDir, destDir, { projectName, author });

    spinner.succeed(chalk.green(`Project "${projectName}" created successfully!`));
    console.log(chalk.green('\nNext steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan('  cargo build'));
    console.log(chalk.cyan('  cargo test'));
  } catch (error) {
    spinner?.fail(chalk.red('Failed to create project.'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    throw error;
  }
}
