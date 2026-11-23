import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #117 AC3 (SAFETY-ALARM): one row per day counts the classifier's failures, so every server
// instance shares "at most one alarm a day". No text a person wrote is stored.

const directory = path.join(import.meta.dirname, "..", "supabase", "migrations");
const name = "20261127000000_safety_alarm_days.sql";
const code = () => readFileSync(path.join(directory, name), "utf8").replace(/--.*$/gm, "");

describe("safety alarm migration (#117)", () => {
  it("test_117_runs_after_the_prompts_migration", () => {
    const names = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(name)).toBeGreaterThan(names.indexOf("20261115000000_prompts.sql"));
  });

  it("test_117_the_table_holds_a_day_a_count_and_when_the_alarm_went_only", () => {
    const table = /create table private\.safety_alarm_days \(([\s\S]*?)\n\);/.exec(code())?.[1];
    expect(table).toBeDefined();
    const columns = table!
      .split("\n")
      .map((line) => line.trim().split(" ")[0])
      .filter(Boolean);
    expect(columns).toEqual(["day", "failures", "alarm_sent_at"]);
  });

  it("test_117_only_the_server_token_may_count_and_the_first_call_of_a_day_sends", () => {
    const sql = code();
    expect(sql).toMatch(
      /create function public\.record_safety_classifier_failure\(reader_token text\)/,
    );
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/from private\.prompt_reader/);
    expect(sql).toMatch(/on conflict \(day\) do update/);
    expect(sql).toMatch(
      /revoke all on function public\.record_safety_classifier_failure\(text\) from public;/,
    );
  });
});
