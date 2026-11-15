// Makes a new reader token for the prompts (#282).
//
//   node scripts/prompts/token.mjs
//
// It prints the token, for the server setting PROMPTS_READ_TOKEN (Vercel and your .env), and one
// SQL line for the Supabase SQL editor that stores only the token's SHA-256. The database never
// sees the token itself.

import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function newReaderToken() {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  return { token, sql: `insert into private.prompt_reader (token_sha256) values ('${hash}');` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { token, sql } = newReaderToken();
  console.log("1. Server setting (Vercel Production and Preview, and .env):");
  console.log(`PROMPTS_READ_TOKEN=${token}`);
  console.log("");
  console.log("2. Run once in the Supabase SQL editor:");
  console.log(sql);
}
