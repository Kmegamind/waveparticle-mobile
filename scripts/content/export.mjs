// Writes the story content tables back to the files (#284), so a change made in the Supabase
// table editor can be kept in the repository.
//
//   node --env-file=.env scripts/content/export.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and CONTENT_READ_KEY, and reads
// through export_story_content with the same key the server uses. It never prints a value. Only
// files whose content changed are written; then run `npx prettier --write src/content`.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { writeContentFiles } from "./content-files.mjs";

/**
 * @param {{ url: string, anonKey: string, key: string, fetchImpl?: typeof fetch }} options
 */
export async function readContentExport({ url, anonKey, key, fetchImpl = fetch }) {
  const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/export_story_content`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ reader_key: key }),
  });
  if (!response.ok) throw new Error(`export_story_content answered ${response.status}`);
  const document = await response.json();
  if (!document || !Array.isArray(document.companions) || document.companions.length === 0) {
    throw new Error("no story content: check CONTENT_READ_KEY and that the import has run");
  }
  return document;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = process.env.CONTENT_READ_KEY;
  if (!url || !anonKey || !key) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and CONTENT_READ_KEY.",
    );
    process.exit(1);
  }
  const document = await readContentExport({ url, anonKey, key });
  const written = writeContentFiles(
    document,
    process.argv[2] ? path.resolve(process.argv[2]) : undefined,
  );
  console.log(`Wrote ${written.length} files${written.length ? `: ${written.join(", ")}` : ""}.`);
}
