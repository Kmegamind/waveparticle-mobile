import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseFeaturePages,
  readFeatureSeed,
  seedSql,
  SPEC_FILE,
  START_STATUS,
} from "../scripts/ai-features/seed.mjs";

// #436 AC2: the seed of public.ai_features comes from the drafts of
// docs/ai/AI_11_feature-pages.md (section 3), with their sources, marked as drafts, every status
// exploring; a section with no source is empty, so the page shows "Not written yet".

const root = path.join(import.meta.dirname, "..");
const script = path.join(root, "scripts", "ai-features", "seed.mjs");

describe("#436 AC2: the AI feature seed", () => {
  it("test_436_ac2_seven_features_with_the_page_titles", () => {
    const rows = readFeatureSeed();
    expect(rows.map((row) => [row.position, row.slug, row.title, row.prompt_keys])).toEqual([
      [1, "plan_split", "Goal split (plan_split)", ["plan_split"]],
      [2, "step_cards", "Step cards (step_cards)", ["step_cards"]],
      [
        3,
        "pause_message",
        "Pause message (stuck_story + pause_predicament)",
        ["stuck_story", "pause_predicament"],
      ],
      [4, "rest_reply", "Rest reply (rest_reply)", ["rest_reply"]],
      [5, "return_popup", "Return pop-up (return_popup)", ["return_popup"]],
      [6, "closing_line", "Closing line (closing_line)", ["closing_line"]],
      [7, "safety_classifier", "Safety classifier (safety_classifier)", ["safety_classifier"]],
    ]);
    // retry_hints is not a feature row (AI-PAGES).
    expect(rows.flatMap((row) => row.prompt_keys)).not.toContain("retry_hints");
  });

  it("test_436_ac2_every_draft_line_of_ai_11_is_seeded_with_its_source", () => {
    const markdown = readFileSync(SPEC_FILE, "utf8");
    const lines = markdown
      .split("\n")
      .filter((line) => line.startsWith("- draft - owner to edit:"));
    const items = readFeatureSeed().flatMap((row) => [
      ...row.purpose,
      ...row.pass_questions,
      ...row.approach,
    ]);
    expect(items).toHaveLength(lines.length);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.draft).toBe(true);
      expect(item.source).toMatch(/^[\w./-]+\.md:\d+$/);
      expect(item.text).not.toMatch(/draft - owner to edit|\(source:/);
      expect(lines.some((line) => line.includes(`${item.text} (source: ${item.source})`))).toBe(
        true,
      );
    }
  });

  it("test_436_ac2_a_section_with_no_draft_line_is_empty_not_written_yet", () => {
    const [row] = parseFeaturePages(
      [
        "## 3. The seven features",
        "### 3.1 Test feature (test_key)",
        "**(a) Purpose**",
        "- draft - owner to edit: Does a thing. (source: docs/PRD.md:1)",
        "**(b) Pass standard**",
        "Not written yet.",
        "**(c) Current approach**",
        "## 4. Next",
        "- draft - owner to edit: Not part of section 3. (source: docs/PRD.md:2)",
      ].join("\n"),
    );
    expect(row.purpose).toEqual([{ text: "Does a thing.", source: "docs/PRD.md:1", draft: true }]);
    expect(row.pass_questions).toEqual([]);
    expect(row.approach).toEqual([]);
  });

  it("test_436_ac2_a_draft_line_without_a_source_is_refused", () => {
    expect(() =>
      parseFeaturePages(
        [
          "## 3. The seven features",
          "### 3.1 Test feature (test_key)",
          "**(a) Purpose**",
          "- draft - owner to edit: No source given.",
        ].join("\n"),
      ),
    ).toThrow(/without a source/);
  });

  it("test_436_ac2_the_sql_inserts_only_missing_features_as_exploring", () => {
    const sql = seedSql(readFeatureSeed());
    expect(START_STATUS).toBe("exploring");
    expect(sql.match(/^insert into public\.ai_features /gm)).toHaveLength(7);
    expect(sql.match(/^on conflict \(slug\) do nothing;$/gm)).toHaveLength(7);
    expect(sql.match(/, 'exploring'\)$/gm)).toHaveLength(7);
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    // The prompt text is never copied (AI-PAGE-STORE).
    expect(sql).not.toMatch(/public\.prompts/);
  });

  it("test_436_ac2_texts_are_dollar_quoted_with_a_marker_not_in_the_text", () => {
    const sql = seedSql([
      {
        position: 1,
        slug: "test_key",
        title: "Test (test_key)",
        prompt_keys: ["test_key"],
        purpose: [{ text: "It's $seed$ here", source: null, draft: true }],
        pass_questions: [],
        approach: [],
      },
    ]);
    expect(sql).toContain(
      `$seed_1$[{"text":"It's $seed$ here","source":null,"draft":true}]$seed_1$`,
    );
  });

  it("test_436_ac2_dry_run_lists_the_rows_and_ends_in_rollback", () => {
    const run = spawnSync(process.execPath, [script, "--dry-run"], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/-- DRY RUN: ends in ROLLBACK; nothing is kept\./);
    expect(run.stdout).toMatch(/--\s+plan_split: "Goal split \(plan_split\)"/);
    expect(run.stdout).toMatch(/^select slug, title, status/m);
    expect(run.stdout.trimEnd().endsWith("rollback;")).toBe(true);
    expect(run.stdout).not.toMatch(/^commit;/m);
    const bad = spawnSync(process.execPath, [script, "--yes"], { encoding: "utf8" });
    expect(bad.status).toBe(2);
  });
});
