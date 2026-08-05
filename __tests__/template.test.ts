import { describe, it, expect } from '@jest/globals';
import { renderTemplate } from '../src/utils/template.js';

describe('renderTemplate', () => {
  it('substitutes PROJECT_NAME and AUTHOR variables', () => {
    const result = renderTemplate('name = "{{PROJECT_NAME}}"\nauthors = ["{{AUTHOR}}"]', {
      projectName: 'my-contract',
      author: 'Jane Doe',
    });

    expect(result).toBe('name = "my-contract"\nauthors = ["Jane Doe"]');
  });

  it('renders unknown variables as empty string instead of throwing', () => {
    const context = { projectName: 'x', author: 'y' };

    expect(() => renderTemplate('{{UNKNOWN_VAR}}', context)).not.toThrow();
    expect(renderTemplate('{{UNKNOWN_VAR}}', context)).toBe('');
  });

  it('returns an empty string for an empty template', () => {
    expect(renderTemplate('', { projectName: 'x', author: 'y' })).toBe('');
  });

  it('does not HTML-escape special characters', () => {
    const result = renderTemplate('authors = ["{{AUTHOR}}"]', {
      projectName: 'x',
      author: "O'Brien & Co",
    });

    expect(result).toBe('authors = ["O\'Brien & Co"]');
  });
});
