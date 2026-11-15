// The prompt files in docs/ai/prompts (#282): one Markdown file per prompt key, the seed of the
// `public.prompts` table. Shared by the import and export scripts and the e2e Supabase stub.
//
// A file has a JSON settings block (key, version, note, params) and a text block (the prompt).

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** Every prompt the model gateway sends. */
export const PROMPT_KEYS = [
  "plan_split",
  "step_cards",
  "stuck_story",
  "rest_reply",
  "return_popup",
  "closing_line",
  "retry_hints",
];

const SETTINGS_OPEN = "```json\n";
const BODY_OPEN = "```text\n";
const CLOSE = "\n```";

/**
 * @param {{ key: string, version: number, note: string, params: unknown, body: string }} row
 * @returns {string}
 */
export function writePromptFile(row) {
  const settings = { key: row.key, version: row.version, note: row.note, params: row.params };
  return [
    `# Prompt: ${row.key}`,
    "",
    "Edit the prompt or its settings here or in the Supabase table editor; see README.md in this folder.",
    "`{{name}}` is filled in by the app. A line whose values are all missing is left out.",
    "",
    "## Settings",
    "",
    `${SETTINGS_OPEN}${JSON.stringify(settings, null, 2)}${CLOSE}`,
    "",
    "## Prompt",
    "",
    `${BODY_OPEN}${row.body}${CLOSE}`,
    "",
  ].join("\n");
}

/**
 * @param {string} text
 * @returns {{ key: string, version: number, note: string, params: unknown, body: string }}
 */
export function parsePromptFile(text) {
  const settingsStart = text.indexOf(SETTINGS_OPEN);
  const settingsEnd = settingsStart < 0 ? -1 : text.indexOf(CLOSE, settingsStart);
  if (settingsStart < 0 || settingsEnd < 0) throw new Error("missing the settings block");
  const bodyStart = text.indexOf(BODY_OPEN, settingsEnd);
  const bodyEnd = text.lastIndexOf(CLOSE);
  if (bodyStart < 0 || bodyEnd < bodyStart + BODY_OPEN.length) {
    throw new Error("missing the prompt block");
  }
  const settings = JSON.parse(text.slice(settingsStart + SETTINGS_OPEN.length, settingsEnd));
  if (typeof settings.key !== "string" || !Number.isInteger(settings.version)) {
    throw new Error("the settings block needs a key and a whole-number version");
  }
  return {
    key: settings.key,
    version: settings.version,
    note: typeof settings.note === "string" ? settings.note : "",
    params: settings.params ?? {},
    body: text.slice(bodyStart + BODY_OPEN.length, bodyEnd),
  };
}

/** Every prompt file in a folder, sorted by key. README.md is not a prompt. */
export function readPromptDirectory(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => parsePromptFile(readFileSync(path.join(directory, name), "utf8")))
    .sort((a, b) => a.key.localeCompare(b.key));
}
