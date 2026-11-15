// Turns the prompt files into SQL for the `public.prompts` table (#282). It prints SQL and
// connects to nothing: paste it into the Supabase SQL editor, or pipe it to psql.
//
//   node scripts/prompts/import.mjs > prompts-import.sql
//   node scripts/prompts/import.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
//
// For each file, import_prompt adds a new version when the text or settings changed and makes the
// file's content the active version. Running it twice changes nothing.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PROMPT_KEYS, readPromptDirectory } from "./prompt-files.mjs";

const defaultDirectory = fileURLToPath(new URL("../../docs/ai/prompts", import.meta.url));

/** A dollar-quoted SQL string whose marker does not occur in the text. */
function quote(text) {
  let tag = "$prompt$";
  for (let n = 1; text.includes(tag); n += 1) tag = `$prompt_${n}$`;
  return `${tag}${text}${tag}`;
}

/**
 * @param {{ key: string, version?: number, note: string, params: unknown, body: string }[]} rows
 * @returns {string}
 */
export function importSql(rows) {
  const lines = ["-- Prompts from docs/ai/prompts (scripts/prompts/import.mjs, #282).", "begin;"];
  for (const row of rows) {
    if (!PROMPT_KEYS.includes(row.key)) throw new Error(`unknown prompt key: ${row.key}`);
    lines.push(
      `select public.import_prompt('${row.key}', ${quote(row.body)}, ${quote(JSON.stringify(row.params))}::jsonb, ${quote(row.note)});`,
    );
  }
  lines.push("commit;", "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : defaultDirectory;
  process.stdout.write(importSql(readPromptDirectory(directory)));
}
