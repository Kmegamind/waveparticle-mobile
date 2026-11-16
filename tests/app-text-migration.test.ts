import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #288: app text in the database, versioned per key with draft, publish and roll back.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261117000000_app_text.sql";
const sql = () => readFileSync(path.join(migrations, MIGRATION), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");
/** One function's text, from its create line to the end of its body. */
const fn = (name: string) => {
  const start = code().indexOf(`create function ${name}(`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  return code().slice(start, code().indexOf("$$;", start));
};

describe("app text migration (#288)", () => {
  it("test_288_runs_after_the_content_roles_migration", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const roles = names.indexOf("20261116000000_content_roles.sql");
    expect(roles).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(roles);
  });

  it("test_288_ac1_versions_per_key_with_one_published", () => {
    expect(code()).toMatch(/create table public\.app_text \(/);
    expect(code()).toMatch(/key text not null check \(key ~ '\^ui\\\.\[A-Z\]/);
    expect(code()).toMatch(/version integer not null check \(version >= 1\)/);
    expect(code()).toMatch(/published boolean not null default false/);
    expect(code()).toMatch(/primary key \(key, version\)/);
    expect(code()).toMatch(
      /create unique index app_text_one_published_per_key\s+on public\.app_text \(key\) where published;/,
    );
    expect(code()).toMatch(/screen text generated always as \(split_part\(key, '\.', 2\)\) stored/);
  });

  it("test_288_ac1_body_is_never_blank", () => {
    // Any non-space character: a body of only spaces, tabs or new lines is refused.
    expect(code()).toContain("check (body ~ '\\S')");
    expect(code()).toMatch(/check \(char_length\(body\) <= 1000\)/);
  });

  it("test_288_ac1_anyone_reads_published_rows_editors_read_drafts", () => {
    expect(code()).toMatch(/alter table public\.app_text enable row level security;/);
    // Only these columns: who saved or published a version (account ids) is not public.
    expect(code()).toContain(
      "grant select (key, version, body, published, published_at, created_at, screen)\n  on public.app_text to anon, authenticated;",
    );
    expect(code()).not.toMatch(/grant select on public\.app_text/);
    expect(code()).toMatch(
      /create policy app_text_read on public\.app_text\s+for select\s+to anon, authenticated\s+using \(published or \(select public\.is_content_editor\(\)\)\);/,
    );
  });

  it("test_288_ac1_no_direct_writes_through_the_api", () => {
    expect(code()).toMatch(/revoke all on public\.app_text from anon, authenticated;/);
    expect(code()).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/i);
    expect(code()).not.toMatch(/grant (insert|update|delete|all)/i);
  });

  it("test_288_ac1_save_makes_a_new_draft_version_for_editors_only", () => {
    const body = fn("public.save_app_text_draft");
    expect(body).toMatch(/returns integer/);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(body).toMatch(/coalesce\(max\(version\), 0\) \+ 1/);
    expect(body).toMatch(/insert into public\.app_text/);
    expect(code()).toContain(
      "grant execute on function public.save_app_text_draft(text, text) to authenticated;",
    );
  });

  it("test_288_ac1_publish_and_roll_back_share_one_private_function", () => {
    const inner = fn("private.set_published_app_text");
    expect(inner).toMatch(/publish_action text/);
    expect(inner).toMatch(/for update/);
    expect(inner).toMatch(/set published = false/);
    expect(inner).toMatch(/published_at = now\(\)/);
    expect(inner).toMatch(/published_by = auth\.uid\(\)/);
    for (const [name, action] of [
      ["public.publish_app_text", "publish"],
      ["public.roll_back_app_text", "roll_back"],
    ]) {
      const body = fn(name);
      expect(body, name).toMatch(/security definer/);
      expect(body, name).toMatch(/if not public\.is_content_editor\(\) then/);
      expect(body, name).toContain(
        `perform private.set_published_app_text(text_key, text_version, '${action}');`,
      );
      expect(code()).toContain(
        `grant execute on function ${name}(text, integer) to authenticated;`,
      );
    }
    expect(code()).toContain(
      "revoke all on function private.set_published_app_text(text, integer, text) from public, anon, authenticated;",
    );
  });

  it("test_288_ac1_roll_back_only_to_an_earlier_published_version", () => {
    const inner = fn("private.set_published_app_text");
    expect(inner).toMatch(/publish_action = 'roll_back'/);
    expect(inner).toMatch(/text_version >= current_version/);
    expect(inner).toMatch(/target_published_at is null/);
  });

  it("test_288_ac5_import_loads_version_1_published_only_for_a_new_key", () => {
    const body = fn("public.import_app_text");
    expect(body).toMatch(/if exists \(select 1 from public\.app_text where key = text_key\)/);
    expect(body).toMatch(/values \(text_key, 1, text_body, true, now\(\)\)/);
    expect(code()).toContain(
      "revoke all on function public.import_app_text(text, text) from public, anon, authenticated;",
    );
  });

  it("test_288_no_service_role_key", () => {
    expect(sql()).not.toMatch(/service_role|service-role/);
  });
});
