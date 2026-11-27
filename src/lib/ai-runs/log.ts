import { personName } from "@/lib/publish-history/admin";
import { todayWindow } from "./spend";

// #477 (FR-AILAB-3; AI-RUN-PERMISSION, AI-LAB-STUB; docs/decisions/0034): the Runs page
// (/admin/ai-runs) reads the run log, public.ai_runs, through the signed-in editor's own client
// (row level security: content editors only). Every run is listed, newest first, with who, when,
// feature, prompt version, sample, model, tokens, cost and the stub flag; a run that was started
// and never ended is shown as such, never hidden.

/** How many runs the page lists, newest first. Older runs stay in the database. */
export const RUNS_SHOWN = 500;

/**
 * After this long a run still marked running will not end any more: the route's limit
 * (maxDuration, 150 s) plus 30 s. Its end was not recorded; the call may still have been billed.
 */
export const RUN_END_WAIT_MS = 180_000;

export type RunLogRow = {
  id: string;
  run_by: string | null;
  run_at: string;
  finished_at: string | null;
  feature_slug: string;
  prompt_key: string;
  prompt_source: "published" | "draft" | "pasted";
  prompt_version: number | null;
  pasted_text?: string | null;
  sample_id: string | null;
  model: string;
  input?: string;
  output?: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | string | null;
  stub: boolean;
  status: "running" | "ok" | "error";
  error_reason: string | null;
};

export type RunStepRow = {
  run_id: string;
  position: number;
  label: string;
  prompt_key: string | null;
  prompt_version: number | null;
  input: string;
  output: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | string | null;
  status: "ok" | "error";
  error_reason: string | null;
};

export type RunState = "ok" | "error" | "running" | "not-recorded";

export const RUN_STATE_LABEL: Record<RunState, string> = {
  ok: "Answered",
  error: "Model error",
  running: "Run in progress",
  "not-recorded": "End not recorded",
};

/** A run's state; a run still running after RUN_END_WAIT_MS will never end: "not-recorded". */
export function runState(row: Pick<RunLogRow, "status" | "run_at">, now: Date): RunState {
  if (row.status === "ok" || row.status === "error") return row.status;
  const started = Date.parse(row.run_at);
  if (Number.isFinite(started) && now.getTime() - started > RUN_END_WAIT_MS) {
    return "not-recorded";
  }
  return "running";
}

/** The cost as a number (PostgREST sends numeric as a number or a string), or null. */
export function costOf(row: Pick<RunLogRow, "cost">): number | null {
  if (row.cost === null || row.cost === undefined) return null;
  const value = typeof row.cost === "string" ? Number(row.cost) : row.cost;
  return Number.isFinite(value) ? value : null;
}

export type RunFilter = { feature: string; user: string; model: string; stubOnly: boolean };

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/** The filter from the page address (?feature=&user=&model=&stub=1). */
export function parseRunFilter(params: Record<string, string | string[] | undefined>): RunFilter {
  return {
    feature: first(params.feature),
    user: first(params.user),
    model: first(params.model),
    stubOnly: first(params.stub) === "1",
  };
}

/** The runs that match the filter; an empty value matches every run. */
export function filterRuns<T extends RunLogRow>(rows: T[], filter: RunFilter): T[] {
  return rows.filter(
    (row) =>
      (!filter.feature || row.feature_slug === filter.feature) &&
      (!filter.user || row.run_by === filter.user) &&
      (!filter.model || row.model === filter.model) &&
      (!filter.stubOnly || row.stub),
  );
}

/** The address of the page with this filter and, optionally, a chosen run. */
export function runsHref(filter: RunFilter, run?: string | null): string {
  const query = new URLSearchParams();
  if (filter.feature) query.set("feature", filter.feature);
  if (filter.user) query.set("user", filter.user);
  if (filter.model) query.set("model", filter.model);
  if (filter.stubOnly) query.set("stub", "1");
  if (run) query.set("run", run);
  const text = query.toString();
  return text ? `/admin/ai-runs?${text}` : "/admin/ai-runs";
}

/** Today's (UTC) runs: how many, how many by the stub model and how many by a real model. */
export function todayCounts(
  rows: Pick<RunLogRow, "run_at" | "stub">[],
  now: Date,
): { runs: number; stub: number; real: number } {
  const window = todayWindow(now);
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const today = rows.filter((row) => {
    const at = Date.parse(row.run_at);
    return at >= from && at < to;
  });
  const stub = today.filter((row) => row.stub).length;
  return { runs: today.length, stub, real: today.length - stub };
}

/** Account id → email, from public.ai_run_spend's rows (any time window). */
export function peopleFromSpend(rows: unknown): Map<string, string | null> {
  const people = new Map<string, string | null>();
  if (!Array.isArray(rows)) return people;
  for (const row of rows as Record<string, unknown>[]) {
    if (typeof row.user_id === "string") {
      people.set(row.user_id, typeof row.email === "string" ? row.email : null);
    }
  }
  return people;
}

/** Who ran it: the email, "Account 1234abcd", or "Deleted account". */
export function runBy(userId: string | null, people: Map<string, string | null>): string {
  return personName(userId, userId ? (people.get(userId) ?? null) : null);
}
