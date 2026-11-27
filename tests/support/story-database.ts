import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// #516: an in-memory Postgres (PGlite) with every migration of supabase/migrations and the
// repository's content and story-card imports (the published placeholder decks), so a test can run
// the SQL the content scripts print, end to end. Nothing here connects to a real database. The
// auth schema and the API roles are minimal stand-ins for the ones Supabase provides.

const root = path.join(import.meta.dirname, "..", "..");

/** The reader key of the stand-in server (private.content_reader holds its SHA-256). */
export const READER_KEY = "invented-reader-key-for-the-database-test";

/** An invented admin account: the switch-over's `--by` names it. */
export const ADMIN = { id: "00000000-0000-4000-8000-0000000005a1", email: "admin@invented.test" };

const AUTH_STAND_IN = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select current_setting('request.jwt.claim.role', true) $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
`;

const printed = (script: string, ...args: string[]) =>
  execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
  });

/** A fresh database: migrations, then Oppenheimer's stories and his published placeholder cards. */
export async function storyDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_STAND_IN);
  const folder = path.join(root, "supabase", "migrations");
  for (const file of readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(
      readFileSync(path.join(folder, file), "utf8").replace(
        /create extension if not exists pgcrypto;/,
        "",
      ),
    );
  }
  await db.exec(printed("scripts/content/import.mjs"));
  await db.exec(printed("scripts/story-cards/import.mjs"));
  const digest = createHash("sha256").update(READER_KEY, "utf8").digest("hex");
  await db.exec(`insert into private.content_reader (token_sha256) values ('${digest}');
insert into auth.users (id, email) values ('${ADMIN.id}', '${ADMIN.email}');`);
  return db;
}

/** Runs SQL; on an error rolls back what is open and returns the message. */
export async function attempt(db: PGlite, sql: string): Promise<string> {
  try {
    await db.exec(sql);
    return "ok";
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    return error instanceof Error ? error.message : String(error);
  }
}

export async function rows<T = Record<string, unknown>>(db: PGlite, sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}

/** The rows of the last statement that returned rows (a printed script's final SELECT). */
export async function lastRows<T = Record<string, unknown>>(db: PGlite, sql: string): Promise<T[]> {
  const results = await db.exec(sql);
  return (results.filter((result) => result.fields.length > 0).at(-1)?.rows ?? []) as T[];
}
