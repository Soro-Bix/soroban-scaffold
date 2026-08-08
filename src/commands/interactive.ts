import chalk from 'chalk';
import inquirer from 'inquirer';
import { init, VALID_TEMPLATES } from './init.js';

export async function interactiveInit(authorOption?: string): Promise<void> {
  console.log(chalk.cyan('Interactive Sorobix Project Creator\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      validate: (input: string) => {
        if (!input.trim()) return 'Project name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'Only letters, numbers, hyphens, and underscores allowed';
        return true;
      },
    },
    {
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: VALID_TEMPLATES.map(t => ({
        name: `${t}${getTemplateDescription(t)}`,
        value: t,
      })),
    },
  ]);

  console.log(chalk.green(`\nScaffolding ${answers.template} project: ${answers.projectName}...\n`));

  try {
    await init(answers.projectName, authorOption, answers.template);
  } catch (err) {
    console.error(chalk.red(`Error: ${err}`));
    throw err;
  }
}

function getTemplateDescription(template: string): string {
  const descriptions: Record<string, string> = {
    basic: ' — Minimal contract skeleton',
    token: ' — SEP-41 fungible token',
    escrow: ' — Time-locked escrow with milestones',
    nft: ' — Non-fungible token (ERC-721 style)',
    multisig: ' — Multi-signature wallet',
    timelock: ' — Time-based token lock',
    vesting: ' — Token vesting with cliff',
  };
  return descriptions[template] || '';
}
