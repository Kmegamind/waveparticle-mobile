import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AI_FEATURE_STATUS_LABEL,
  featureName,
  featurePrompts,
  formatRunTime,
  indexRow,
  readAiFeatures,
  runResult,
  testRunGroups,
  type AiFeatureRow,
  type AiFeatureTestRunRow,
} from "@/lib/ai-features/admin";
import type { PromptVersionRow } from "@/lib/prompts/admin";
import { readFeatureSeed } from "../scripts/ai-features/seed.mjs";

// #439 (part of #430): the AI features index and one read-only page per feature. The pages read
// public.ai_features and public.ai_feature_test_runs, and section (e) reads public.prompts live
// through public.list_prompt_versions, the same call as ADM-08 Prompts. The pages themselves are
// checked in e2e/ai-features.spec.ts and against the drawing in e2e/admin-visual-ai-features.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const seed = (): AiFeatureRow[] =>
  (readFeatureSeed() as Omit<AiFeatureRow, "status">[]).map((row) => ({
    ...row,
    status: "exploring",
  }));

const version = (
  key: string,
  number: number,
  state: "active" | "draft" | "earlier",
  body = `${key} v${number}`,
): PromptVersionRow => ({
  key,
  version: number,
  active: state === "active",
  body,
  params: {},
  note: "",
  created_at: "2026-11-20T10:00:00Z",
  activated_at: state === "draft" ? null : "2026-11-20T10:00:00Z",
});

const run = (over: Partial<AiFeatureTestRunRow>): AiFeatureTestRunRow => ({
  id: 1,
  feature_slug: "pause_message",
  prompt_key: "stuck_story",
  kind: "fake_model",
  run_at: "2026-11-25T20:15:34.722Z",
  prompt_version: 3,
  pass_count: 3,
  fail_count: 1,
  target_count: 4,
  summary: "Fake model (stub): says nothing about a real model.",
  report_path: "offline-runs/2026-11-25-stub/report.md",
  imported_at: "2026-11-25T21:00:00Z",
  ...over,
});

describe("AI features index (#439 AC1)", () => {
  it("test_439_ac1_the_menu_has_ai_features_in_ai_rules_before_prompts", () => {
    const shell = read("src/app/admin/admin-shell.tsx");
    const group = shell.slice(shell.indexOf('heading: "AI rules"'));
    const features = group.indexOf(
      '{ href: "/admin/ai-features", id: "ADM-16", label: "AI features" }',
    );
    expect(features).toBeGreaterThan(-1);
    expect(features).toBeLessThan(group.indexOf('label: "Prompts"'));
  });

  it("test_439_ac1_reads_the_features_in_page_order_through_the_users_client", async () => {
    const calls: unknown[] = [];
    const rows = await readAiFeatures(async (table, order) => {
      calls.push([table, order]);
      return { data: seed(), error: null };
    });
    expect(calls).toEqual([["ai_features", "position"]]);
    expect(rows?.map((row) => row.title)).toEqual([
      "Goal split (plan_split)",
      "Step cards (step_cards)",
      "Pause message (stuck_story + pause_predicament)",
      "Rest reply (rest_reply)",
      "Return pop-up (return_popup)",
      "Closing line (closing_line)",
      "Safety classifier (safety_classifier)",
    ]);
    expect(await readAiFeatures(async () => ({ data: null, error: { message: "x" } }))).toBeNull();
    expect(
      await readAiFeatures(async () => {
        throw new Error("down");
      }),
    ).toBeNull();
  });

  it("test_439_ac1_each_status_has_its_words", () => {
    expect(AI_FEATURE_STATUS_LABEL).toEqual({
      not_started: "Not started",
      exploring: "Exploring",
      passed: "Passed",
      frozen: "Frozen",
    });
  });

  it("test_439_ac1_an_index_row_has_title_purpose_status_prompts_and_last_run", () => {
    const [plan, , pause, , , closing] = seed();
    const versions = [
      version("plan_split", 1, "earlier"),
      version("plan_split", 2, "active"),
      version("plan_split", 3, "draft"),
      version("stuck_story", 1, "active"),
      version("pause_predicament", 1, "active"),
    ];
    const runs = [
      run({ run_at: "2026-11-20T10:00:00Z", feature_slug: "plan_split", prompt_key: "plan_split" }),
      run({ run_at: "2026-11-25T10:00:00Z", feature_slug: "plan_split", prompt_key: "plan_split" }),
    ];
    expect(indexRow(plan, versions, runs)).toEqual({
      slug: "plan_split",
      title: "Goal split (plan_split)",
      purpose:
        "Turn the goal the person typed and the minutes they gave into steps they can start.",
      status: "exploring",
      versions: ["v2"],
      draftExists: true,
      lastRun: { time: "2026-11-25 10:00", fake: true },
    });
    const pauseRow = indexRow(pause, versions, []);
    expect(pauseRow.versions).toEqual(["v1", "v1"]);
    expect(pauseRow.draftExists).toBe(false);
    expect(pauseRow.lastRun).toBeNull();
    // A section emptied by the owner reads "Not written yet".
    expect(indexRow({ ...closing, purpose: [] }, versions, []).purpose).toBeNull();
    // A prompt with no published version shows none.
    expect(indexRow(closing, [], []).versions).toEqual(["none"]);
  });
});

describe("AI feature page (#439 AC2 to AC5)", () => {
  it("test_439_ac2_the_name_is_the_title_without_its_prompt_keys", () => {
    expect(featureName("Pause message (stuck_story + pause_predicament)")).toBe("Pause message");
    expect(featureName("Goal split (plan_split)")).toBe("Goal split");
    expect(featureName("No brackets")).toBe("No brackets");
  });

  it("test_439_ac2_every_seeded_item_is_a_draft_with_its_source", () => {
    for (const feature of seed()) {
      for (const items of [feature.purpose, feature.pass_questions, feature.approach]) {
        expect(items.length, feature.slug).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.draft).toBe(true);
          expect(item.source).toMatch(/:\d+$/);
        }
      }
    }
  });

  it("test_439_ac3_each_prompt_key_shows_its_published_text_and_any_draft", () => {
    const versions = [
      version("stuck_story", 1, "earlier"),
      version("stuck_story", 2, "active", "Published stuck story."),
      version("stuck_story", 3, "draft", "Draft stuck story."),
      version("pause_predicament", 1, "active", "Published predicament."),
      version("retry_hints", 1, "active", "Fix it."),
    ];
    expect(featurePrompts(["stuck_story", "pause_predicament"], versions)).toEqual([
      {
        key: "stuck_story",
        published: { version: 2, body: "Published stuck story." },
        draft: { version: 3, body: "Draft stuck story." },
      },
      {
        key: "pause_predicament",
        published: { version: 1, body: "Published predicament." },
        draft: null,
      },
    ]);
    expect(featurePrompts(["retry_hints"], versions)[0].published?.body).toBe("Fix it.");
    // A key the prompts table does not know shows nothing published.
    expect(featurePrompts(["closing_line"], versions)).toEqual([
      { key: "closing_line", published: null, draft: null },
    ]);
  });

  it("test_439_ac3_the_pages_read_prompts_with_the_prompts_admin_call", () => {
    for (const file of [
      "src/app/admin/ai-features/page.tsx",
      "src/app/admin/ai-features/[slug]/page.tsx",
    ]) {
      expect(read(file), file).toContain("readPromptVersions(");
      expect(read(file), file).toContain("await connection()");
    }
    // Never copied: no prompt text is stored with the features.
    expect(read("src/lib/ai-features/admin.ts")).not.toMatch(/from\("prompts"\)/);
  });

  it("test_439_ac4_runs_group_by_run_newest_first_with_fake_model_runs_marked", () => {
    const runs = [
      run({ id: 1, prompt_key: "stuck_story", prompt_version: 3 }),
      run({ id: 2, prompt_key: "pause_predicament", prompt_version: 1 }),
      // The same run imported twice is shown once.
      run({ id: 3, prompt_key: "pause_predicament", prompt_version: 1 }),
      run({
        id: 4,
        run_at: "2026-11-20T08:00:00Z",
        prompt_version: null,
        pass_count: 0,
        fail_count: 0,
      }),
    ];
    const groups = testRunGroups(runs);
    expect(groups.map((group) => group.time)).toEqual(["2026-11-25 20:15", "2026-11-20 08:00"]);
    expect(groups[0]).toMatchObject({
      fake: true,
      prompts: ["stuck_story v3", "pause_predicament v1"],
      result: "3 of 4 targets pass, 1 fail",
    });
    expect(groups[1].prompts).toEqual(["stuck_story"]);
    expect(groups[1].result).toBe("0 of 4 targets pass");
    expect(testRunGroups([run({ kind: "real" })])[0].fake).toBe(false);
  });

  it("test_439_ac4_results_and_times_read_plainly", () => {
    expect(runResult({ pass_count: 6, fail_count: 0, target_count: 6 })).toBe(
      "6 of 6 targets pass",
    );
    expect(formatRunTime("2026-11-25T20:15:34.722Z")).toBe("2026-11-25 20:15");
    expect(formatRunTime("not a time")).toBe("not a time");
  });

  it("test_439_ac4_ac5_the_page_has_no_real_run_yet_and_the_retry_hints_section", () => {
    const page =
      read("src/app/admin/ai-features/[slug]/page.tsx") +
      read("src/app/admin/ai-features/feature-ui.tsx");
    expect(page).toContain("No real run yet (#413)");
    expect(page).toContain("Fix added after a rejected answer");
    expect(page).toContain('featurePrompts(["retry_hints"]');
    expect(page).toContain("Not written yet");
    expect(page).toContain("Draft - owner to edit");
    expect(page).toContain("Fake model (stub)");
  });

  it("test_439_read_view_only_no_editor_and_no_status_history_list", () => {
    for (const file of [
      "src/app/admin/ai-features/page.tsx",
      "src/app/admin/ai-features/[slug]/page.tsx",
    ]) {
      const page = read(file);
      expect(page, file).not.toContain('"use client"');
      expect(page, file).not.toMatch(/save_ai_feature_sections|set_ai_feature_status/);
      expect(page, file).not.toMatch(/<form|<button|<textarea/);
    }
  });
});

describe("decision log (#439 AC7)", () => {
  it("test_439_ac7_ai_pages_count_is_closed_with_7_pages", () => {
    const log = read("docs/DECISIONS.md");
    const open = log.slice(log.indexOf("## 3. Open"), log.indexOf("## 4. Later"));
    expect(open).not.toContain("AI-PAGES-COUNT");
    const decided = log.slice(0, log.indexOf("## 2. Superseded"));
    expect(decided).toMatch(
      /\| AI-PAGES-7 \| 2026-11-25 \|[^\n]*7 pages[^\n]*Closes AI-PAGES-COUNT/,
    );
    expect(read("docs/ai/AI_11_feature-pages.md")).not.toContain("the count is an open question");
  });

  it("test_439_owner_rule_writers_edit_a_to_c_and_only_status_is_admin_only", () => {
    const log = read("docs/DECISIONS.md");
    const decided = log.slice(0, log.indexOf("## 2. Superseded"));
    const row = decided
      .split("\n")
      .find((line) => line.startsWith("| AI-PAGE-EDIT | 2026-11-25 |"));
    expect(row).toBeDefined();
    expect(row).toMatch(/Writers may edit \(a\) purpose, \(b\) pass questions and \(c\)/);
    expect(row).toContain("Only a status change is admin only");
    // It sits next to the row that closes AI-PAGES-COUNT.
    const lines = decided.split("\n");
    const at = lines.indexOf(row!);
    expect(lines[at - 1]).toMatch(/^\| AI-PAGES-7 \|/);
  });
});
