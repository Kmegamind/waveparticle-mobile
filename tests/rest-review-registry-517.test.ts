import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REVIEW_FEATURE,
  reviewCheckSql,
  reviewSeedSql,
  reviewUndoSql,
} from "../scripts/ai-features/rest-review-seed.mjs";
import { RUNTIME_FEATURE_IDS } from "../scripts/ai-features/seed.mjs";

// #517: the registry row of rest_reply_review (R-08, category runtime) is SQL the owner runs (a
// Human step with a dry run, a check and an undo); and the spec texts of REST-TWO-CALLS (AC5).

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const code = (text: string) => text.replace(/--.*$/gm, "");

describe("#517 the R-08 registry row", () => {
  it("test_517_registry_row_is_a_new_runtime_id_for_rest_reply_review", () => {
    expect(REVIEW_FEATURE).toMatchObject({
      featureId: "R-08",
      slug: "rest_reply_review",
      promptKeys: ["rest_reply_review"],
      category: "runtime",
      status: "exploring",
    });
    expect(Object.values(RUNTIME_FEATURE_IDS)).not.toContain("R-08");
    expect(Object.keys(RUNTIME_FEATURE_IDS)).not.toContain("rest_reply_review");
  });

  it("test_517_registry_seed_inserts_once_and_commits", () => {
    const sql = code(reviewSeedSql());
    expect(sql).toMatch(/insert into public\.ai_features \(slug, position, title, prompt_keys/);
    expect(sql).toContain("'R-08', 'runtime'");
    expect(sql).toContain("array['rest_reply_review']");
    expect(sql).toContain("on conflict (slug) do nothing;");
    expect(sql).toContain("raise exception 'R-08 already belongs to another registry row");
    expect(sql.trim().endsWith("commit;")).toBe(true);
    // It never writes a prompt version.
    expect(sql).not.toMatch(/public\.prompts/);
  });

  it("test_517_registry_dry_run_ends_in_rollback", () => {
    const sql = code(reviewSeedSql({ dryRun: true }));
    expect(sql.trim().endsWith("rollback;")).toBe(true);
    expect(sql).not.toContain("commit;");
  });

  it("test_517_registry_check_is_read_only", () => {
    const sql = code(reviewCheckSql());
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|create)\b/i);
    expect(sql).toContain("from public.ai_features");
    // It names the stored versions, never the prompt text.
    expect(sql).toContain("select key, version, active, activated_at from public.prompts");
    expect(sql).not.toMatch(/\bbody\b/);
  });

  it("test_517_registry_undo_removes_only_r08_and_keeps_runs", () => {
    const sql = code(reviewUndoSql());
    expect(sql).toContain(
      "delete from public.ai_features where slug = 'rest_reply_review' and feature_id = 'R-08';",
    );
    expect(sql.match(/\bdelete from\b/g)).toHaveLength(1);
    expect(sql).toContain("public.ai_runs where feature_slug = 'rest_reply_review'");
    expect(sql).not.toMatch(/public\.prompts/);
  });

  it("test_517_registry_script_prints_each_mode_and_refuses_an_unknown_flag", () => {
    const script = path.join(root, "scripts/ai-features/rest-review-seed.mjs");
    const run = (...args: string[]) =>
      execFileSync("node", [script, ...args], { encoding: "utf8" });
    expect(run()).toBe(reviewSeedSql());
    expect(run("--dry-run")).toBe(reviewSeedSql({ dryRun: true }));
    expect(run("--check")).toBe(reviewCheckSql());
    expect(run("--undo")).toBe(reviewUndoSql());
    expect(() => execFileSync("node", [script, "--apply"], { stdio: "pipe" })).toThrow();
  });
});

describe("#517 AC5 the spec texts of REST-TWO-CALLS", () => {
  it("test_517_ac5_decisions_has_the_rest_two_calls_row", () => {
    const row = read("docs/DECISIONS.md")
      .split("\n")
      .find((line) => line.startsWith("| REST-TWO-CALLS |"));
    expect(row).toBeDefined();
    expect(row).toMatch(/rest_reply_review/);
    expect(row).toMatch(/\{\{draft\}\}/);
    expect(row).toMatch(/call one's reply/i);
  });

  it("test_517_ac5_ai_04_describes_the_two_calls_the_fallback_and_the_time_limit", () => {
    const text = read("docs/ai/AI_04_rest-chat.md");
    expect(text).toContain("REST-TWO-CALLS");
    expect(text).toContain("rest_reply_review");
    expect(text).toContain("{{draft}}");
    expect(text).toMatch(/12 s/);
    expect(text).toMatch(/no active version/i);
  });

  it("test_517_ac5_the_content_model_rest_chat_row_names_the_two_calls", () => {
    const row = read("docs/CONTENT_MODEL.md")
      .split("\n")
      .find((line) => line.startsWith("| Rest chat reply | Live"));
    expect(row).toMatch(/REST-TWO-CALLS/);
    expect(row).toMatch(/rest_reply_review/);
  });

  it("test_517_ac5_the_proposed_prompt_texts_are_not_copied_into_the_repository", () => {
    // The owner has not yet agreed to copy them (docs/ai/prompts/rest_reply_review.md is left out).
    expect(() => read("docs/ai/prompts/rest_reply_review.md")).toThrow();
    for (const file of [
      "docs/ai/AI_04_rest-chat.md",
      "docs/DECISIONS.md",
      "docs/CONTENT_MODEL.md",
      "docs/api/ai-runs.md",
    ]) {
      expect(read(file)).not.toContain("Read it as that person would, sitting beside him");
    }
  });
});
