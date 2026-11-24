import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { StoryContent } from "@/lib/content/types";
import type { PromptRow, PromptSource } from "@/lib/prompts/repository";
import { createBudget, type Prices } from "./budget";
import { parseCsv, renderReport, scoringSheets, type RunResults, type TargetsFile } from "./report";
import { NO_SHEETS, type Sheets } from "./scoring";
import {
  readTimes,
  runPauseSuite,
  runRestSuite,
  runSplitSuite,
  type GoalLinesInput,
  type PauseRecord,
  type PauseRunsInput,
  type RecordSink,
  type RestMessagesInput,
  type RestRecord,
  type SplitRecord,
} from "./suites";
import { unitGatewayFactory } from "./unit";

/**
 * One offline run (#42, US-AI-12): the suites in order (split, rest, pause; the cheap ones first,
 * so a budget stop cuts the longest suite). Every record is appended to `results.jsonl` as soon as
 * it exists. Whatever happens (the end, a budget stop, an error, or a stop asked for by Ctrl-C), `results.json`,
 * the scoring sheets and `report.md` are written from what finished; a run that did not finish is
 * marked INCOMPLETE with the reason. Never called from the app; the runner and the tests call it.
 */

export const SUITES = ["split", "rest", "pause"] as const;

/** What the launcher watch writes into the stop file when the launcher's pipe closes. */
export const LAUNCHER_GONE = "launcher gone";
export type Suite = (typeof SUITES)[number];

export const PROMPT_SOURCE = "the seed files in docs/ai/prompts, not the database's active rows";

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
  /** Called after each record is appended (tests use it to fail on purpose midway). */
  afterRecord?: RecordSink;
  /**
   * A file whose appearance asks the run to stop (run.mjs writes it on Ctrl-C): no new request is
   * made, the units in flight finish, and the partial report is written.
   */
  stopFile?: string;
  /**
   * The launcher's process id (run.mjs). The runner is detached, so if the launcher goes away (a
   * closed terminal, or killed) the run stops in the same way as for the stop file.
   */
  parentPid?: number;
};

/** True while a process with this id exists (signal 0 only checks; it sends nothing). */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function runOffline(options: RunOptions): Promise<RunResults> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  mkdirSync(options.outDir, { recursive: true });
  const jsonl = path.join(options.outDir, "results.jsonl");
  writeFileSync(jsonl, "");
  const budget = createBudget({
    maxCalls: options.maxCalls,
    maxCostUsd: options.maxCostUsd,
    prices: options.prices,
    beforeRequest: () => checkForStop(),
  });
  const prompts: PromptSource = async (key) =>
    options.promptRows.find((row) => row.key === key) ?? null;
  const pause: PauseRecord[] = [];
  const rest: RestRecord[] = [];
  const split: SplitRecord[] = [];
  const onRecord: RecordSink = (suite, record) => {
    appendFileSync(jsonl, `${JSON.stringify({ suite, ...record })}\n`);
    if (suite === "pause") pause.push(record as PauseRecord);
    else if (suite === "rest") rest.push(record as RestRecord);
    else split.push(record as SplitRecord);
    options.afterRecord?.(suite, record);
  };
  const deps = {
    content: options.content,
    budget,
    concurrency: options.concurrency,
    onRecord,
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
  const used = new Set([
    ...(has("split") ? ["plan_split"] : []),
    ...(has("rest") ? ["rest_reply"] : []),
    ...(has("pause") ? ["stuck_story", "pause_predicament"] : []),
    "retry_hints",
  ]);
  let incomplete: string | null = null;
  let haltReason =
    "the run was interrupted (Ctrl-C, SIGTERM or a closed terminal); the units in flight finished";
  const launcherGone =
    "the launcher went away (a closed terminal or a killed process); the units in flight finished";
  /**
   * A stop asked for from outside: the stop file (Ctrl-C, or the launcher's pipe closing, see
   * scripts/offline-runs/launcher-watch.mjs) or the launcher's pid gone. Checked before every
   * request and every 200 ms. Synchronous and cheap.
   */
  function checkForStop(): void {
    if (budget.stopped) return;
    const { stopFile, parentPid } = options;
    if (stopFile && existsSync(stopFile)) {
      let why = "";
      try {
        why = readFileSync(stopFile, "utf8");
      } catch {
        why = "";
      }
      if (why.startsWith(LAUNCHER_GONE)) haltReason = launcherGone;
      budget.halt();
    } else if (parentPid && !processAlive(parentPid)) {
      haltReason = launcherGone;
      budget.halt();
    }
  }
  let written = false;
  const finish = (): RunResults => {
    if (!incomplete && budget.stopped === "interrupted") {
      incomplete = haltReason;
    } else if (!incomplete && budget.stopped) {
      incomplete = `the budget stop ended the run (${budget.stopped} limit)`;
    }
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
        promptSource: PROMPT_SOURCE,
        testData: true,
        incomplete,
      },
      budget: budget.snapshot(),
      pause: [...pause],
      rest: [...rest],
      split: [...split],
      times,
    };
    if (!written) {
      written = true;
      writeRunFiles(options.outDir, results, options.inputs.targets);
    }
    return results;
  };
  const watch =
    options.stopFile || options.parentPid ? setInterval(() => checkForStop(), 200) : null;
  try {
    if (has("split")) await runSplitSuite(options.inputs.split, { ...deps, env: options.env });
    if (has("rest")) await runRestSuite(options.inputs.rest, deps);
    if (has("pause")) await runPauseSuite(options.inputs.pause, deps);
  } catch (error) {
    incomplete = `the run stopped on an error (${error instanceof Error ? error.message : String(error)})`;
    // No unit may start, and no model call may be made, after the error (the other workers of the
    // suite would otherwise carry on after the report is written).
    budget.halt();
    throw error;
  } finally {
    if (watch) clearInterval(watch);
    // A launcher that was killed cannot remove the stop file its pipe watch wrote; the run does.
    if (options.stopFile) rmSync(options.stopFile, { force: true });
    finish();
  }
  return finish();
}

export function writeRunFiles(outDir: string, results: RunResults, targets: TargetsFile): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeFileSync(path.join(outDir, "targets.json"), `${JSON.stringify(targets, null, 2)}\n`);
  const sheets = scoringSheets(results);
  writeFileSync(path.join(outDir, "scoring-rest.csv"), sheets.rest);
  writeFileSync(path.join(outDir, "scoring-pause.csv"), sheets.pause);
  writeFileSync(path.join(outDir, "scoring-overblock.csv"), sheets.overblock);
  writeFileSync(path.join(outDir, "report.md"), renderReport(results, targets, NO_SHEETS));
}

/**
 * Scoring: reads `results.json`, the targets copied at run time (the targets set before the run)
 * and the filled-in sheets, and writes `report.md` again with the person measures. No model call.
 */
export function rescore(outDir: string): string {
  const read = (name: string) => readFileSync(path.join(outDir, name), "utf8");
  const sheet = (name: string) => (existsSync(path.join(outDir, name)) ? parseCsv(read(name)) : []);
  const results = JSON.parse(read("results.json")) as RunResults;
  const targets = JSON.parse(read("targets.json")) as TargetsFile;
  const sheets: Sheets = {
    rest: sheet("scoring-rest.csv"),
    pause: sheet("scoring-pause.csv"),
    overblock: sheet("scoring-overblock.csv"),
  };
  const report = renderReport(results, targets, sheets);
  writeFileSync(path.join(outDir, "report.md"), report);
  return report;
}
