import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list } from '../src/commands/list.js';
import { discoverTemplates, VALID_TEMPLATES } from '../src/utils/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_TEMPLATES_DIR = path.join(__dirname, 'fixtures', 'templates');

describe('list command', () => {
  let logSpy: ReturnType<typeof jest.spyOn>;
  let originalTemplatesDirEnv: string | undefined;

  beforeEach(() => {
    originalTemplatesDirEnv = process.env.SOROBIX_TEMPLATES_DIR;
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (originalTemplatesDirEnv === undefined) {
      delete process.env.SOROBIX_TEMPLATES_DIR;
    } else {
      process.env.SOROBIX_TEMPLATES_DIR = originalTemplatesDirEnv;
    }
  });

  function output(): string {
    return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
  }

  it('lists every template name with its description', async () => {
    await list(FIXTURE_TEMPLATES_DIR);
    const text = output();

    for (const name of VALID_TEMPLATES) {
      expect(text).toContain(name);
    }
    expect(text).toContain('SEP-41 fungible token');
    expect(text).toContain('Milestone-based escrow');
    expect(text).toContain('Non-fungible token');
  });

  it('reports the test count counted from each template', async () => {
    await list(FIXTURE_TEMPLATES_DIR);
    const text = output();

    expect(text).toContain('2 tests');
    expect(text).toContain('3 tests');
    expect(text).toContain('1 tests');
  });

  it('shows the templates directory being used', async () => {
    await list(FIXTURE_TEMPLATES_DIR);
    expect(output()).toContain(FIXTURE_TEMPLATES_DIR);
  });

  it('honors SOROBIX_TEMPLATES_DIR when no directory is passed', async () => {
    process.env.SOROBIX_TEMPLATES_DIR = FIXTURE_TEMPLATES_DIR;

    await list();

    expect(output()).toContain(FIXTURE_TEMPLATES_DIR);
  });

  it('marks templates that are missing from the directory rather than crashing', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sorobix-empty-'));

    try {
      await list(emptyDir);
      const text = output();

      expect(text).toContain('not found');
      expect(text).toContain('basic');
    } finally {
      await fs.remove(emptyDir);
    }
  });
});

describe('discoverTemplates', () => {
  it('counts tests from each template source', async () => {
    const templates = await discoverTemplates(FIXTURE_TEMPLATES_DIR);
    const byName = Object.fromEntries(templates.map((t) => [t.name, t]));

    expect(byName.basic.testCount).toBe(2);
    expect(byName.token.testCount).toBe(3);
    expect(byName.escrow.testCount).toBe(1);
    expect(byName.nft.testCount).toBe(4);
    expect(byName.basic.available).toBe(true);
  });

  it('marks templates unavailable when the directory does not exist', async () => {
    const templates = await discoverTemplates('/nonexistent/templates/path');

    // Derived rather than hardcoded so adding a template does not silently
    // leave this assertion checking a stale number.
    expect(templates).toHaveLength(VALID_TEMPLATES.length);
    for (const template of templates) {
      expect(template.available).toBe(false);
      expect(template.testCount).toBeNull();
    }
  });
});
