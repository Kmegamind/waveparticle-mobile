// #477: an account's own run log in the Supabase stand-in (e2e/support/stub-supabase.mjs), so the
// Run panel and Runs page tests, and the visual gate, never read a run another test writes. It
// follows 20261203000000_ai_runs.sql as the shared log in stub-supabase.mjs does: start_ai_run and
// finish_ai_run need the prompt reader token and a content editor, content editors read every run
// and step, ai_run_spend sums by account between two times. Every text is short and invented.
//
//   POST /__ai_runs { token, log: "own" | "seeded" | null, failFinish?: boolean }
//        "own": that account starts with an empty log of its own; "seeded": its own log holds four
//        invented runs of today (an answer with steps, a writer's answer, a model error and a run
//        whose end was never recorded), newest first; null gives the shared log back.
//        failFinish: true makes its finish_ai_run fail (500), so a run's end is not recorded.
//   POST /__fail_reads { token, tables: ["ai_runs"] }   (stub-supabase.mjs) that read answers 500.

import { randomUUID } from "node:crypto";

/** The invented second account of the seeded log (a writer). */
export const SEEDED_WRITER = {
  id: "00000000-0000-4000-8000-00000000477a",
  email: "invented-writer@example.invalid",
};

/**
 * When a seeded run happened, `minutes` before `now`, but never before the start of the UTC day of
 * `now`: the Runs page counts "today" as the UTC day (todayWindow in src/lib/ai-runs/spend.ts), so a
 * plain "30 minutes ago" falls on yesterday in the first 30 minutes after UTC midnight (#528). Early
 * in the day the gaps shrink in the same proportion, so the order stays and the oldest run lands on
 * the day's first instant. A run that never ended still needs to be older than RUN_END_WAIT_MS (3
 * minutes) to read "End not recorded", so only the first 3 minutes of the UTC day cannot show it.
 */
export function seededRunTime(minutes, now = Date.now()) {
  const date = new Date(now);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const span = Math.min(30 * 60_000, now - dayStart);
  return new Date(now - Math.round((minutes / 30) * span)).toISOString();
}

const minutesAgo = (minutes) => seededRunTime(minutes);

function seededRuns(userId) {
  const base = {
    pasted_text: null,
    stub: true,
    model: "stub",
    error_reason: null,
  };
  const runs = [
    {
      ...base,
      id: randomUUID(),
      run_by: userId,
      run_at: minutesAgo(2),
      finished_at: minutesAgo(2),
      feature_slug: "pause_message",
      prompt_key: "stuck_story",
      prompt_source: "draft",
      prompt_version: 2,
      sample_id: "invented-lamp-maker",
      input: "Invented input: the prompt as sent, with {{persona}} filled from the sample.",
      output: "Invented output: the stub model's fixed answer.",
      input_tokens: 120,
      output_tokens: 30,
      cost: 0.00018,
      status: "ok",
    },
    {
      ...base,
      id: randomUUID(),
      run_by: SEEDED_WRITER.id,
      run_at: minutesAgo(4),
      finished_at: minutesAgo(4),
      feature_slug: "rest_reply",
      prompt_key: "rest_reply",
      prompt_source: "published",
      prompt_version: 1,
      sample_id: "invented-ferry-clerk",
      input: "Invented input of the writer's run.",
      output: "Invented output of the writer's run.",
      input_tokens: 240,
      output_tokens: 60,
      cost: 0.00036,
      status: "ok",
    },
    {
      ...base,
      id: randomUUID(),
      run_by: userId,
      run_at: minutesAgo(6),
      finished_at: minutesAgo(6),
      feature_slug: "plan_split",
      prompt_key: "plan_split",
      prompt_source: "pasted",
      prompt_version: null,
      pasted_text: "Invented pasted prompt.",
      sample_id: null,
      input: "Invented pasted prompt.",
      output: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      status: "error",
      error_reason: "timeout",
    },
    {
      ...base,
      id: randomUUID(),
      run_by: userId,
      run_at: minutesAgo(30),
      finished_at: null,
      feature_slug: "return_popup",
      prompt_key: "return_popup",
      prompt_source: "published",
      prompt_version: 1,
      sample_id: null,
      input: "Invented input of a run whose end was never recorded.",
      output: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      status: "running",
    },
  ];
  const steps = [1, 2].map((position) => ({
    run_id: runs[1].id,
    position,
    label: position === 1 ? "Invented draft" : "Invented rewrite",
    prompt_key: "rest_reply",
    prompt_version: 1,
    input: `Invented step ${position} input.`,
    output: `Invented step ${position} output.`,
    input_tokens: 120,
    output_tokens: 30,
    cost: 0.00018,
    status: "ok",
    error_reason: null,
  }));
  return { runs, steps };
}

/**
 * Answers the run log requests of an account with its own log; returns false for any other
 * request (the shared log in stub-supabase.mjs answers those).
 * @param {{ path: string, request: import("node:http").IncomingMessage,
 *   response: import("node:http").ServerResponse, url: URL, dataset: any, datasets: Map<string, any>,
 *   json: Function, matches: Function, ordered: Function, readBody: Function,
 *   promptReaderToken: string, aiFeatureState: Function }} context
 */
export async function handleAiRuns(context) {
  const { path, request, response, url, dataset, datasets, json, matches, ordered, readBody } =
    context;

  if (path === "/__ai_runs" && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const account = datasets.get(body.token);
    if (!account) {
      json(response, 404, { message: "no such account" });
      return true;
    }
    if (![null, "own", "seeded"].includes(body.log ?? null)) {
      json(response, 400, { message: "log is own, seeded or null" });
      return true;
    }
    account.aiRunLog =
      body.log === "seeded"
        ? { ...seededRuns(account.user.id), failFinish: body.failFinish === true }
        : body.log === "own"
          ? { runs: [], steps: [], failFinish: body.failFinish === true }
          : null;
    json(response, 200, { ok: true });
    return true;
  }

  const log = dataset && !dataset.deleted ? dataset.aiRunLog : null;
  if (!log) return false;
  const editor = ["admin", "writer"].includes(dataset.contentRole);

  const write = path.match(/^\/rest\/v1\/rpc\/(start_ai_run|finish_ai_run)$/);
  if (write && request.method === "POST") {
    const body = (await readBody(request)) ?? {};
    const tokenOk =
      context.promptReaderToken.length > 0 && body.server_token === context.promptReaderToken;
    if (!tokenOk || !editor) {
      json(response, 403, { code: "42501", message: "not allowed" });
      return true;
    }
    if (write[1] === "start_ai_run") {
      const run = body.run ?? {};
      if (!context.aiFeatureState(dataset).features.some((row) => row.slug === run.feature_slug)) {
        json(response, 409, { code: "23503", message: "unknown feature" });
        return true;
      }
      const id = randomUUID();
      const fields = [
        "feature_slug",
        "prompt_key",
        "prompt_source",
        "prompt_version",
        "pasted_text",
        "sample_id",
        "model",
        "input",
        "stub",
      ];
      log.runs.unshift({
        id,
        run_by: dataset.user.id,
        run_at: new Date().toISOString(),
        finished_at: null,
        ...Object.fromEntries(fields.map((name) => [name, run[name] ?? null])),
        output: null,
        input_tokens: null,
        output_tokens: null,
        cost: null,
        status: "running",
        error_reason: null,
      });
      json(response, 200, id);
      return true;
    }
    if (log.failFinish) {
      json(response, 500, { message: "stub finish failure" });
      return true;
    }
    const result = body.result ?? {};
    const row = log.runs.find(
      (item) =>
        item.id === body.run_id && item.run_by === dataset.user.id && item.status === "running",
    );
    if (!row || !["ok", "error"].includes(result.status)) {
      json(response, 404, { code: "P0002", message: "no running run" });
      return true;
    }
    for (const name of ["output", "input_tokens", "output_tokens", "cost", "status"]) {
      row[name] = result[name] ?? null;
    }
    row.error_reason = result.error_reason ?? null;
    row.finished_at = new Date().toISOString();
    for (const step of Array.isArray(result.steps) ? result.steps : []) {
      log.steps.push({ run_id: row.id, ...step });
    }
    json(response, 204);
    return true;
  }

  if (path === "/rest/v1/rpc/ai_run_spend" && request.method === "POST") {
    if (!editor) {
      json(response, 403, { code: "42501", message: "not allowed" });
      return true;
    }
    const body = (await readBody(request)) ?? {};
    const from = Date.parse(body.from_time);
    const to = Date.parse(body.to_time);
    const byUser = new Map();
    for (const run of log.runs) {
      const at = Date.parse(run.run_at);
      if (!(at >= from && at < to)) continue;
      const row = byUser.get(run.run_by) ?? {
        user_id: run.run_by,
        email:
          run.run_by === SEEDED_WRITER.id
            ? SEEDED_WRITER.email
            : dataset.user.id === run.run_by
              ? dataset.user.email
              : null,
        runs: 0,
        unpriced_runs: 0,
        running_runs: 0,
        cost: 0,
      };
      row.runs += 1;
      if (run.status === "running") row.running_runs += 1;
      if (run.cost === null || run.cost === undefined) row.unpriced_runs += 1;
      else row.cost += Number(run.cost);
      byUser.set(run.run_by, row);
    }
    json(
      response,
      200,
      [...byUser.values()].sort((a, b) => b.cost - a.cost),
    );
    return true;
  }

  const table = path.match(/^\/rest\/v1\/(ai_runs|ai_run_steps)$/);
  if (table && request.method === "GET") {
    if ((dataset.failReads ?? []).includes(table[1])) {
      json(response, 500, { message: "stub read failure" });
      return true;
    }
    const all = table[1] === "ai_runs" ? log.runs : log.steps;
    const params = [...url.searchParams.entries()];
    const rows = ordered(
      (editor ? all : []).filter((row) => matches(row, params)),
      url.searchParams.get("order"),
    );
    json(response, 200, rows);
    return true;
  }
  return false;
}
