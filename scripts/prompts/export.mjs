// Writes the active prompts in `public.prompts` back to the prompt files (#282), so a change made
// in the Supabase table editor can be kept in the repository.
//
//   node --env-file=.env scripts/prompts/export.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and PROMPTS_READ_TOKEN, and reads
// through get_active_prompts, exactly as the server does. It never prints a value.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PROMPT_KEYS, writePromptFile } from "./prompt-files.mjs";

const defaultDirectory = fileURLToPath(new URL("../../docs/ai/prompts", import.meta.url));

/**
 * @param {{ url: string, anonKey: string, token: string, fetchImpl?: typeof fetch }} options
 */
export async function readActivePrompts({ url, anonKey, token, fetchImpl = fetch }) {
  const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/get_active_prompts`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ reader_token: token }),
  });
  if (!response.ok) throw new Error(`get_active_prompts answered ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("no active prompts: check PROMPTS_READ_TOKEN and that the import has run");
  }
  return rows;
}

/** Writes one file per known key; returns the file names written. */
export function exportPrompts(rows, directory = defaultDirectory) {
  const written = [];
  for (const row of rows) {
    if (!PROMPT_KEYS.includes(row.key)) continue;
    const name = `${row.key}.md`;
    writeFileSync(
      path.join(directory, name),
      writePromptFile({
        key: row.key,
        version: row.version,
        note: row.note ?? "",
        params: row.params,
        body: row.body,
      }),
    );
    written.push(name);
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = process.env.PROMPTS_READ_TOKEN;
  if (!url || !anonKey || !token) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and PROMPTS_READ_TOKEN.",
    );
    process.exit(1);
  }
  const rows = await readActivePrompts({ url, anonKey, token });
  const written = exportPrompts(rows, process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`Wrote ${written.length} prompt files.`);
}
