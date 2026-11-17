import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readContentRows } from "../scripts/content/content-files.mjs";
import { readContentExport } from "../scripts/content/export.mjs";
import { importSql } from "../scripts/content/import.mjs";
import { newContentReadKey } from "../scripts/content/token.mjs";

const root = path.join(import.meta.dirname, "..");

describe("story content scripts (#284)", () => {
  it("test_284_import_upserts_every_companion_story_and_input_row_in_one_transaction", () => {
    const sql = importSql(readContentRows(root));
    expect(sql.startsWith("-- Story content")).toBe(true);
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql.match(/insert into public\.companions /g)).toHaveLength(2);
    expect(sql.match(/insert into public\.stories /g)).toHaveLength(26);
    expect(sql.match(/insert into public\.story_inputs /g)).toHaveLength(26);
    expect(sql.match(/on conflict \(id\) do update set/g)).toHaveLength(28);
    expect(sql.match(/on conflict \(story_id\) do update set/g)).toHaveLength(26);
    // Moriarty is a Companion with no stories.
    expect(sql).toMatch(/insert into public\.companions .*\n?.*'moriarty'/);
    const storyRows = sql
      .split("\n")
      .filter((line) => line.startsWith("insert into public.stories "));
    expect(storyRows.some((line) => line.includes("moriarty"))).toBe(false);
  });

  it("test_309_ac6_import_keeps_the_fields_edited_in_the_admin", () => {
    const sql = importSql(readContentRows(root));
    const statements = sql.split(";\n");
    const updatesOf = (table: string) =>
      statements
        .filter((statement) => statement.startsWith(`insert into public.${table} `))
        .map((statement) => statement.slice(statement.indexOf("do update set")));
    const companionUpdates = updatesOf("companions");
    const storyUpdates = updatesOf("stories");
    expect(companionUpdates).toHaveLength(2);
    expect(storyUpdates).toHaveLength(26);
    for (const update of companionUpdates) {
      expect(update).not.toMatch(/\b(name|tags) = excluded/);
      expect(update).toMatch(/\bline = excluded\.line/);
    }
    for (const update of storyUpdates) {
      expect(update).not.toMatch(/\b(title|period|goal_short|who|opening) = excluded/);
      expect(update).toMatch(/\bsequence = excluded\.sequence/);
    }
    // A new row still gets every field from the files.
    expect(sql).toMatch(/insert into public\.stories \(id, companion_id, sequence, title, period/);
  });

  it("test_284_import_quotes_text_that_contains_quotes_and_dollar_signs", () => {
    const rows = readContentRows(root);
    rows.stories[0].title = "It's $content$ and $$ here";
    expect(importSql(rows)).toContain("'It''s $content$ and $$ here'");
  });

  it("test_284_import_text_ending_like_a_quote_marker_cannot_end_the_string", () => {
    // Review finding: "evil $content" next to a $content$ marker closed the string early.
    const rows = readContentRows(root);
    rows.stories[0].title = "evil $content";
    rows.companions[0].line = "x'); select 1; --";
    const sql = importSql(rows);
    expect(sql).toContain("'evil $content'");
    expect(sql).toContain("'x''); select 1; --'");
    expect(sql).not.toMatch(/\$content\$/);
  });

  it("test_284_import_refuses_a_story_without_a_companion", () => {
    const rows = readContentRows(root);
    rows.stories[0].companion_id = "nobody";
    expect(() => importSql(rows)).toThrow(/nobody/);
  });

  it("test_284_the_token_script_gives_the_database_only_the_hash", () => {
    const { key, sql } = newContentReadKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    const hash = createHash("sha256").update(key, "utf8").digest("hex");
    expect(sql).toBe(`insert into private.content_reader (token_sha256) values ('${hash}');`);
    expect(sql).not.toContain(key);
  });

  it("test_284_export_reads_through_the_keyed_function_with_the_public_key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const answer = { companions: [{ id: "oppenheimer" }], stories: [], story_inputs: [] };
    const document = await readContentExport({
      url: "https://example.supabase.co/",
      anonKey: "public-key",
      key: "reader-key",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify(answer), { status: 200 });
      },
    });
    expect(document).toEqual(answer);
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/export_story_content");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ reader_key: "reader-key" });
  });

  it("test_284_export_refuses_an_empty_answer_from_a_wrong_key", async () => {
    await expect(
      readContentExport({
        url: "https://example.supabase.co",
        anonKey: "public-key",
        key: "wrong",
        fetchImpl: async () => new Response("null", { status: 200 }),
      }),
    ).rejects.toThrow(/CONTENT_READ_KEY/);
  });
});
