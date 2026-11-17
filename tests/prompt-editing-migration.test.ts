import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #308: editing prompts in the admin (database side). Drafts are new versions that are never
// active; only the admin role publishes or rolls back, through public.activate_prompt, with a
// publish_history row in the same transaction.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261125000000_prompt_editing.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => readFileSync(path.join(migrations, MIGRATION), "utf8").replace(/--.*$/gm, "");
const fn = (name: string) => {
  const match = code().match(
    new RegExp(`create (or replace )?function ${name.replace(".", "\\.")}\\(`),
  );
  expect(match, name).not.toBeNull();
  const start = match!.index!;
  return code().slice(start, code().indexOf("$$;", start));
};

describe("prompt editing migration (#308)", () => {
  it("test_308_runs_last_after_story_card_editing_and_content_fields", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.at(-1)).toBe(MIGRATION);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261123000000_story_card_editing.sql"),
    );
    // #310 widened the same kind check and list first, so this file must run after it.
    expect(names).toContain("20261124000000_content_fields.sql");
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261124000000_content_fields.sql"),
    );
  });

  it("test_308_adds_who_and_when_columns_and_backfills_the_active_rows", () => {
    expect(code()).toMatch(
      /add column created_by uuid default auth\.uid\(\) references auth\.users \(id\) on delete set null/,
    );
    expect(code()).toMatch(/add column activated_at timestamptz/);
    expect(code()).toMatch(
      /add column activated_by uuid references auth\.users \(id\) on delete set null/,
    );
    expect(code()).toMatch(/update public\.prompts set activated_at = created_at where active;/);
  });

  it("test_308_ac2_the_list_is_for_content_editors_only", () => {
    const list = fn("public.list_prompt_versions");
    expect(list).toMatch(/security definer/);
    expect(list).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(list).toMatch(/errcode = '42501'/);
    expect(list).toMatch(/activated_at/);
    expect(code()).toMatch(
      /grant execute on function public\.list_prompt_versions\(\) to authenticated;/,
    );
  });

  it("test_308_ac3_save_adds_version_max_plus_one_and_is_never_active", () => {
    const save = fn("public.save_prompt_draft");
    expect(save).toMatch(/returns integer/);
    expect(save).toMatch(/security definer/);
    expect(save).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(save).toMatch(/pg_advisory_xact_lock\(hashtext\('prompt:' \|\| prompt_key\)\)/);
    expect(save).toMatch(/jsonb_typeof\(prompt_params\) is distinct from 'object'/);
    expect(save).toMatch(/errcode = 'P0002'/);
    expect(save).toMatch(/coalesce\(max\(version\), 0\) \+ 1/);
    expect(save).toMatch(
      /insert into public\.prompts \(key, version, body, params, note, created_by\)/,
    );
    expect(save).not.toMatch(/active/);
    expect(save).not.toMatch(/activate_prompt/);
    expect(code()).toMatch(
      /grant execute on function public\.save_prompt_draft\(text, text, jsonb, text\) to authenticated;/,
    );
  });

  it("test_308_ac5_publish_and_roll_back_are_admin_only", () => {
    for (const name of ["public.publish_prompt", "public.roll_back_prompt"]) {
      const body = fn(name);
      expect(body, name).toMatch(/security definer/);
      expect(body, name).toMatch(/if public\.content_role\(\) is distinct from 'admin' then/);
      expect(body, name).toMatch(/errcode = '42501'/);
      expect(body, name).toMatch(/perform private\.set_active_prompt\(/);
      expect(code()).toMatch(
        new RegExp(
          `grant execute on function ${name.replace(".", "\\.")}\\(text, integer\\) to authenticated;`,
        ),
      );
    }
  });

  it("test_308_ac5_set_active_prompt_uses_activate_prompt", () => {
    const set = fn("private.set_active_prompt");
    expect(set).toMatch(/perform 1 from public\.prompts where key = prompt_key for update;/);
    expect(set).toMatch(/is already active/);
    expect(set).toMatch(/target_activated_at is null/);
    expect(set).toMatch(/perform public\.activate_prompt\(prompt_key, prompt_version\);/);
    expect(set).toMatch(/set activated_at = now\(\), activated_by = auth\.uid\(\)/);
    expect(code()).toMatch(
      /revoke all on function private\.set_active_prompt\(text, integer, text\) from public, anon, authenticated;/,
    );
  });

  it("test_308_ac6_history_row_in_the_same_function", () => {
    const set = fn("private.set_active_prompt");
    expect(set).toMatch(
      /insert into public\.publish_history \(kind, item_key, version, action, acted_by\)\s+values \('prompt', prompt_key, prompt_version, publish_action, auth\.uid\(\)\);/,
    );
    // Every kind before it stays (#289, #304, #310), and prompt is added.
    expect(code()).toMatch(
      /add constraint publish_history_kind_check check \(\s*kind in \('app_text', 'story_card', 'companion_field', 'story_field', 'prompt'\)\s*\)/,
    );
    const list = fn("public.list_publish_history");
    for (const kind of ["app_text", "story_card", "companion_field", "story_field"]) {
      expect(list, kind).toMatch(new RegExp(`when '${kind}' then exists`));
    }
    for (const kind of ["companion_field", "story_field"]) {
      expect(list, kind).toMatch(
        new RegExp(`when '${kind}' then exists \\(\\s+select 1 from public\\.content_fields f`),
      );
    }
    expect(code()).toMatch(
      /grant execute on function public\.list_publish_history\(integer\) to authenticated;/,
    );
    expect(list).toMatch(
      /when 'prompt' then exists \(\s*select 1 from public\.prompts p\s+where p\.key = h\.item_key and p\.version = h\.version and p\.active\s*\)/,
    );
  });

  it("test_308_the_server_read_and_the_import_are_unchanged", () => {
    expect(code()).not.toMatch(/get_active_prompts/);
    expect(code()).not.toMatch(/import_prompt/);
    expect(code()).not.toMatch(/function public\.activate_prompt/);
    expect(code()).not.toMatch(/grant [^;]*on public\.prompts to/);
  });
});
