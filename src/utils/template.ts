import Handlebars from 'handlebars';

export interface TemplateContext {
  projectName: string;
  author: string;
}

/**
 * Templates use SCREAMING_SNAKE placeholders ({{PROJECT_NAME}}, {{AUTHOR}})
 * while call sites use a camelCase context, so both spellings are exposed
 * to Handlebars. noEscape avoids HTML-entity escaping, which would corrupt
 * quotes/apostrophes in Cargo.toml and Rust source.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) {
    return '';
  }

  const compiled = Handlebars.compile(template, { noEscape: true, strict: false });

  return compiled({
    ...context,
    PROJECT_NAME: context.projectName,
    AUTHOR: context.author,
  });
}
