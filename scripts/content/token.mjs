// Makes a new reader key for the story content (#284).
//
//   node scripts/content/token.mjs
//
// It prints the key, for the server setting CONTENT_READ_KEY (Vercel and your .env), and one SQL
// line for the Supabase SQL editor that stores only the key's SHA-256. The database never sees the
// key itself.

import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function newContentReadKey() {
  const key = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(key, "utf8").digest("hex");
  return { key, sql: `insert into private.content_reader (token_sha256) values ('${hash}');` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { key, sql } = newContentReadKey();
  console.log("1. Server setting (Vercel Production and Preview, and .env):");
  console.log(`CONTENT_READ_KEY=${key}`);
  console.log("");
  console.log("2. Run once in the Supabase SQL editor:");
  console.log(sql);
}
