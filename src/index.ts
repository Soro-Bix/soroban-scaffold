#!/usr/bin/env node

import { Command, Option } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { init, VALID_TEMPLATES } from './commands/init.js';

const program = new Command();

program
  .name('sorokit')
  .description('Scaffold production-ready Soroban smart contract projects in one command')
  .version('0.1.0');

program
  .command('init <project-name>')
  .description('Create a new Soroban smart contract project')
  .option('-a, --author <author>', 'Author name (defaults to git config user.name)')
  .addOption(
    new Option('-t, --template <name>', 'Contract template to scaffold')
      .choices(VALID_TEMPLATES)
      .default('basic')
  )
  .action(async (projectName: string, options: { author?: string; template: string }) => {
    console.log(
      chalk.cyan(
        figlet.textSync('Sorokit', { horizontalLayout: 'full' })
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

program.parse();
