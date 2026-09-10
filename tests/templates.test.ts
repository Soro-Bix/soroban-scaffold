import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUNDLED_TEMPLATES_DIR,
  SIBLING_TEMPLATES_DIR,
  resolveTemplatesDir,
} from '../src/utils/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.join(__dirname, '..');

function isInsidePackage(target: string): boolean {
  const relative = path.relative(PACKAGE_ROOT, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

describe('resolveTemplatesDir', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.SOROBIX_TEMPLATES_DIR;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SOROBIX_TEMPLATES_DIR;
    } else {
      process.env.SOROBIX_TEMPLATES_DIR = original;
    }
  });

  it('prefers SOROBIX_TEMPLATES_DIR over every built-in location', () => {
    process.env.SOROBIX_TEMPLATES_DIR = '/custom/templates';
    expect(resolveTemplatesDir()).toBe('/custom/templates');
  });

  it('trims surrounding whitespace from the override', () => {
    process.env.SOROBIX_TEMPLATES_DIR = '  /custom/templates  ';
    expect(resolveTemplatesDir()).toBe('/custom/templates');
  });

  it('ignores an override that is empty or only whitespace', () => {
    process.env.SOROBIX_TEMPLATES_DIR = '   ';
    expect(resolveTemplatesDir()).not.toBe('   ');
  });

  // The regression this encodes: the default templates directory used to be
  // ../../../soroban-scaffold-templates/templates, which resolves outside the
  // package. That path does not exist for anyone who installed from npm, so a
  // globally installed CLI failed on every scaffold attempt. The bundled
  // directory has to live inside the package for the tarball to be usable.
  it('bundles templates inside the package, not beside it', () => {
    expect(isInsidePackage(BUNDLED_TEMPLATES_DIR)).toBe(true);
    expect(path.basename(BUNDLED_TEMPLATES_DIR)).toBe('templates');
  });

  it('keeps the development fallback outside the package', () => {
    expect(isInsidePackage(SIBLING_TEMPLATES_DIR)).toBe(false);
  });

  it('resolves to a built-in location when no override is set', () => {
    delete process.env.SOROBIX_TEMPLATES_DIR;

    // Which one depends on whether templates have been synced into this
    // checkout, so assert the branch that matches the tree under test rather
    // than requiring a synced copy to run the suite.
    const expected = fs.existsSync(BUNDLED_TEMPLATES_DIR)
      ? BUNDLED_TEMPLATES_DIR
      : SIBLING_TEMPLATES_DIR;

    expect(resolveTemplatesDir()).toBe(expected);
  });
});
