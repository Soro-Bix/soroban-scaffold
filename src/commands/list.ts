import chalk from 'chalk';
import { discoverTemplates, resolveTemplatesDir } from '../utils/templates.js';

export async function list(templatesDir: string = resolveTemplatesDir()): Promise<void> {
  const templates = await discoverTemplates(templatesDir);

  console.log(chalk.bold('\nAvailable templates:\n'));

  for (const template of templates) {
    const tests = template.available
      ? chalk.dim(template.testCount === null ? 'no tests' : `${template.testCount} tests`)
      : chalk.yellow('not found');

    console.log(`  ${chalk.cyan(template.name.padEnd(8))} ${template.description}  ${tests}`);
  }

  console.log(chalk.dim(`\nTemplates directory: ${templatesDir}`));
  console.log(chalk.dim('Usage: sorobix init <project-name> --template <name>\n'));
}
