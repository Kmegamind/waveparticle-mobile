import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #289: the publish history, written in the same transaction as each publish and roll back.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261118000000_publish_history.sql";
const sql = () => readFileSync(path.join(migrations, MIGRATION), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");
/** One function's text, from its create line to the end of its body. */
const fn = (name: string) => {
  const match = code().match(
    new RegExp(`create (or replace )?function ${name.replace(".", "\\.")}\\(`),
  );
  expect(match, name).not.toBeNull();
  const start = match!.index!;
  return code().slice(start, code().indexOf("$$;", start));
};

describe("publish history migration (#289)", () => {
  it("test_289_runs_after_the_app_text_migration", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const appText = names.indexOf("20261117000000_app_text.sql");
    expect(appText).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(appText);
  });

  it("test_289_ac4_one_shared_table_with_kind_key_version_action_who_and_when", () => {
    expect(code()).toMatch(/create table public\.publish_history \(/);
    expect(code()).toMatch(/id bigint generated always as identity primary key/);
    expect(code()).toMatch(/kind text not null check \(kind in \('app_text'\)\)/);
    expect(code()).toMatch(/item_key text not null/);
    expect(code()).toMatch(/version integer not null check \(version >= 1\)/);
    expect(code()).toMatch(/action text not null check \(action in \('publish', 'roll_back'\)\)/);
    expect(code()).toMatch(/acted_by uuid references auth\.users \(id\) on delete set null/);
    expect(code()).toMatch(/acted_at timestamptz not null default now\(\)/);
    expect(code()).toMatch(
      /create index publish_history_acted_at\s+on public\.publish_history \(acted_at desc\);/,
    );
  });

  it("test_289_ac3_only_content_editors_read_the_history", () => {
    expect(code()).toMatch(/alter table public\.publish_history enable row level security;/);
    expect(code()).toMatch(
      /revoke all on public\.publish_history from public, anon, authenticated;/,
    );
    expect(code()).toMatch(/grant select on public\.publish_history to authenticated;/);
    expect(code()).not.toMatch(/grant [^;]*on public\.publish_history to [^;]*anon/);
    expect(code()).toMatch(
      /create policy publish_history_read on public\.publish_history\s+for select\s+to authenticated\s+using \(\(select public\.is_content_editor\(\)\)\);/,
    );
  });

  it("test_289_ac1_rows_cannot_be_written_edited_or_deleted_through_the_api", () => {
    expect(code()).toMatch(
      /revoke insert, update, delete, truncate on public\.publish_history from public, anon, authenticated;/,
    );
    expect(code()).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/i);
    expect(code()).not.toMatch(/grant (insert|update|delete|truncate|all)/i);
  });

  it("test_289_ac1_publish_and_roll_back_write_their_row_in_the_same_transaction", () => {
    const inner = fn("private.set_published_app_text");
    expect(code()).toMatch(/create or replace function private\.set_published_app_text\(/);
    // Still the one place for both actions, still not callable through the API.
    expect(inner).toMatch(/publish_action not in \('publish', 'roll_back'\)/);
    expect(inner).toMatch(/for update/);
    expect(inner).toMatch(/published_by = auth\.uid\(\)/);
    expect(inner).toMatch(
      /insert into public\.publish_history \(kind, item_key, version, action, acted_by\)\s+values \('app_text', text_key, text_version, publish_action, auth\.uid\(\)\);/,
    );
    // The insert comes after the version became the published one, in the same function body.
    expect(inner.indexOf("insert into public.publish_history")).toBeGreaterThan(
      inner.indexOf("set published = true"),
    );
    expect(code()).toContain(
      "revoke all on function private.set_published_app_text(text, integer, text) from public, anon, authenticated;",
    );
  });

  it("test_289_ac2_roll_back_accepts_any_version_published_before", () => {
    const inner = fn("private.set_published_app_text");
    expect(inner).toMatch(/publish_action = 'roll_back'/);
    expect(inner).toMatch(/target_published_at is null/);
    // A version newer than the published one, rolled back past earlier, can be restored.
    expect(inner).not.toMatch(/text_version >= current_version/);
  });

  it("test_289_ac2_ac3_the_list_function_is_for_editors_only_and_newest_first", () => {
    const list = fn("public.list_publish_history");
    expect(list).toMatch(/row_limit integer default 100/);
    expect(list).toMatch(/security definer/);
    expect(list).toMatch(/set search_path = ''/);
    expect(list).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(list).toMatch(/errcode = '42501'/);
    expect(list).toMatch(/left join auth\.users/);
    expect(list).toMatch(/order by h\.acted_at desc, h\.id desc/);
    expect(list).toMatch(/least\(greatest\(coalesce\(row_limit, 100\), 1\), 500\)/);
    expect(list).toMatch(/is_current/);
    expect(code()).toContain(
      "revoke all on function public.list_publish_history(integer) from public, anon, authenticated;",
    );
    expect(code()).toContain(
      "grant execute on function public.list_publish_history(integer) to authenticated;",
    );
  });

  it("test_289_no_service_role_key", () => {
    expect(sql()).not.toMatch(/service_role|service-role/);
  });
});
