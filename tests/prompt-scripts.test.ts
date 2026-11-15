import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportPrompts, readActivePrompts } from "../scripts/prompts/export.mjs";
import { importSql } from "../scripts/prompts/import.mjs";
import { PROMPT_KEYS, readPromptDirectory } from "../scripts/prompts/prompt-files.mjs";
import { newReaderToken } from "../scripts/prompts/token.mjs";

const seedDirectory = path.join(import.meta.dirname, "..", "docs", "ai", "prompts");

describe("prompt import, export and token scripts (#282)", () => {
  it("test_282_import_loads_every_seed_prompt_in_one_transaction", () => {
    const sql = importSql(readPromptDirectory(seedDirectory));
    expect(sql.startsWith("-- ")).toBe(true);
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    const calls = sql.match(/^select public\.import_prompt\(/gm) ?? [];
    expect(calls).toHaveLength(PROMPT_KEYS.length);
    expect(sql).not.toMatch(/insert into|delete from|drop /i);
  });

  it("test_282_import_quotes_text_that_contains_the_quote_marker", () => {
    const sql = importSql([
      {
        key: "rest_reply",
        version: 1,
        note: "it's",
        params: { a: "$prompt$" },
        body: "He wrote $prompt$ and 'quotes'",
      },
    ]);
    const tag = sql.match(/\$prompt_?\d*\$/g)?.find((found) => found !== "$prompt$");
    expect(tag).toBeDefined();
    expect(sql).toContain(`${tag}He wrote $prompt$ and 'quotes'${tag}`);
  });

  it("test_282_import_refuses_a_key_the_app_does_not_know", () => {
    expect(() =>
      importSql([{ key: "drop table", version: 1, note: "", params: {}, body: "x" }]),
    ).toThrow(/unknown prompt key/);
  });

  it("test_282_export_writes_the_active_rows_back_to_the_same_files", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "prompts-"));
    const seed = readPromptDirectory(seedDirectory);
    const written = exportPrompts(seed, directory);
    expect(written.sort()).toEqual(PROMPT_KEYS.map((key: string) => `${key}.md`).sort());
    for (const name of readdirSync(directory)) {
      expect(readFileSync(path.join(directory, name), "utf8")).toBe(
        readFileSync(path.join(seedDirectory, name), "utf8"),
      );
    }
  });

  it("test_282_export_writes_the_same_files_when_the_database_reorders_json_keys", () => {
    // Postgres jsonb keeps object keys in its own order, not the file's.
    const reorder = (value: unknown): unknown => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([name, inner]) => [name, reorder(inner)]),
      );
    };
    const directory = mkdtempSync(path.join(tmpdir(), "prompts-"));
    const fromDatabase = readPromptDirectory(seedDirectory).map((row: { params: unknown }) => ({
      ...row,
      params: reorder(row.params),
    }));
    exportPrompts(fromDatabase, directory);
    for (const name of readdirSync(directory)) {
      expect(readFileSync(path.join(directory, name), "utf8"), name).toBe(
        readFileSync(path.join(seedDirectory, name), "utf8"),
      );
    }
  });

  it("test_282_export_reads_through_the_reader_function_with_the_token", async () => {
    const seen: { url: string; body: string; apikey: string | null }[] = [];
    const rows = await readActivePrompts({
      url: "http://127.0.0.1:3198",
      anonKey: "anon",
      token: "t",
      fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({
          url: String(input),
          body: String(init?.body),
          apikey: new Headers(init?.headers).get("apikey"),
        });
        return new Response(
          JSON.stringify([{ key: "rest_reply", version: 3, body: "B", params: {}, note: "n" }]),
          { status: 200 },
        );
      },
    });
    expect(rows).toEqual([{ key: "rest_reply", version: 3, body: "B", params: {}, note: "n" }]);
    expect(seen).toEqual([
      {
        url: "http://127.0.0.1:3198/rest/v1/rpc/get_active_prompts",
        body: JSON.stringify({ reader_token: "t" }),
        apikey: "anon",
      },
    ]);
  });

  it("test_282_export_stops_when_the_table_answers_nothing", async () => {
    await expect(
      readActivePrompts({
        url: "http://x",
        anonKey: "a",
        token: "wrong",
        fetchImpl: async () => new Response("[]", { status: 200 }),
      }),
    ).rejects.toThrow(/no active prompts/);
  });

  it("test_282_the_token_script_stores_only_the_hash", () => {
    const { token, sql } = newReaderToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const hash = createHash("sha256").update(token, "utf8").digest("hex");
    expect(sql).toBe(`insert into private.prompt_reader (token_sha256) values ('${hash}');`);
    expect(sql).not.toContain(token);
  });
});
