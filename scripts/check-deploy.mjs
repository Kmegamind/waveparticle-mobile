// `npm run check:deploy` (#189): checks a deployment at E2E_BASE_URL. One line per check, OK, FAIL
// or SKIPPED, each a plain sentence; exit 1 on any FAIL, or when the database check is skipped
// without --skip-db. Never prints a token, a key or a response body.
//
// Settings (environment variables, never in the repository):
//   E2E_BASE_URL           the deployment, for example https://waveparticle-mobile.vercel.app
//   SUPABASE_PROJECT_REF   the Supabase project the deployment uses (dev or prod)
//   SUPABASE_ACCESS_TOKEN  the personal access token of the human who runs the check
//   SUPABASE_API_URL       only for tests: a local stand-in for https://api.supabase.com
//   VERCEL_AUTOMATION_BYPASS_SECRET  optional: lets the check through Vercel Deployment
//                          Protection on a Preview (sent as x-vercel-protection-bypass, never printed),
//                          only to https waveparticle-mobile(-*).vercel.app hosts or those listed in
//   VERCEL_BYPASS_HOSTS    optional: comma-separated extra host names (a custom domain on Vercel)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSite, compareTables, expectedTables, readLiveTables } from "./deploy-check.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDb = process.argv.includes("--skip-db");
const env = process.env;
let failed = false;
const ok = (text) => console.log(`OK: ${text}`);
const fail = (text) => {
  failed = true;
  console.log(`FAIL: ${text}`);
};

const baseUrl = env.E2E_BASE_URL;
if (!baseUrl) {
  fail("E2E_BASE_URL is not set. Run: E2E_BASE_URL=https://<the address> npm run check:deploy");
} else {
  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET || undefined;
  const bypassHosts = (env.VERCEL_BYPASS_HOSTS ?? "").split(",");
  for (const result of await checkSite(baseUrl, fetch, { bypassSecret, bypassHosts })) {
    if (result.ok) ok(result.message);
    else fail(result.message);
  }
}

if (skipDb) {
  console.log("SKIPPED: database (--skip-db). Tables and row-level security were not checked.");
} else if (!env.SUPABASE_PROJECT_REF || !env.SUPABASE_ACCESS_TOKEN) {
  const missing = ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN"].filter((name) => !env[name]);
  fail(
    `the database was not checked: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set (docs/HUMAN_STEPS.md, Run the post-deploy check). Add --skip-db to check the website only.`,
  );
} else if (
  env.SUPABASE_API_URL &&
  !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(env.SUPABASE_API_URL)
) {
  // The stand-in is for tests only: the token is never sent anywhere but api.supabase.com or this machine.
  fail(
    "SUPABASE_API_URL may only point at this machine (http://127.0.0.1:<port>). Unset it to use api.supabase.com.",
  );
} else {
  const dir = path.join(root, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const expected = expectedTables(files.map((name) => readFileSync(path.join(dir, name), "utf8")));
  try {
    const rows = await readLiveTables({
      ref: env.SUPABASE_PROJECT_REF,
      token: env.SUPABASE_ACCESS_TOKEN,
      apiUrl: env.SUPABASE_API_URL || undefined,
    });
    const errors = compareTables(expected, rows);
    errors.forEach(fail);
    if (errors.length === 0) {
      ok(
        `the database has all ${expected.size} tables of the migrations, with row-level security where they turn it on`,
      );
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : "the database check failed.");
  }
}

process.exit(failed ? 1 : 0);
