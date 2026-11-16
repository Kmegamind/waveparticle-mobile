import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.join(import.meta.dirname, "..", "supabase", "migrations");
const name = "20261119000000_story_content.sql";
const sql = () => readFileSync(path.join(directory, name), "utf8");
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => sql().replace(/--.*$/gm, "");

/** The body of one SQL function, from its `create function` line to its closing `$$;`. */
function functionBody(fn: string): string {
  const start = code().indexOf(`create function public.${fn}(`);
  expect(start, fn).toBeGreaterThanOrEqual(0);
  const end = code().indexOf("$$;", start);
  return code().slice(start, end);
}

describe("story content migration (#284)", () => {
  it("test_284_runs_after_the_publish_history_migration", () => {
    const names = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.at(-1)).toBe(name);
    expect(names.indexOf(name)).toBeGreaterThan(
      names.indexOf("20261118000000_publish_history.sql"),
    );
  });

  it("test_284_creates_companions_stories_and_story_inputs", () => {
    expect(code()).toMatch(/create table public\.companions \(/);
    expect(code()).toMatch(/create table public\.stories \(/);
    expect(code()).toMatch(/create table public\.story_inputs \(/);
    for (const column of [
      "title text",
      "goal_short text",
      "who text",
      "opening text",
      "period text",
    ]) {
      expect(code()).toContain(column);
    }
    expect(code()).toMatch(/companion_id text not null references public\.companions/);
    expect(code()).toMatch(/unique \(companion_id, sequence\)/);
    // Dates are kept for writers (DATES-ADMIN-ONLY), in the closed table.
    expect(code()).toMatch(/create table public\.story_inputs \([^;]*\bdate text\b/);
    expect(code()).not.toMatch(/description/);
  });

  it("test_284_signed_in_users_can_read_the_display_tables_only", () => {
    for (const table of ["companions", "stories"]) {
      expect(code()).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security;`),
      );
      expect(code()).toMatch(
        new RegExp(
          `create policy \\w+\\s+on public\\.${table} for select to authenticated using \\(true\\);`,
        ),
      );
      expect(code()).toMatch(new RegExp(`grant select on public\\.${table} to authenticated;`));
    }
    expect(code().match(/create policy/g)).toHaveLength(2);
  });

  it("test_284_the_model_inputs_are_closed_to_the_api", () => {
    expect(code()).toMatch(/alter table public\.story_inputs enable row level security;/);
    expect(code()).toMatch(/revoke all on public\.story_inputs from anon, authenticated;/);
    expect(code()).not.toMatch(/on public\.story_inputs for/);
    expect(code()).not.toMatch(/grant [a-z, ]+ on public\.story_inputs/);
  });

  it("test_284_the_reader_key_is_stored_only_as_a_sha256_in_the_private_schema", () => {
    expect(code()).toMatch(/create schema if not exists private;/);
    expect(code()).toMatch(/create table private\.content_reader \(/);
    expect(code()).toMatch(
      /token_sha256 text primary key check \(token_sha256 ~ '\^\[0-9a-f\]\{64\}\$'\)/,
    );
  });

  it("test_284_both_readers_answer_only_to_a_known_key", () => {
    for (const fn of ["get_story_content", "export_story_content"]) {
      const body = functionBody(fn);
      expect(body).toMatch(/security definer/);
      expect(body).toMatch(/set search_path = ''/);
      expect(body).toMatch(/from private\.content_reader r/);
      expect(body).toMatch(/encode\(sha256\(convert_to\(reader_key, 'UTF8'\)\), 'hex'\)/);
      expect(code()).toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\(text\\) from public;`),
      );
      expect(code()).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\(text\\) to anon, authenticated;`),
      );
    }
  });

  it("test_284_the_app_reader_leaves_out_a_story_without_inputs", () => {
    const body = functionBody("get_story_content");
    expect(body).toMatch(/\bjoin public\.story_inputs i on i\.story_id = s\.id/);
    expect(body).not.toMatch(/left join public\.story_inputs/);
  });

  it("test_284_the_app_reader_never_returns_the_date_or_provenance", () => {
    const body = functionBody("get_story_content");
    expect(body).not.toMatch(/\bdate\b/);
    expect(body).not.toMatch(/provenance/);
    for (const field of [
      "goal_short",
      "who",
      "opening",
      "period",
      "facts",
      "forbidden_terms",
      "key_moments",
      "stage_zero",
    ]) {
      expect(body).toContain(field);
    }
  });

  it("test_284_keeps_the_json_order_of_the_stage_zero_file", () => {
    // json (not jsonb) keeps the file's key order, so an export writes the file as it was.
    expect(code()).toMatch(/stage_zero json not null/);
  });
});
