import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StoryContent } from "@/lib/content/types";
import type { PromptRow, PromptSource } from "@/lib/prompts/repository";
import { createBudget, type Prices } from "./budget";
import { parseCsv, renderReport, scoringSheets, type RunResults, type TargetsFile } from "./report";
import {
  readTimes,
  runPauseSuite,
  runRestSuite,
  runSplitSuite,
  type GoalLinesInput,
  type PauseRunsInput,
  type RestMessagesInput,
} from "./suites";
import { unitGatewayFactory } from "./unit";

/**
 * One offline run (#42, US-AI-12): the suites in order (split, rest, pause; the cheap ones first,
 * so a budget stop cuts the longest suite), then `results.json`, the two scoring sheets and
 * `report.md` in `outDir`. Never called from the app; the runner and the tests call it.
 */

export const SUITES = ["split", "rest", "pause"] as const;
export type Suite = (typeof SUITES)[number];

export type RunInputs = {
  pause: PauseRunsInput;
  rest: RestMessagesInput;
  split: GoalLinesInput;
  targets: TargetsFile;
};

export type RunOptions = {
  mode: "stub" | "real";
  suites: Suite[];
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  content: StoryContent;
  promptRows: PromptRow[];
  inputs: RunInputs;
  maxCalls: number;
  maxCostUsd: number;
  prices: Prices;
  concurrency: number;
  outDir: string;
  timeLimitMs?: number;
  now?: () => Date;
};

export async function runOffline(options: RunOptions): Promise<RunResults> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const budget = createBudget({
    maxCalls: options.maxCalls,
    maxCostUsd: options.maxCostUsd,
    prices: options.prices,
  });
  const prompts: PromptSource = async (key) =>
    options.promptRows.find((row) => row.key === key) ?? null;
  const deps = {
    content: options.content,
    budget,
    concurrency: options.concurrency,
    gatewayFor: unitGatewayFactory({
      env: options.env,
      fetchImpl: options.fetchImpl,
      prompts,
      budget,
      timeLimitMs: options.timeLimitMs,
    }),
  };
  const has = (suite: Suite) => options.suites.includes(suite);
  const times = has("split") ? readTimes(options.inputs.split) : [];
  const split = has("split") ? await runSplitSuite(options.inputs.split, deps) : [];
  const rest = has("rest") ? await runRestSuite(options.inputs.rest, deps) : [];
  const pause = has("pause") ? await runPauseSuite(options.inputs.pause, deps) : [];
  const used = new Set([
    ...(has("split") ? ["plan_split"] : []),
    ...(has("rest") ? ["rest_reply"] : []),
    ...(has("pause") ? ["stuck_story", "pause_predicament"] : []),
    "retry_hints",
  ]);
  const results: RunResults = {
    meta: {
      mode: options.mode,
      model: options.env.MODEL_NAME?.trim() || "(not set)",
      startedAt,
      endedAt: now().toISOString(),
      suites: options.suites,
      prompts: options.promptRows
        .filter((row) => used.has(row.key))
        .map((row) => ({ key: row.key, version: row.version })),
      testData: true,
    },
    budget: budget.snapshot(),
    pause,
    rest,
    split,
    times,
  };
  writeRunFiles(options.outDir, results, options.inputs.targets);
  return results;
}

export function writeRunFiles(outDir: string, results: RunResults, targets: TargetsFile): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(path.join(outDir, "targets.json"), `${JSON.stringify(targets, null, 2)}\n`);
  const sheets = scoringSheets(results);
  writeFileSync(path.join(outDir, "scoring-rest.csv"), sheets.rest);
  writeFileSync(path.join(outDir, "scoring-pause.csv"), sheets.pause);
  writeFileSync(
    path.join(outDir, "report.md"),
    renderReport(results, targets, { pause: [], rest: [] }),
  );
}

/**
 * Scoring: reads `results.json`, the targets copied at run time (the targets set before the run)
 * and the filled-in sheets, and writes `report.md` again with the person measures. No model call.
 */
export function rescore(outDir: string): string {
  const read = (name: string) => readFileSync(path.join(outDir, name), "utf8");
  const results = JSON.parse(read("results.json")) as RunResults;
  const targets = JSON.parse(read("targets.json")) as TargetsFile;
  const report = renderReport(results, targets, {
    rest: parseCsv(read("scoring-rest.csv")),
    pause: parseCsv(read("scoring-pause.csv")),
  });
  writeFileSync(path.join(outDir, "report.md"), report);
  return report;
}
