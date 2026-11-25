import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { companionRow } from "@/lib/admin/companion-rows";
import { rollBackMessage } from "@/lib/admin/roll-back-message";
import { fieldProblems, type FieldKey } from "@/lib/content-fields/fields";
import { contentFieldProblems } from "@/lib/content-fields/reader";
import { writeContentField } from "@/lib/content-fields/write";
import { promptDetail, writePrompt, type PromptVersionRow } from "@/lib/prompts/admin";
import { seedRows } from "./support/seed-prompts";

// #317: the leftovers of the reviews of #314 (admin look), #311 (prompts) and #310 (Companion and
// story fields).

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("#314 leftovers", () => {
  const story = { id: "s1", companion_id: "c1" };
  const change = (acted_at: string) => ({
    kind: "companion_field",
    item_key: "chr.opp.name",
    person: "ann@example.com",
    acted_at,
  });

  it("test_317_ac1_an_unreadable_last_change_date_is_shown_whole", () => {
    const row = companionRow({ id: "c1", key_code: "opp" }, [story], [change("not a date")]);
    expect(row.lastChange).toBe("ann@example.com · not a date");
  });

  it("test_317_ac1_a_readable_last_change_date_stays_short", () => {
    const row = companionRow(
      { id: "c1", key_code: "opp" },
      [story],
      [change("2026-11-18T23:42:00Z")],
    );
    expect(row.lastChange).toBe("ann@example.com · 11-18");
  });

  it("test_317_ac2_the_publish_history_table_has_a_name", () => {
    const page = read("src/app/admin/publish-history/page.tsx");
    expect(page).toMatch(/<table aria-label="Publish history" className="admin-table">/);
  });

  it("test_317_ac4_the_orphan_admin_comment_in_tokens_is_gone", () => {
    expect(read("src/app/tokens.css")).not.toContain(
      "The content admin (issue 287): the menu rail on wide screens and the longest text line.",
    );
  });
});

describe("#311 leftovers: prompt versions made active outside the admin", () => {
  const migrations = readdirSync(path.join(root, "supabase/migrations")).sort();
  const file = migrations.find((name) => name.endsWith("_prompt_activated_at.sql"));
  const sql = file ? read(`supabase/migrations/${file}`) : "";

  it("test_317_ac5_the_migration_is_numbered_after_every_other_one", () => {
    expect(file).toBeDefined();
    // Was "the latest migration"; #117 adds a later one (the safety alarm days) and #118 the
    // hotlines, #114 the research flag. It must still run after every migration that existed when
    // it was written.
    const after = migrations.filter((name) => name > file!);
    expect(after).toEqual([
      "20261127000000_safety_alarm_days.sql",
      "20261128000000_hotlines.sql",
      "20261129000000_research_conditions.sql",
    ]);
  });

  it("test_317_ac5_a_trigger_fills_activated_at_only_when_empty", () => {
    expect(sql).toMatch(
      /create trigger \w+\s+before insert or update of active on public\.prompts/,
    );
    expect(sql).toMatch(/new\.active and new\.activated_at is null/);
    // Never overwrites a value already set: the one assignment sits under the empty check.
    expect(sql.match(/new\.activated_at\s*:=/g)).toHaveLength(1);
    expect(sql).toMatch(
      /if new\.active and new\.activated_at is null then\s+new\.activated_at := now\(\);/,
    );
  });

  it("test_317_ac5_the_version_active_now_gets_its_latest_publish_time_or_its_created_time", () => {
    expect(sql).toMatch(/where p\.active and p\.activated_at is null/);
    expect(sql).toMatch(/h\.action = 'publish'/);
    expect(sql).toMatch(/coalesce\(\s*\(\s*select max\(h\.acted_at\)/);
    expect(sql).toMatch(/p\.created_at\s*\)/);
  });

  it("test_317_ac5_publish_history_and_its_kinds_are_not_touched", () => {
    expect(sql).not.toMatch(
      /(insert into|update|delete from|alter table)\s+public\.publish_history/,
    );
    expect(sql).not.toContain("publish_history_kind_check");
  });

  // A version the gateway can use, so only its history decides.
  const seed = seedRows().find((prompt) => prompt.key === "rest_reply")!;
  const row = (
    version: number,
    active: boolean,
    activated_at: string | null,
  ): PromptVersionRow => ({
    key: "rest_reply",
    version,
    active,
    body: seed.body,
    params: structuredClone(seed.params),
    note: "",
    created_at: "2026-11-17T00:00:00Z",
    activated_at,
  });

  it("test_317_ac5_a_version_active_before_shows_as_earlier_not_draft", () => {
    const detail = promptDetail("rest_reply", [
      row(3, true, "2026-11-19T00:00:00Z"),
      row(2, false, "2026-11-18T00:00:00Z"),
      row(1, false, "2026-11-17T00:00:00Z"),
    ]);
    expect(detail?.versions.map((version) => version.state)).toEqual([
      "active",
      "earlier",
      "earlier",
    ]);
  });

  it("test_317_ac7_a_prompt_never_active_says_why_it_cannot_be_rolled_back_to", async () => {
    const calls: string[] = [];
    const result = await writePrompt(
      { kind: "roll_back", key: "rest_reply", version: 2 },
      {
        userId: "u1",
        role: "admin",
        rpc: async (name) => {
          calls.push(name);
          return { data: null, error: null };
        },
        readVersions: async () => [row(3, true, "2026-11-19T00:00:00Z"), row(2, false, null)],
      },
    );
    expect(result).toEqual({ ok: false, error: "never-published" });
    expect(calls).toEqual([]);
  });
});

describe("#310 leftovers", () => {
  const stories = [
    { id: "s1", sequence: 1, period: "Youth" },
    { id: "s2", sequence: 2, period: "After the war" },
  ];
  const fieldDeps = (rpcError: unknown) => ({
    userId: "u1",
    role: "admin" as const,
    rpc: async () => ({ data: null, error: rpcError }),
    problemsOf: async (key: FieldKey, body: string) => fieldProblems(key, body, { stories }),
    storedBody: async () => "Youth",
  });

  // A client whose companions table has no row for the asked code.
  const emptyClient = () => {
    const answer = { data: [], error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      then: (resolve: (value: typeof answer) => unknown) => resolve(answer),
    };
    return { from: () => builder } as never;
  };

  it("test_317_ac6_an_unknown_companion_code_is_said_not_known", async () => {
    const answer = await contentFieldProblems(
      emptyClient(),
      { item: "companion", code: "zz", field: "name" },
      "A name",
    );
    expect(answer).toBe("unknown-item");
    const result = await writeContentField(
      { kind: "save", key: "chr.zz.name", body: "A name" },
      { ...fieldDeps(null), problemsOf: async () => "unknown-item" as const },
    );
    expect(result).toEqual({ ok: false, error: "unknown-item" });
    expect(rollBackMessage("companion_field", { ok: false, error: "unknown-item" })).toBe(
      "This Companion or story is not known, so nothing was changed.",
    );
  });

  it("test_317_ac7_a_database_refusal_keeps_its_reason", async () => {
    const refused = await writeContentField(
      { kind: "roll_back", key: "opp.s1.period", version: 2 },
      fieldDeps({
        code: "23514",
        message:
          "field opp.s1.period version 2: a story stays in its own period or moves to a neighbouring one",
      }),
    );
    expect(refused).toEqual({
      ok: false,
      error: "checks-failed",
      problems: ["A story stays in its own period or moves to a neighbouring one."],
    });
    const never = await writeContentField(
      { kind: "roll_back", key: "opp.s1.period", version: 2 },
      fieldDeps({
        code: "P0001",
        message: "roll back needs a version of opp.s1.period that was published before",
      }),
    );
    expect(never).toEqual({ ok: false, error: "never-published" });
  });

  it("test_317_ac7_every_refused_roll_back_in_publish_history_gives_a_reason", () => {
    const failed = rollBackMessage("app_text", { ok: false, error: "failed" });
    for (const error of [
      "not-allowed",
      "invalid",
      "blank",
      "too-long",
      "never-published",
      "unknown-item",
    ]) {
      const message = rollBackMessage("story_field", { ok: false, error });
      expect(message, error).not.toBe(failed);
      expect(message, error).not.toMatch(/try again/i);
    }
    expect(rollBackMessage("story_field", { ok: false, error: "checks-failed" })).toBe(
      "This version does not pass the checks, so it was not rolled back:",
    );
    expect(rollBackMessage("prompt", { ok: false, error: "checks-failed" })).toMatch(/gateway/);
    expect(rollBackMessage("story_field", { ok: false, error: "never-published" })).toBe(
      "This version was never published, so it cannot be rolled back to.",
    );
  });

  it("test_317_ac8_a_period_name_with_spaces_around_it_is_the_same_name", () => {
    const own: FieldKey = { item: "story", code: "opp", storyId: "s2", field: "period" };
    expect(fieldProblems(own, "After the war ", { stories })).toEqual([]);
    const first: FieldKey = { item: "companion", code: "opp", field: "period", period: 1 };
    expect(fieldProblems(first, " After the war ", { stories })).toEqual([
      'Another period is already called "After the war".',
    ]);
  });

  it("test_317_ac8_a_saved_text_is_trimmed", async () => {
    const calls: Record<string, unknown>[] = [];
    await writeContentField(
      { kind: "save", key: "opp.s2.period", body: "After the war " },
      {
        ...fieldDeps(null),
        rpc: async (_name: string, args: Record<string, unknown>) => {
          calls.push(args);
          return { data: 4, error: null };
        },
      },
    );
    expect(calls).toEqual([{ field_key: "opp.s2.period", field_body: "After the war" }]);
  });
});
