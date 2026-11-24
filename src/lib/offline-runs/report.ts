import type { BudgetSnapshot } from "./budget";
import {
  pauseMeasures,
  personMeasures,
  restMeasures,
  splitByKind,
  splitMeasures,
  type Measure,
  type ScoreRow,
} from "./metrics";
import type { PauseRecord, RestRecord, SplitRecord, TimeReadRecord } from "./suites";

/**
 * The report of an offline run (#42): a summary table of every target with PASS or FAIL and the
 * user story and issue it belongs to, then the report-only measures, cost and budget. Nothing is
 * gated automatically; what "blocks release" means is the owner's decision.
 */

export type Target = {
  id: string;
  suite: "pause" | "rest" | "split";
  story: string;
  issue: number;
  measure: string;
  kind: "max" | "min" | "equal";
  value: number;
  unit: "rate" | "count" | "ms";
  blocks: boolean;
  source: "machine" | "person";
};

export type TargetsFile = { status: string; setOn: string; note: string; targets: Target[] };

export type RunResults = {
  meta: {
    mode: "stub" | "real";
    model: string;
    startedAt: string;
    endedAt: string;
    suites: string[];
    prompts: { key: string; version: number }[];
    testData: true;
  };
  budget: BudgetSnapshot;
  pause: PauseRecord[];
  rest: RestRecord[];
  split: SplitRecord[];
  times: TimeReadRecord[];
};

export type Status = "PASS" | "FAIL" | "PENDING SCORING" | "NO DATA";

export type TargetRow = Target & { result: Measure | null; status: Status };

export function machineMeasures(results: RunResults): Record<string, Measure> {
  const out: Record<string, Measure> = {};
  const add = (prefix: string, measures: Record<string, Measure>) => {
    for (const [name, measure] of Object.entries(measures)) out[`${prefix}.${name}`] = measure;
  };
  if (results.pause.length > 0) {
    add("pause", pauseMeasures(results.pause, "on"));
    add("pause_off", pauseMeasures(results.pause, "off"));
  }
  if (results.rest.length > 0) add("rest", restMeasures(results.rest));
  if (results.split.length > 0 || results.times.length > 0) {
    add("split", splitMeasures(results.split, results.times));
  }
  return out;
}

export function compare(target: Target, measure: Measure | null | undefined): Status {
  if (measure === null || measure === undefined) {
    return target.source === "person" ? "PENDING SCORING" : "NO DATA";
  }
  if (measure.value === null) return "NO DATA";
  const ok =
    target.kind === "max"
      ? measure.value <= target.value
      : target.kind === "min"
        ? measure.value >= target.value
        : measure.value === target.value;
  return ok ? "PASS" : "FAIL";
}

export function evaluate(
  results: RunResults,
  targets: TargetsFile,
  sheets: { pause: ScoreRow[]; rest: ScoreRow[] },
): TargetRow[] {
  const machine = machineMeasures(results);
  const person = personMeasures(sheets);
  return targets.targets.map((target) => {
    const ran = results.meta.suites.includes(target.suite);
    const result = !ran
      ? null
      : target.source === "person"
        ? (person[target.id] ?? null)
        : (machine[target.id] ?? null);
    const status: Status = !ran ? "NO DATA" : compare(target, result);
    return { ...target, result, status };
  });
}

function show(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "-";
  if (unit === "rate") return `${(value * 100).toFixed(1)}%`;
  if (unit === "ms") return `${Math.round(value)} ms`;
  return String(Math.round(value * 1000) / 1000);
}

function showMeasure(measure: Measure | null | undefined, unit: string): string {
  if (!measure) return "-";
  const base = show(measure.value, unit);
  return measure.of !== undefined ? `${base} (${measure.count} of ${measure.of})` : base;
}

const unitOf = (name: string) =>
  name.includes("latency")
    ? "ms"
    : name.endsWith("_rate") || measureIsRate(name)
      ? "rate"
      : "count";
const measureIsRate = (name: string) =>
  /(first_attempt|worried|escalation|stated_correct)/.test(name);

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderReport(
  results: RunResults,
  targets: TargetsFile,
  sheets: { pause: ScoreRow[]; rest: ScoreRow[] },
): string {
  const rows = evaluate(results, targets, sheets);
  const machine = machineMeasures(results);
  const { budget, meta } = results;
  const failing = rows.filter((row) => row.status === "FAIL");
  const lines: string[] = [];
  lines.push(`# Offline run ${meta.startedAt.slice(0, 10)} (#42, US-AI-12)`);
  lines.push("");
  lines.push(
    `TEST DATA: the inputs are written for this test, not product content. Mode: **${meta.mode}**${
      meta.mode === "stub" ? " (the stub model; these numbers say nothing about a real model)" : ""
    }. Model: \`${meta.model}\`. Suites: ${meta.suites.join(", ")}.`,
  );
  if (budget.stopped) {
    lines.push("");
    lines.push(
      `**The budget stop ended this run early (${budget.stopped} limit).** Units after the stop were not run; the measures cover only the units that finished.`,
    );
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(
    `Targets: ${targets.status} (set ${targets.setOn}). Nothing is gated automatically; a FAIL names the user story and issue it belongs to. What "a failed target blocks the matching story from release" means is open for the owner.`,
  );
  lines.push("");
  lines.push("| Status | Story | Issue | Target | Measure | Target value | Result | Blocks |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    const sign = row.kind === "max" ? "≤" : row.kind === "min" ? "≥" : "=";
    lines.push(
      `| ${row.status} | ${row.story} | #${row.issue} | \`${row.id}\` | ${cell(row.measure)} | ${sign} ${show(row.value, row.unit)} | ${showMeasure(row.result, row.unit)} | ${row.blocks ? "yes" : "report only"} |`,
    );
  }
  lines.push("");
  lines.push(
    failing.length === 0
      ? "No target failed."
      : `Failed: ${failing.map((row) => `\`${row.id}\` (${row.story}, #${row.issue})`).join(", ")}.`,
  );
  const pending = rows.filter((row) => row.status === "PENDING SCORING");
  if (pending.length > 0) {
    lines.push("");
    lines.push(
      `Pending scoring: ${pending.map((row) => `\`${row.id}\``).join(", ")}. Fill in \`scoring-rest.csv\` and \`scoring-pause.csv\`, then run the report again (see \`docs/architecture/offline-runs.md\`).`,
    );
  }
  lines.push("");
  lines.push("## All measures (report only unless named above)");
  lines.push("");
  lines.push("| Measure | Result |");
  lines.push("|---|---|");
  for (const [name, measure] of Object.entries(machine)) {
    lines.push(`| \`${name}\` | ${showMeasure(measure, unitOf(name))} |`);
  }
  if (results.split.length > 0) {
    lines.push("");
    lines.push("Valid first attempt by `kind` label:");
    lines.push("");
    for (const [kind, measure] of Object.entries(splitByKind(results.split))) {
      lines.push(`- ${kind}: ${showMeasure(measure, "rate")}`);
    }
  }
  const wrongTimes = results.times.filter(
    (time) => time.foundMinutes !== (time.ambiguous ? null : time.expectedMinutes),
  );
  if (wrongTimes.length > 0) {
    lines.push("");
    lines.push("Time readings that differ from the label (local rule `findTimeInGoal`):");
    lines.push("");
    for (const time of wrongTimes) {
      lines.push(
        `- \`${time.lineId}\` "${cell(time.goal)}": expected ${time.ambiguous ? "none" : (time.expectedMinutes ?? "none")}, found ${time.foundMinutes ?? "none"}`,
      );
    }
  }
  lines.push("");
  lines.push("## Cost and budget");
  lines.push("");
  lines.push(
    `- Calls: ${budget.calls} of at most ${budget.maxCalls}. Estimated cost: $${budget.costUsd.toFixed(4)} of at most $${budget.maxCostUsd}.`,
  );
  lines.push(
    `- Tokens: ${budget.inputTokens} input, ${budget.outputTokens} output; ${budget.estimatedUsageCalls} calls had no usage from the provider and were estimated at ${4} characters per token.`,
  );
  lines.push(
    `- Prices per million tokens: $${budget.prices.inputPerMillion} input, $${budget.prices.outputPerMillion} output (${budget.prices.source}).`,
  );
  lines.push("");
  lines.push("## Prompts");
  lines.push("");
  lines.push(meta.prompts.map((prompt) => `\`${prompt.key}\` v${prompt.version}`).join(", "));
  lines.push("");
  lines.push(`Started ${meta.startedAt}, ended ${meta.endedAt}.`);
  return `${lines.join("\n")}\n`;
}

/** CSV with every value quoted (RFC 4180). */
export function toCsv(header: string[], rows: Record<string, unknown>[]): string {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return `${[header.map(quote).join(","), ...rows.map((row) => header.map((name) => quote(row[name])).join(","))].join("\n")}\n`;
}

export function parseCsv(text: string): ScoreRow[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header, ...rows] = records.filter((row) => row.some((value) => value !== ""));
  if (!header) return [];
  return rows.map((row) => Object.fromEntries(header.map((name, at) => [name, row[at] ?? ""])));
}

export const REST_SHEET_HEADER = [
  "id",
  "group",
  "step",
  "message",
  "reply",
  "relevance",
  "in_character",
  "advising",
  "notes",
];
export const PAUSE_SHEET_HEADER = [
  "id",
  "story",
  "run",
  "pause",
  "stuck_story",
  "message",
  "event",
  "notes",
];

/** The scoring sheets: shown replies and shown pause messages (arm on), with blank columns. */
export function scoringSheets(results: RunResults): { rest: string; pause: string } {
  const rest = results.rest
    .filter((record) => record.status === "ok")
    .map((record) => ({
      id: `${record.messageId}@${record.stepIndex + 1}of${record.stepCount}`,
      group: record.group,
      step: `${record.stepIndex + 1} of ${record.stepCount}`,
      message: record.message,
      reply: record.reply,
    }));
  const pause = results.pause
    .filter((record) => record.arm === "on" && record.status === "ok")
    .map((record) => ({
      id: `${record.storyId}.r${record.run}.p${record.pause}`,
      story: record.storyId,
      run: record.run,
      pause: record.pause,
      stuck_story: record.story,
      message: record.message,
    }));
  return { rest: toCsv(REST_SHEET_HEADER, rest), pause: toCsv(PAUSE_SHEET_HEADER, pause) };
}
