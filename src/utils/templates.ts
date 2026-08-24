import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VALID_TEMPLATES = ['basic', 'token', 'escrow', 'nft'] as const;
export type TemplateName = (typeof VALID_TEMPLATES)[number];

export const TEMPLATE_DESCRIPTIONS: Record<TemplateName, string> = {
  basic: 'Counter contract — ideal for learning Soroban fundamentals',
  token: 'SEP-41 fungible token with mint/burn/transfer/approve',
  escrow: 'Milestone-based escrow with dispute resolution',
  nft: 'Non-fungible token with per-token metadata and approvals',
};

const DEFAULT_TEMPLATES_DIR = path.join(
  __dirname,
  '../../../soroban-scaffold-templates/templates'
);

export function isValidTemplate(value: string): value is TemplateName {
  return (VALID_TEMPLATES as readonly string[]).includes(value);
}

export function resolveTemplatesDir(): string {
  const override = process.env.SOROBIX_TEMPLATES_DIR;
  return override && override.trim() ? override.trim() : DEFAULT_TEMPLATES_DIR;
}

export interface TemplateInfo {
  name: TemplateName;
  description: string;
  testCount: number | null;
  available: boolean;
}

// Counted from the template source rather than hardcoded, so the number can
// never drift out of sync with the contract the way a written-down count does.
async function countTests(templateDir: string): Promise<number | null> {
  const testFile = path.join(templateDir, 'src', 'test.rs.template');

  if (!(await fs.pathExists(testFile))) {
    return null;
  }

  const contents = await fs.readFile(testFile, 'utf-8');
  return (contents.match(/^\s*#\[test\]/gm) ?? []).length;
}

export async function discoverTemplates(templatesDir: string): Promise<TemplateInfo[]> {
  return Promise.all(
    VALID_TEMPLATES.map(async (name) => {
      const templateDir = path.join(templatesDir, name);
      const available = await fs.pathExists(templateDir);

      return {
        name,
        description: TEMPLATE_DESCRIPTIONS[name],
        testCount: available ? await countTests(templateDir) : null,
        available,
      };
    })
  );
}
