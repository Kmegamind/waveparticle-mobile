import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #304: editing, checking and publishing story cards in the admin (database side).

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261123000000_story_card_editing.sql";
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

describe("story card editing migration (#304)", () => {
  it("test_304_runs_after_the_story_cards_and_premade_cards_migrations", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names).toContain(MIGRATION);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261121000000_premade_cards.sql"),
    );
  });

  it("test_304_ac1_a_save_adds_a_new_unpublished_version_and_never_touches_the_published_one", () => {
    const save = fn("public.save_story_card_draft");
    expect(save).toMatch(/returns integer/);
    expect(save).toMatch(/security definer/);
    expect(save).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(save).toMatch(/pg_advisory_xact_lock\(hashtext\('story_card:' \|\| card_key\)\)/);
    expect(save).toMatch(/coalesce\(max\(version\), 0\) \+ 1/);
    // A draft: published false, no published_at, so the pinned read (#300) never returns it.
    expect(save).toMatch(
      /insert into public\.story_cards \(\s*key, version, story_id, kind, part, slice, position, body, created_by\s*\)/,
    );
    expect(save).not.toMatch(/published/);
    expect(save).not.toMatch(/update public\.story_cards/);
    expect(save).toMatch(/errcode = 'P0002'/);
    expect(code()).toMatch(
      /grant execute on function public\.save_story_card_draft\(text, text\) to authenticated;/,
    );
  });

  it("test_304_ac2_editors_save_part_titles_of_existing_parts", () => {
    const title = fn("public.save_story_part_title");
    expect(title).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(title).toMatch(/update public\.story_parts\s+set title = part_title/);
    expect(title).toMatch(/if not found then/);
    expect(code()).toMatch(
      /grant execute on function public\.save_story_part_title\(text, integer, text\) to authenticated;/,
    );
  });

  it("test_304_ac5_only_the_admin_role_publishes_or_rolls_back", () => {
    for (const name of ["public.publish_story_card", "public.roll_back_story_card"]) {
      const body = fn(name);
      expect(body, name).toMatch(/if public\.content_role\(\) is distinct from 'admin' then/);
      expect(body, name).toMatch(/errcode = '42501'/);
      expect(body, name).toMatch(/perform private\.set_published_story_card\(/);
    }
  });

  it("test_304_ac6_publish_writes_one_history_row_of_kind_story_card_in_the_same_transaction", () => {
    const set = fn("private.set_published_story_card");
    expect(set).toMatch(/perform 1 from public\.story_cards where key = card_key for update;/);
    expect(set).toMatch(
      /update public\.story_cards set published = false\s+where key = card_key and published;/,
    );
    expect(set).toMatch(
      /set published = true, published_at = now\(\), published_by = auth\.uid\(\)/,
    );
    expect(set).toMatch(
      /insert into public\.publish_history \(kind, item_key, version, action, acted_by\)\s+values \('story_card', card_key, card_version, publish_action, auth\.uid\(\)\);/,
    );
    expect(set).toMatch(/target_published_at is null/);
    expect(code()).toMatch(
      /revoke all on function private\.set_published_story_card\(text, integer, text\) from public, anon, authenticated;/,
    );
  });

  it("test_304_ac7_the_history_accepts_story_cards_and_knows_the_current_version", () => {
    expect(code()).toMatch(/drop constraint publish_history_kind_check/);
    expect(code()).toMatch(/check \(kind in \('app_text', 'story_card'\)\)/);
    const list = fn("public.list_publish_history");
    expect(list).toMatch(
      /when 'story_card' then exists \(\s*select 1 from public\.story_cards c\s+where c\.key = h\.item_key and c\.version = h\.version and c\.published\s*\)/,
    );
    expect(list).toMatch(/when 'app_text' then exists/);
    expect(list).toMatch(/if not public\.is_content_editor\(\) then/);
  });

  it("test_304_ac8_the_phone_read_and_pinning_are_unchanged", () => {
    expect(code()).not.toMatch(/get_story_cards/);
    expect(code()).not.toMatch(/card_versions/);
    expect(code()).not.toMatch(/grant [^;]*on public\.story_cards to/);
  });
});
