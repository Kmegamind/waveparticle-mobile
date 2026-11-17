import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #300 AC1, AC4: the server reads a story's published cards (or a session's pinned versions)
// through a keyed function; the session records the versions it used.

const directory = path.join(import.meta.dirname, "..", "supabase", "migrations");
const name = "20261121000000_premade_cards.sql";
const code = () => readFileSync(path.join(directory, name), "utf8").replace(/--.*$/gm, "");
const reader = () => {
  const start = code().indexOf("create function public.get_story_cards(");
  expect(start).toBeGreaterThanOrEqual(0);
  return code().slice(start, code().indexOf("$$;", start));
};

describe("pre-made cards migration (#300)", () => {
  it("test_300_runs_after_the_story_cards_migration", () => {
    const names = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(name)).toBeGreaterThan(names.indexOf("20261120000000_story_cards.sql"));
  });

  it("test_300_ac4_a_session_records_the_card_versions_it_used", () => {
    expect(code()).toMatch(
      /alter table public\.sessions\s+add column card_versions jsonb\s+check \(card_versions is null or jsonb_typeof\(card_versions\) = 'object'\);/,
    );
  });

  it("test_300_ac1_the_reader_answers_only_to_the_content_reader_key", () => {
    const body = reader();
    expect(body).toMatch(/reader_key text, story text, versions jsonb default null/);
    expect(body).toMatch(/returns json/);
    expect(body).toMatch(/security definer/);
    expect(body).toMatch(/set search_path = ''/);
    expect(body).toContain(
      "where r.token_sha256 = encode(sha256(convert_to(reader_key, 'UTF8')), 'hex')",
    );
    expect(code()).toContain(
      "revoke all on function public.get_story_cards(text, text, jsonb) from public;",
    );
    expect(code()).toContain(
      "grant execute on function public.get_story_cards(text, text, jsonb) to anon, authenticated;",
    );
  });

  it("test_300_ac1_published_rows_or_the_pinned_versions_only", () => {
    const body = reader();
    expect(body).toMatch(/c\.story_id = story/);
    expect(body).toMatch(/versions is null and c\.published/);
    // Review: a user may write their own session's card_versions, so a pinned read returns only
    // versions that were published at some point, never a draft.
    expect(body).toMatch(
      /versions is not null and c\.published_at is not null and \(versions ->> c\.key\)::integer = c\.version/,
    );
    for (const field of ["'key'", "'version'", "'kind'", "'part'", "'position'", "'body'"]) {
      expect(body).toContain(field);
    }
  });

  it("test_300_ac1_the_card_tables_stay_closed_to_the_browser", () => {
    expect(code()).not.toMatch(/create policy/);
    expect(code()).not.toMatch(/grant (select|insert|update|delete|all)/i);
  });
});
