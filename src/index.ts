#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('sorokit')
  .description('Scaffold production-ready Soroban smart contract projects in one command')
  .version('0.1.0');

program
  .command('init <project-name>')
  .description('Create a new Soroban smart contract project')
  .option('-a, --author <author>', 'Author name (defaults to git config user.name)')
  .action(async (projectName: string, options: { author?: string }) => {
    console.log(
      chalk.cyan(
        figlet.textSync('Sorokit', { horizontalLayout: 'full' })
      )
    );
    console.log(chalk.green('\nWelcome to Soroban Scaffold!'));
    console.log(chalk.blue(`Project name: ${projectName}`));

    try {
      await init(projectName, options.author);
    } catch {
      process.exitCode = 1;
    }
  });

program.parse();
