#!/usr/bin/env node

import { Command, Option } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { init } from './commands/init.js';
import { list } from './commands/list.js';
import { VALID_TEMPLATES } from './utils/templates.js';

const program = new Command();

program
  .name('sorobix')
  .description('Scaffold production-ready Soroban smart contract projects in one command')
  .version('0.1.0');

program
  .command('init <project-name>')
  .description('Create a new Soroban smart contract project')
  .option('-a, --author <author>', 'Author name (defaults to git config user.name)')
  // No commander default: an absent --template must stay distinguishable from
  // an explicit "--template basic" so the selector knows whether to prompt.
  .addOption(
    new Option('-t, --template <name>', 'Contract template to scaffold (prompts if omitted)')
      .choices(VALID_TEMPLATES)
  )
  .action(async (projectName: string, options: { author?: string; template?: string }) => {
    console.log(
      chalk.cyan(
        figlet.textSync('Sorobix', { horizontalLayout: 'full' })
      )
    );
    console.log(chalk.green('\nWelcome to Soroban Scaffold!'));
    console.log(chalk.blue(`Project name: ${projectName}`));

    try {
      await init(projectName, options.author, options.template);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command('list')
  .description('List the available contract templates')
  .action(async () => {
    try {
      await list();
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
    }
  });

program.parse();
