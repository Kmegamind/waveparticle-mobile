/**
 * Prompt templates (#282). A template is plain text with `{{name}}` placeholders.
 *
 * - Each placeholder is filled once from `values`; text that comes in through a value is never
 *   scanned again, so a person's own `{{...}}` reaches the model as typed.
 * - A line is dropped when every placeholder on it has no value (`null` or `undefined`): that is
 *   how optional lines work. An empty string keeps the line.
 * - A placeholder with no entry in `values` at all is an error, so a typo in a prompt row fails
 *   loudly instead of silently losing a line.
 */
export type PromptValue = string | number | null | undefined;

const PLACEHOLDER = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

export function renderPrompt(template: string, values: Record<string, PromptValue>): string {
  const lines: string[] = [];
  for (const line of template.split("\n")) {
    const names = [...line.matchAll(PLACEHOLDER)].map((match) => match[1]);
    for (const name of names) {
      if (!Object.hasOwn(values, name)) throw new Error(`unknown placeholder: ${name}`);
    }
    if (
      names.length > 0 &&
      names.every((name) => values[name] === null || values[name] === undefined)
    ) {
      continue;
    }
    lines.push(line.replace(PLACEHOLDER, (_, name: string) => String(values[name] ?? "")));
  }
  return lines.join("\n");
}

/** Every placeholder name in a template, each once, in order (#308). */
export function placeholderNames(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1]))];
}
