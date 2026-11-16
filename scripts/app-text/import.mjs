// Turns the app text defaults (src/content/app-text.json, #288) into SQL for `public.app_text`. It
// prints SQL and connects to nothing: paste it into the Supabase SQL editor, or pipe it to psql.
//
//   node scripts/app-text/import.mjs > app-text-import.sql
//   node scripts/app-text/import.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
//
// For each key without rows, import_app_text loads the default as version 1, published. A key that
// already has rows is left alone, so running it twice, or after a writer published an edit,
// changes nothing.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const seedFile = fileURLToPath(new URL("../../src/content/app-text.json", import.meta.url));

/** The same pattern as the migration's check and src/lib/app-text/catalog.ts. */
const KEY = /^ui\.[A-Z][A-Z0-9-]*\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

/** @returns {{ key: string, text: string, note: string }[]} */
export function readAppTextSeed(file = seedFile) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** A dollar-quoted SQL string whose marker does not occur in the text. */
function quote(text) {
  let tag = "$text$";
  for (let n = 1; text.includes(tag); n += 1) tag = `$text_${n}$`;
  return `${tag}${text}${tag}`;
}

/**
 * @param {{ key: string, text: string, note?: string }[]} entries
 * @returns {string}
 */
export function appTextImportSql(entries) {
  const lines = [
    "-- App text defaults from src/content/app-text.json (scripts/app-text/import.mjs, #288).",
    "begin;",
  ];
  for (const entry of entries) {
    if (!KEY.test(entry.key)) throw new Error(`not an app text key: ${entry.key}`);
    if (entry.text.trim() === "") throw new Error(`blank app text: ${entry.key}`);
    lines.push(`select public.import_app_text('${entry.key}', ${quote(entry.text)});`);
  }
  lines.push("commit;", "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.stdout.write(appTextImportSql(readAppTextSeed()));
}
