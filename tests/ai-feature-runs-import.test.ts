import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { RunResults, TargetsFile } from "@/lib/offline-runs/report";
import { runOffline, type RunInputs } from "@/lib/offline-runs/run";
import type { GoalLinesInput, RestMessagesInput } from "@/lib/offline-runs/suites";
import {
  importSql,
  readRunFolder,
  reportPathOf,
  SUITE_FEATURES,
  summaryStatuses,
  testRunRows,
} from "../scripts/ai-features/import-runs.mjs";
import { STUB_ENV, stubFetch } from "../scripts/offline-runs/stub-fetch.mjs";
import { seedContent } from "./support/seed-content";
import { seedRows } from "./support/seed-prompts";

// #436 AC3: the import of #42 offline-run results into public.ai_feature_test_runs. The run folder
// is made here by the #42 runner itself, in this process, with the stub model only: no network
// and no real model, as tests/offline-runs.test.ts.

const root = path.join(import.meta.dirname, "..");
const script = path.join(root, "scripts", "ai-features", "import-runs.mjs");
const data = (name: string) =>
  JSON.parse(readFileSync(path.join(root, "scripts", "offline-runs", "data", name), "utf8"));
const targets = data("targets.json") as TargetsFile;
const inputs: RunInputs = {
  pause: { runsPerStory: 1, pausesPerRun: 3, arms: ["on", "off"], stories: ["site-search"] },
  rest: {
    ...(data("rest-messages.json") as RestMessagesInput),
    messages: (data("rest-messages.json") as RestMessagesInput).messages.slice(0, 2),
    positions: [{ stepIndex: 0, stepCount: 4 }],
  },
  split: {
    ...(data("goal-lines.json") as GoalLinesInput),
    lines: (data("goal-lines.json") as GoalLinesInput).lines.slice(0, 3),
    runsPerLine: 1,
  },
  targets,
};

let outDir = "";
let results: RunResults;

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "wp-ai-runs-"));
  results = await runOffline({
    mode: "stub",
    suites: ["split", "rest", "pause"],
    env: STUB_ENV,
    fetchImpl: stubFetch() as typeof fetch,
    content: seedContent(),
    promptRows: seedRows(),
    inputs,
    maxCalls: 2_600,
    maxCostUsd: 5,
    prices: { inputPerMillion: 0.75, outputPerMillion: 3.75, source: "test" },
    concurrency: 2,
    outDir,
  });
});

/** A copy of the run folder with results.json changed, for the cases a stub run cannot make. */
function changedFolder(change: (meta: RunResults["meta"]) => void) {
  const copy = mkdtempSync(path.join(tmpdir(), "wp-ai-runs-copy-"));
  const changed = JSON.parse(JSON.stringify(results)) as RunResults;
  change(changed.meta);
  writeFileSync(path.join(copy, "results.json"), JSON.stringify(changed));
  for (const name of ["targets.json", "report.md"]) {
    writeFileSync(path.join(copy, name), readFileSync(path.join(outDir, name)));
  }
  return copy;
}

describe("#436 AC3: import of offline-run results", () => {
  it("test_436_ac3_one_row_per_feature_and_prompt_key_of_each_suite", () => {
    const rows = testRunRows(readRunFolder(outDir), { reportPath: "offline-runs/x/report.md" });
    expect(rows.map((row) => `${row.feature_slug}/${row.prompt_key}`)).toEqual([
      "plan_split/plan_split",
      "rest_reply/rest_reply",
      "pause_message/stuck_story",
      "pause_message/pause_predicament",
    ]);
    // retry_hints is used by the run but is not a feature.
    expect(results.meta.prompts.map((prompt) => prompt.key)).toContain("retry_hints");
    expect(rows.some((row) => row.prompt_key === "retry_hints")).toBe(false);
    for (const row of rows) {
      expect(row.run_at).toBe(results.meta.startedAt);
      expect(row.prompt_version).toBe(
        results.meta.prompts.find((prompt) => prompt.key === row.prompt_key)?.version,
      );
      expect(row.report_path).toBe("offline-runs/x/report.md");
    }
  });

  it("test_436_ac3_a_stub_run_is_marked_fake_model", () => {
    const rows = testRunRows(readRunFolder(outDir), { reportPath: "r" });
    expect(new Set(rows.map((row) => row.kind))).toEqual(new Set(["fake_model"]));
    for (const row of rows) expect(row.summary).toMatch(/^Fake model \(stub\)/);
  });

  it("test_436_ac3_only_a_run_that_says_real_is_real", () => {
    const real = testRunRows(readRunFolder(changedFolder((meta) => (meta.mode = "real"))), {
      reportPath: "r",
    });
    expect(new Set(real.map((row) => row.kind))).toEqual(new Set(["real"]));
    const broken = changedFolder((meta) => ((meta as { mode: string }).mode = "maybe"));
    expect(() => testRunRows(readRunFolder(broken), { reportPath: "r" })).toThrow(/meta\.mode/);
  });

  it("test_436_ac3_pass_and_fail_counts_are_the_report_summary_rows_of_the_suite", () => {
    const report = readFileSync(path.join(outDir, "report.md"), "utf8");
    const statuses = summaryStatuses(report);
    expect(statuses.size).toBe(targets.targets.length);
    const rows = testRunRows(readRunFolder(outDir), { reportPath: "r" });
    for (const [suite, slug] of Object.entries(SUITE_FEATURES)) {
      const ids = targets.targets.filter((target) => target.suite === suite).map((t) => t.id);
      const count = (status: string) => ids.filter((id) => statuses.get(id) === status).length;
      for (const row of rows.filter((item) => item.feature_slug === slug)) {
        expect(row.target_count).toBe(ids.length);
        expect(row.pass_count).toBe(count("PASS"));
        expect(row.fail_count).toBe(count("FAIL"));
      }
    }
  });

  it("test_436_ac3_an_incomplete_run_says_so_in_the_summary", () => {
    const folder = changedFolder((meta) => (meta.incomplete = "the budget stop ended the run"));
    const rows = testRunRows(readRunFolder(folder), { reportPath: "r" });
    for (const row of rows)
      expect(row.summary).toMatch(/INCOMPLETE: the budget stop ended the run/);
  });

  it("test_436_ac3_a_folder_without_the_run_files_is_refused", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "wp-ai-runs-empty-"));
    expect(() => readRunFolder(empty)).toThrow(/has no results\.json/);
  });

  it("test_436_ac3_the_sql_upserts_on_feature_key_kind_and_run", () => {
    const rows = testRunRows(readRunFolder(outDir), { reportPath: "r" });
    const sql = importSql(rows);
    expect(sql.match(/^insert into public\.ai_feature_test_runs/gm)).toHaveLength(rows.length);
    expect(sql).toMatch(/on conflict \(feature_slug, prompt_key, kind, run_at\) do update set/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).not.toMatch(/rollback/);
  });

  it("test_436_ac3_dry_run_prints_what_it_would_insert_and_ends_in_rollback", () => {
    const run = spawnSync(process.execPath, [script, "--dry-run", outDir], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/-- DRY RUN: ends in ROLLBACK; nothing is kept/);
    expect(run.stdout).toMatch(
      /--\s+plan_split plan_split v2 fake_model \S+: \d+ pass, \d+ fail of \d+/,
    );
    expect(run.stdout.trimEnd().endsWith("rollback;")).toBe(true);
    expect(run.stdout).not.toMatch(/^commit;/m);
  });

  it("test_436_ac3_the_command_line_needs_one_folder", () => {
    const run = spawnSync(process.execPath, [script], { encoding: "utf8" });
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/Usage/);
  });

  it("test_436_ac3_the_report_path_is_relative_to_the_repository_when_inside_it", () => {
    expect(reportPathOf("offline-runs/2026-stub", root)).toBe(
      path.join("offline-runs", "2026-stub", "report.md"),
    );
    expect(reportPathOf(outDir, root)).toBe(path.join(outDir, "report.md"));
  });

  it("test_436_ac3_the_import_never_calls_a_model", () => {
    // It reads files only: no network module, no runner, no gateway, and no fetch.
    const source = readFileSync(script, "utf8");
    const imports = [...source.matchAll(/^import .+ from "([^"]+)";$/gm)].map((match) => match[1]);
    expect(imports).toEqual(["node:fs", "node:path", "node:url", "./seed.mjs"]);
    expect(source).not.toMatch(/\bfetch\(|import\(/);
  });
});
