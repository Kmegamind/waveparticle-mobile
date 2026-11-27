import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  it("test_517_registry_dry_run_rolls_back_then_its_last_statement_lists_the_row", () => {
    // Fix round 1 (I-3): the SQL editor shows only the last statement's result.
    const sql = code(reviewSeedSql({ dryRun: true }));
    expect(sql).not.toContain("commit;");
    const rollback = sql.indexOf("rollback;");
    expect(rollback).toBeGreaterThan(sql.indexOf("insert into public.ai_features"));
    const last = sql.slice(rollback + "rollback;".length).trim();
    expect(last.startsWith("select")).toBe(true);
    expect(last).not.toMatch(/\b(insert|update|delete|begin|commit)\b/i);
    expect(last).toContain(
      "'rest_reply_review' as slug, 'R-08' as feature_id, 'runtime' as category",
    );
    expect(last).toContain("'exploring' as status");
    expect(last.split(";").filter((part) => part.trim()).length).toBe(1);
  });

  it("test_517_registry_check_is_read_only", () => {
    const sql = code(reviewCheckSql());
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|create)\b/i);
    expect(sql).toContain("from public.ai_features");
    // It names the stored versions, never the prompt text.
    expect(sql).toContain("select key, version, active, activated_at from public.prompts");
    expect(sql).not.toMatch(/\bbody\b/);
    // Fix round 1 (I-3): the last statement, the one the SQL editor shows, is the R-08 row.
    const statements = sql
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    expect(statements.at(-1)).toBe(
      "select slug, feature_id, category, prompt_keys, status, position\nfrom public.ai_features where slug = 'rest_reply_review' or feature_id = 'R-08'",
    );
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
  });

  // Fix round 1 (I-2): the owner's prompt texts stay outside the repository, so this test holds
  // none of their words. It reads the owner's folder only when OWNER_PROPOSED5_DIR names it (on the
  // owner's or an agent's machine) and is skipped otherwise, as in CI. No 40-character run of any
  // prompt body there may appear in the files this pull request writes.
  const ownerDir = process.env.OWNER_PROPOSED5_DIR;
  it.skipIf(!ownerDir || !existsSync(ownerDir))(
    "test_517_ac5_no_40_character_run_of_the_owners_prompt_bodies_is_in_the_repository",
    () => {
      const flat = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
      // What this pull request wrote: its own parts of the shared docs (the rest of those files
      // was there before, for example the AI-ROLEPLAY-FORMAT row) and its new or changed files.
      const part = (file: string, from: string, to: string) => {
        const text = read(file);
        const start = text.indexOf(from);
        expect(start, `${file}: ${from}`).toBeGreaterThanOrEqual(0);
        const end = text.indexOf(to, start + from.length);
        return text.slice(start, end < 0 ? undefined : end);
      };
      const written = [
        part("docs/DECISIONS.md", "### Rest chat in two calls", "## 2. Superseded"),
        part("docs/CONTENT_MODEL.md", "| Rest chat reply | Live", "\n"),
        part("docs/ai/AI_04_rest-chat.md", "> **Decision of 2026-11-27", "# AI-4"),
        read("docs/api/ai-runs.md")
          .split("\n")
          .filter((line) => line.includes("#517"))
          .join("\n"),
        ...[
          "src/lib/model-gateway/gateway.ts",
          "src/lib/ai-runs/call-inputs.ts",
          "scripts/ai-features/rest-review-seed.mjs",
          "e2e/support/stub-supabase.mjs",
          "e2e/ai-lab.live.spec.ts",
          "tests/rest-two-calls-517.test.ts",
          "tests/lab-stored-versions-517.test.ts",
          "tests/rest-review-registry-517.test.ts",
        ].map(read),
      ]
        .map(flat)
        .join("\n");
      for (const name of readdirSync(ownerDir!).filter((file) => file.endsWith(".md"))) {
        const text = readFileSync(path.join(ownerDir!, name), "utf8");
        const body = flat(text.split("```text")[1]?.split("```")[0] ?? "");
        for (let i = 0; i + 40 <= body.length; i += 1) {
          expect(written.includes(body.slice(i, i + 40)), `${name} at ${i}`).toBe(false);
        }
      }
    },
  );
});
