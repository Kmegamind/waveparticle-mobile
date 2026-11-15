import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #287: the admin and writer roles, the server-side role check and the admin shell.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261116000000_content_roles.sql";
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const sql = () => readFileSync(path.join(migrations, MIGRATION), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");
const fn = (name: string) => {
  const start = code().indexOf(`create function public.${name}()`);
  expect(start).toBeGreaterThanOrEqual(0);
  return code().slice(start, code().indexOf("$$;", start));
};

describe("content roles migration (#287)", () => {
  it("test_287_is_the_latest_migration", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.at(-1)).toBe(MIGRATION);
  });

  it("test_287_ac1_creates_the_roles_table_with_admin_and_writer", () => {
    expect(code()).toMatch(/create table public\.content_roles \(/);
    expect(code()).toMatch(
      /user_id uuid primary key references auth\.users \(id\) on delete cascade/,
    );
    expect(code()).toMatch(/role text not null check \(role in \('admin', 'writer'\)\)/);
  });

  it("test_287_ac1_row_level_security_is_on_and_the_api_cannot_reach_the_table", () => {
    expect(code()).toMatch(/alter table public\.content_roles enable row level security;/);
    expect(code()).not.toMatch(/create policy/i);
    expect(code()).toMatch(/revoke all on public\.content_roles from anon, authenticated;/);
  });

  it("test_287_ac1_content_role_is_a_security_definer_function_with_a_fixed_search_path", () => {
    const body = fn("content_role");
    expect(body).toMatch(/returns text/);
    expect(body).toMatch(/stable/);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/from public\.content_roles/);
    expect(body).toMatch(/user_id = auth\.uid\(\)/);
    expect(code()).toContain("revoke all on function public.content_role() from public, anon;");
    expect(code()).toContain("grant execute on function public.content_role() to authenticated;");
  });

  it("test_287_ac1_is_content_editor_answers_from_content_role", () => {
    const body = fn("is_content_editor");
    expect(body).toMatch(/returns boolean/);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/public\.content_role\(\) is not null/);
    expect(code()).toContain(
      "revoke all on function public.is_content_editor() from public, anon;",
    );
    expect(code()).toContain(
      "grant execute on function public.is_content_editor() to authenticated;",
    );
  });

  it("test_287_ac4_no_service_role_key_is_mentioned", () => {
    expect(sql()).not.toMatch(/service_role|service-role/);
  });
});
