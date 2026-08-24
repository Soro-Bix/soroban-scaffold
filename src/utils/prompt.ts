import select from '@inquirer/select';
import {
  TEMPLATE_DESCRIPTIONS,
  VALID_TEMPLATES,
  type TemplateName,
} from './templates.js';

export const DEFAULT_TEMPLATE: TemplateName = 'basic';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function promptForTemplate(): Promise<TemplateName> {
  return select({
    message: 'Which contract template would you like to use?',
    choices: VALID_TEMPLATES.map((name) => ({
      name,
      value: name,
      description: TEMPLATE_DESCRIPTIONS[name],
    })),
    default: DEFAULT_TEMPLATE,
  });
}

/**
 * An explicit --template always wins. Otherwise the selector runs only on an
 * interactive terminal; CI and piped runs fall through to the default so an
 * unattended scaffold cannot block on stdin.
 */
export async function resolveTemplate(templateOption?: string): Promise<string> {
  if (templateOption) {
    return templateOption;
  }

  if (isInteractive()) {
    return promptForTemplate();
  }

  return DEFAULT_TEMPLATE;
}
