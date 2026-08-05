import fs from 'fs-extra';
import path from 'node:path';
import { renderTemplate, type TemplateContext } from './template.js';

const TEMPLATE_EXT = '.template';

export function createProjectDir(projectName: string): string {
  const destDir = path.join(process.cwd(), projectName);

  if (fs.existsSync(destDir)) {
    throw new Error(`Directory "${projectName}" already exists`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  return destDir;
}

export async function copyTemplate(
  templateDir: string,
  destDir: string,
  context: TemplateContext
): Promise<void> {
  const entries = await fs.readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name);
    const destName = entry.name.endsWith(TEMPLATE_EXT)
      ? entry.name.slice(0, -TEMPLATE_EXT.length)
      : entry.name;
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      await fs.ensureDir(destPath);
      await copyTemplate(srcPath, destPath, context);
    } else {
      const content = await fs.readFile(srcPath, 'utf-8');
      await fs.writeFile(destPath, renderTemplate(content, context), 'utf-8');
    }
  }
}
