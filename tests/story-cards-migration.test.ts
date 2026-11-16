import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #293 AC1, AC4: the story cards table, one published version per card, read by editors only.

const directory = path.join(import.meta.dirname, "..", "supabase", "migrations");
const name = "20261120000000_story_cards.sql";
const sql = () => readFileSync(path.join(directory, name), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");
/** One table's definition, from its create line to the closing `);`. */
const table = (tableName: string) => {
  const start = code().indexOf(`create table public.${tableName} (`);
  expect(start, tableName).toBeGreaterThanOrEqual(0);
  return code().slice(start, code().indexOf("\n);", start));
};

describe("story cards migration (#293)", () => {
  it("test_293_runs_after_the_story_content_migration", () => {
    const names = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(name)).toBeGreaterThan(names.indexOf("20261119000000_story_content.sql"));
  });

  it("test_293_ac1_each_card_row_has_story_kind_part_slice_order_text_version_and_state", () => {
    const cards = table("story_cards");
    expect(cards).toMatch(/story_id text not null references public\.stories \(id\)/);
    expect(cards).toMatch(/kind text not null check \(kind in \('background', 'part'\)\)/);
    expect(cards).toMatch(/part integer check \(part between 1 and 5\)/);
    expect(cards).toMatch(/slice text check \(slice ~ '\^s\[1-9\]\[0-9\]\*\$'\)/);
    expect(cards).toMatch(/position integer not null check \(position >= 1\)/);
    expect(cards).toMatch(/body text not null check \(body ~ '\\S'\)/);
    expect(cards).toMatch(/version integer not null check \(version >= 1\)/);
    expect(cards).toMatch(/published boolean not null default false/);
    expect(cards).toMatch(/primary key \(key, version\)/);
  });

  it("test_293_ac1_keys_follow_the_frozen_naming", () => {
    const cards = table("story_cards");
    // crd.<story>.<part>.<slot> and crd.<story>.bg, where <story> is <short>.<slug> (NAMING).
    expect(cards).toContain(
      "check (key ~ '^crd\\.[a-z]+\\.[a-z0-9][a-z0-9-]*\\.(bg|p[1-5]\\.c[1-9][0-9]*)$')",
    );
    // The key agrees with the kind: a background card has no part or slice, a part card has both.
    expect(cards).toMatch(
      /check \(\s*\(kind = 'background' and part is null and slice is null and key ~ '\\\.bg\$'\)\s*or \(kind = 'part' and part is not null and slice is not null and key ~ '\\\.p\[1-5\]\\\.c\[0-9\]\+\$'\)\s*\)/,
    );
  });

  it("test_293_ac1_one_published_version_per_card", () => {
    expect(code()).toMatch(
      /create unique index story_cards_one_published_per_key\s+on public\.story_cards \(key\) where published;/,
    );
  });

  it("test_293_ac2_each_part_title_is_stored", () => {
    const parts = table("story_parts");
    expect(parts).toMatch(/story_id text not null references public\.stories \(id\)/);
    expect(parts).toMatch(/part integer not null check \(part between 1 and 5\)/);
    expect(parts).toMatch(/title text not null check \(title ~ '\\S'\)/);
    expect(parts).toMatch(/primary key \(story_id, part\)/);
  });

  it("test_293_ac4_only_content_editors_read_cards_and_parts_through_the_api", () => {
    for (const tableName of ["story_cards", "story_parts"]) {
      expect(code()).toMatch(
        new RegExp(`alter table public\\.${tableName} enable row level security;`),
      );
      expect(code()).toMatch(
        new RegExp(`revoke all on public\\.${tableName} from anon, authenticated;`),
      );
      expect(code()).toMatch(
        new RegExp(
          `create policy \\w+ on public\\.${tableName}\\s+for select\\s+to authenticated\\s+using \\(\\(select public\\.is_content_editor\\(\\)\\)\\);`,
        ),
      );
    }
    // No anon access at all, and the published rows are not readable by every account.
    expect(code()).not.toMatch(/to anon/);
    expect(code()).not.toMatch(/using \(published/);
    expect(code().match(/create policy/g)).toHaveLength(2);
  });

  it("test_293_read_only_nothing_is_written_through_the_api", () => {
    expect(code()).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/i);
    expect(code()).not.toMatch(/grant (insert|update|delete|all)/i);
    // No write functions in this issue (editing and publishing are Phase 4).
    expect(code()).not.toMatch(/create function/);
  });
});
