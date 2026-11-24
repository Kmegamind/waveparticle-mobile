import { costUsd, type BudgetSnapshot } from "./budget";
import {
  pauseMeasures,
  restMeasures,
  splitByKind,
  splitMeasures,
  type Measure,
  type ScoreRow,
} from "./metrics";
import {
  OVERBLOCK_SHEET_HEADER,
  PAUSE_SHEET_HEADER,
  REST_SHEET_HEADER,
  personResult,
  sheetRows,
  type Sheets,
} from "./scoring";
import type { PauseRecord, RestRecord, SplitRecord, TimeReadRecord } from "./suites";

/**
 * The report of an offline run (#42): a summary table of every target with PASS or FAIL and the
 * user story and issue it belongs to, then the report-only measures, cost and budget. Nothing is
 * gated automatically; what "blocks release" means is the owner's decision. A run that did not
 * finish is INCOMPLETE and gets no verdict.
 */

export type Target = {
  id: string;
  suite: "pause" | "rest" | "split";
  story: string;
  issue: number;
  measure: string;
  /** max: at most; below: less than (strict); min: at least; above: more than (strict). */
  kind: "max" | "below" | "min" | "above" | "equal";
  value: number;
  unit: "rate" | "count" | "ms";
  blocks: boolean;
  source: "machine" | "person";
  /** Proposed, not owner-approved. */
  proposed?: boolean;
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
    /** Where the prompts came from: the seed files, not the database's active rows. */
    promptSource: string;
    testData: true;
    /** Why the run did not finish (a budget stop, an error, an interrupt), or null. */
    incomplete: string | null;
  };
  budget: BudgetSnapshot;
  pause: PauseRecord[];
  rest: RestRecord[];
  split: SplitRecord[];
  times: TimeReadRecord[];
};

export type Status =
  "PASS" | "FAIL" | "PENDING SCORING" | "INVALID SCORING" | "INCOMPLETE" | "NO DATA";

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

export function meets(target: Pick<Target, "kind" | "value">, value: number): boolean {
  switch (target.kind) {
    case "max":
      return value <= target.value;
    case "below":
      return value < target.value;
    case "min":
      return value >= target.value;
    case "above":
      return value > target.value;
    default:
      return value === target.value;
  }
}

export function compare(target: Target, measure: Measure | null | undefined): Status {
  if (measure === null || measure === undefined) {
    return target.source === "person" ? "PENDING SCORING" : "NO DATA";
  }
  if (measure.value === null) return "NO DATA";
  return meets(target, measure.value) ? "PASS" : "FAIL";
}

export function evaluate(results: RunResults, targets: TargetsFile, sheets: Sheets): TargetRow[] {
  const machine = machineMeasures(results);
  const person = personResult(results, sheets);
  return targets.targets.map((target) => {
    const ran = results.meta.suites.includes(target.suite);
    const result = !ran
      ? null
      : target.source === "person"
        ? (person.measures[target.id] ?? null)
        : (machine[target.id] ?? null);
    let status: Status = !ran ? "NO DATA" : compare(target, result);
    if (ran && target.source === "person") {
      if (person.unscorable[target.id]) status = "NO DATA";
      else if (person.invalid.has(target.id)) status = "INVALID SCORING";
    }
    // A run that did not finish has no verdict: its data is partial and biased (units run in order).
    if (results.meta.incomplete && (status === "PASS" || status === "FAIL")) status = "INCOMPLETE";
    return { ...target, result, status };
  });
}

const SIGNS: Record<Target["kind"], string> = {
  max: "≤",
  below: "<",
  min: "≥",
  above: ">",
  equal: "=",
};

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

const unitOf = (name: string) => {
  if (name.includes("latency")) return "ms";
  if (/(_rate|first_attempt|worried|escalation|stated_correct)/.test(name)) return "rate";
  return "count";
};

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderReport(results: RunResults, targets: TargetsFile, sheets: Sheets): string {
  const rows = evaluate(results, targets, sheets);
  const person = personResult(results, sheets);
  const machine = machineMeasures(results);
  const { budget, meta } = results;
  const failing = rows.filter((row) => row.status === "FAIL");
  const lines: string[] = [];
  const add = (...items: string[]) => lines.push(...items);
  add(`# Offline run ${meta.startedAt.slice(0, 10)} (#42, US-AI-12)`, "");
  add(
    `TEST DATA: the inputs are written for this test, not product content. Mode: **${meta.mode}**${
      meta.mode === "stub" ? " (the stub model; these numbers say nothing about a real model)" : ""
    }. Model: \`${meta.model}\`. Suites: ${meta.suites.join(", ")}.`,
    "",
    `Prompts: ${meta.promptSource}. Compare their versions (under Prompts below) with the active rows in /admin/prompts before trusting a real run.`,
  );
  if (meta.incomplete) {
    add(
      "",
      `**INCOMPLETE: ${meta.incomplete}.** The measures cover only the units that finished, and units run in order (split, rest, then pause arm on before off), so they are biased. No target gets PASS or FAIL.`,
    );
  }
  const unscorable = Object.entries(person.unscorable);
  if (unscorable.length > 0) {
    add(
      "",
      `Cannot be scored in this run: ${unscorable.map(([id, reason]) => `\`${id}\` (${reason})`).join("; ")}.`,
    );
  }
  if (person.problems.length > 0) {
    add("", "**Scoring sheet problems** (the measures that use them show INVALID SCORING):", "");
    for (const problem of person.problems) add(`- ${cell(problem)}`);
  }
  add("", "## Summary", "");
  add(
    `Targets: ${targets.status} (set ${targets.setOn}). Nothing is gated automatically; a FAIL names the user story and issue it belongs to. What "a failed target blocks the matching story from release" means is open for the owner.`,
    "",
    "| Status | Story | Issue | Target | Measure | Target value | Result | Blocks |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const row of rows) {
    add(
      `| ${row.status} | ${row.story} | #${row.issue} | \`${row.id}\` | ${cell(row.measure)} | ${SIGNS[row.kind]} ${show(row.value, row.unit)}${row.proposed ? " (proposed)" : ""} | ${showMeasure(row.result, row.unit)} | ${row.blocks ? "yes" : "report only"} |`,
    );
  }
  add(
    "",
    failing.length === 0
      ? "No target failed."
      : `Failed: ${failing.map((row) => `\`${row.id}\` (${row.story}, #${row.issue})`).join(", ")}.`,
  );
  const pending = rows.filter((row) => row.status === "PENDING SCORING");
  if (pending.length > 0) {
    add(
      "",
      `Pending scoring: ${pending.map((row) => `\`${row.id}\``).join(", ")}. Fill in \`scoring-rest.csv\`, \`scoring-pause.csv\` and \`scoring-overblock.csv\`, then run the report again (see \`docs/architecture/offline-runs.md\`).`,
    );
  }
  add(
    "",
    "## All measures (report only unless named above)",
    "",
    "| Measure | Result |",
    "|---|---|",
  );
  for (const [name, measure] of Object.entries(machine)) {
    add(`| \`${name}\` | ${showMeasure(measure, unitOf(name))} |`);
  }
  if (results.split.length > 0) {
    add("", "Valid first attempt by `kind` label:", "");
    for (const [kind, measure] of Object.entries(splitByKind(results.split))) {
      add(`- ${kind}: ${showMeasure(measure, "rate")}`);
    }
  }
  const wrongTimes = results.times.filter(
    (time) => time.foundMinutes !== (time.ambiguous ? null : time.expectedMinutes),
  );
  if (wrongTimes.length > 0) {
    add("", "Time readings that differ from the label (local rule `findTimeInGoal`):", "");
    for (const time of wrongTimes) {
      add(
        `- \`${time.lineId}\` "${cell(time.goal)}": expected ${time.ambiguous ? "none" : (time.expectedMinutes ?? "none")}, found ${time.foundMinutes ?? "none"}`,
      );
    }
  }
  add("", "## Cost and budget", "");
  add(
    `- Calls: ${budget.calls} of at most ${budget.maxCalls}. Estimated cost: $${budget.costUsd.toFixed(4)} of at most $${budget.maxCostUsd}.`,
    `- Tokens: ${budget.inputTokens} input, ${budget.outputTokens} output; ${budget.estimatedUsageCalls} calls had no usage from the provider and were estimated at 4 characters per token (a failed or timed-out call counts its output at the most, max_tokens).`,
  );
  const perUnit: [string, { inputTokens: number; outputTokens: number }[]][] = [
    ["pause message (arm on)", results.pause.filter((record) => record.arm === "on")],
    ["pause message (arm off)", results.pause.filter((record) => record.arm === "off")],
    ["rest reply", results.rest],
    ["split", results.split],
  ];
  for (const [label, records] of perUnit) {
    if (records.length === 0) continue;
    const tokensIn = records.reduce((sum, record) => sum + record.inputTokens, 0) / records.length;
    const tokensOut =
      records.reduce((sum, record) => sum + record.outputTokens, 0) / records.length;
    add(
      `- Per ${label}: ${Math.round(tokensIn)} input and ${Math.round(tokensOut)} output tokens, $${costUsd(tokensIn, tokensOut, budget.prices).toFixed(5)} on average (${records.length} units).`,
    );
  }
  add(
    `- Prices per million tokens: $${budget.prices.inputPerMillion} input, $${budget.prices.outputPerMillion} output (${budget.prices.source}).`,
    "",
    "## Prompts",
    "",
    meta.prompts.map((prompt) => `\`${prompt.key}\` v${prompt.version}`).join(", "),
    "",
    `Started ${meta.startedAt}, ended ${meta.endedAt}.`,
  );
  return `${lines.join("\n")}\n`;
}

/** CSV with every value quoted (RFC 4180). */
export function toCsv(header: string[], rows: Record<string, unknown>[]): string {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return `${[header.map(quote).join(","), ...rows.map((row) => header.map((name) => quote(row[name])).join(","))].join("\n")}\n`;
}

export function parseCsv(input: string): ScoreRow[] {
  // A sheet saved by a spreadsheet program may start with a byte order mark.
  const text = input.replace(/^﻿/, "");
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

/** The scoring sheets, with blank columns for the person's read. */
export function scoringSheets(results: RunResults): {
  rest: string;
  pause: string;
  overblock: string;
} {
  const rows = sheetRows(results);
  return {
    rest: toCsv(REST_SHEET_HEADER, rows.rest),
    pause: toCsv(PAUSE_SHEET_HEADER, rows.pause),
    overblock: toCsv(OVERBLOCK_SHEET_HEADER, rows.overblock),
  };
}
