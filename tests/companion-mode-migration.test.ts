import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #302 AC4: each Companion's mode (FICTION-RULES) and key code (NAMING) in public.companions.

const directory = path.join(import.meta.dirname, "..", "supabase", "migrations");
const name = "20261122000000_companion_mode.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => readFileSync(path.join(directory, name), "utf8").replace(/--.*$/gm, "");

describe("companion mode migration (#302)", () => {
  it("test_302_ac4_runs_after_the_story_content_migration", () => {
    const names = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(name)).toBeGreaterThan(names.indexOf("20261119000000_story_content.sql"));
  });

  it("test_302_ac4_adds_mode_and_key_code_not_null_with_checks", () => {
    expect(code()).toMatch(/add column mode text check \(mode in \('historical', 'fictional'\)\)/);
    expect(code()).toMatch(/add column key_code text check \(key_code ~ '\^\[a-z\]\{2,8\}\$'\)/);
    expect(code()).toMatch(/alter column mode set not null/);
    expect(code()).toMatch(/alter column key_code set not null/);
    expect(code()).toMatch(/unique \(key_code\)/);
  });

  it("test_302_ac4_seeds_oppenheimer_historical_and_moriarty_fictional", () => {
    expect(code()).toMatch(/set mode = 'historical', key_code = 'opp' where id = 'oppenheimer'/);
    expect(code()).toMatch(/set mode = 'fictional', key_code = 'mor' where id = 'moriarty'/);
  });

  it("test_302_ac4_the_export_returns_both_and_keeps_its_reader_key", () => {
    expect(code()).toMatch(/create or replace function public\.export_story_content\(/);
    expect(code()).toMatch(/'mode', c\.mode, 'key_code', c\.key_code/);
    expect(code()).toMatch(/from private\.content_reader r/);
    expect(code()).toMatch(/security definer\s+set search_path = ''/);
    expect(code()).not.toMatch(/get_story_content/);
  });
});
