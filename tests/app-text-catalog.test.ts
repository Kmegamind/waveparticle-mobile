import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appTextImportSql, readAppTextSeed } from "../scripts/app-text/import.mjs";
import {
  APP_TEXT_DEFAULTS,
  APP_TEXT_ENTRIES,
  APP_TEXT_KEYS,
  APP_TEXT_KEY_PATTERN,
  isAppTextKey,
  screenOf,
} from "@/lib/app-text/catalog";

// #288: the first batch of app text keys, their code defaults and the seed that loads them.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
// The docs/api and docs/architecture folders hold one file per item (#242).
const readFolder = (folder: string) =>
  readdirSync(path.join(root, folder))
    .filter((name) => name.endsWith(".md"))
    .map((name) => read(`${folder}/${name}`))
    .join("\n");

/** The strings the screens showed before #288. A screen must look the same with the defaults. */
const BEFORE: Record<string, string> = {
  "ui.F3.fail.body": "He is not here right now. Please try again.",
  "ui.F3.fail.retry": "Retry",
  "ui.F-RET.fail.body": "He is not here right now. Please try again.",
  "ui.F-RET.fail.retry": "Retry",
  "ui.R1.fail.body": "He is not here right now. Please try again.",
  "ui.R1.fail.retry": "Retry",
  "ui.END.fail.body": "He is not here right now. Please try again.",
  "ui.END.fail.retry": "Retry",
  "ui.R-OFF.body": "No connection. You can still go back to your Step.",
  "ui.S1.title": "This is outside the story.",
  "ui.S1.support": "Get support now",
  "ui.S1.back": "Back to my Goal",
  "ui.HOME-0.greeting": "Let’s launch your first wave.",
};

describe("app text catalog (#288)", () => {
  it("test_288_ac4_first_batch_has_10_to_15_keys_with_the_required_ones", () => {
    expect(APP_TEXT_KEYS.length).toBeGreaterThanOrEqual(10);
    expect(APP_TEXT_KEYS.length).toBeLessThanOrEqual(15);
    // The generation failure message and its Retry, the offline message, the safety page's back
    // button and the empty Home greeting.
    for (const key of [
      "ui.F3.fail.body",
      "ui.F3.fail.retry",
      "ui.R-OFF.body",
      "ui.S1.back",
      "ui.HOME-0.greeting",
    ]) {
      expect(APP_TEXT_KEYS).toContain(key);
    }
    expect(new Set(APP_TEXT_KEYS).size).toBe(APP_TEXT_KEYS.length);
  });

  it("test_288_ac4_keys_follow_the_naming_scheme_and_name_a_flow_screen", () => {
    const flow = read("docs/FLOW.md");
    // The migration checks keys with the same pattern.
    expect(read("supabase/migrations/20261117000000_app_text.sql")).toContain(
      APP_TEXT_KEY_PATTERN.source,
    );
    for (const key of APP_TEXT_KEYS) {
      expect(key, key).toMatch(APP_TEXT_KEY_PATTERN);
      expect(flow, key).toContain(`#### ${screenOf(key)} · `);
    }
    expect(screenOf("ui.F-RET.fail.body")).toBe("F-RET");
    expect(isAppTextKey("ui.S1.back")).toBe(true);
    expect(isAppTextKey("ui.S1.nothing")).toBe(false);
    expect(isAppTextKey(7)).toBe(false);
  });

  it("test_288_ac4_defaults_are_the_strings_the_screens_showed_before", () => {
    expect(APP_TEXT_DEFAULTS).toEqual(BEFORE);
    for (const entry of APP_TEXT_ENTRIES) expect(entry.note.length, entry.key).toBeGreaterThan(0);
  });

  it("test_288_ac5_seed_sql_loads_every_default_as_version_1_published", () => {
    const sql = appTextImportSql(readAppTextSeed());
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    const calls = sql.match(/^select public\.import_app_text\(/gm) ?? [];
    expect(calls).toHaveLength(APP_TEXT_KEYS.length);
    for (const [key, text] of Object.entries(BEFORE)) {
      expect(sql).toContain(`select public.import_app_text('${key}', $text$${text}$text$);`);
    }
    expect(sql).not.toMatch(/insert into|update |delete from|drop /i);
  });

  it("test_288_ac5_seed_quotes_text_that_contains_the_quote_marker", () => {
    const sql = appTextImportSql([{ key: "ui.S1.back", text: "a $text$ b", note: "x" }]);
    expect(sql).toContain("$text_1$a $text$ b$text_1$");
    expect(() => appTextImportSql([{ key: "ui.bad", text: "x", note: "x" }])).toThrow(/key/);
  });

  it("test_288_ac5_seed_and_code_read_one_file", () => {
    // One source for the defaults: the code and the seed script read src/content/app-text.json.
    expect(readAppTextSeed()).toEqual(APP_TEXT_ENTRIES);
    // The typed key list and the file name the same keys, in the same order.
    expect(readAppTextSeed().map((entry: { key: string }) => entry.key)).toEqual([
      ...APP_TEXT_KEYS,
    ]);
    expect(read("src/lib/app-text/catalog.ts")).toContain('from "@/content/app-text.json"');
    expect(read("scripts/app-text/import.mjs")).toContain("src/content/app-text.json");
  });
});

describe("app text docs (#288)", () => {
  it("test_288_docs_describe_the_seed_and_the_reader", () => {
    const deploy = read("docs/deploy.md");
    expect(deploy).toContain("20261117000000_app_text.sql");
    expect(deploy).toContain("node scripts/app-text/import.mjs");
    const api = readFolder("docs/api");
    expect(api).toContain("getAppTexts");
    expect(api).toContain("useAppText");
    expect(api).toContain("publish_app_text");
    expect(api).toContain("private.set_published_app_text");
    const architecture = readFolder("docs/architecture");
    expect(architecture).toContain("public.app_text");
    expect(architecture).toContain("src/lib/app-text/");
    const decision = read("docs/decisions/0017-app-text-in-the-database.md");
    expect(decision).toMatch(/Issue: #288/);
    expect(decision).toContain("APP-TEXT");
  });
});
