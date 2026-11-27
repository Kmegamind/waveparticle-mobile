// #478: the comparison lab's saved answers in the Supabase stand-in (e2e/support/stub-supabase.mjs),
// for an account with its own run log (POST /__ai_runs { token, log: "own" }, stub-ai-runs.mjs).
// It follows 20261206000000_ai_comparisons.sql: save_ai_comparison needs a content editor, two
// different runs of this account, both ended ok, of one feature and one sample, a feature with
// pass questions and one true or false answer per question for each side; a run belongs to at
// most one comparison. Content editors read the rows (GET /rest/v1/ai_comparisons).

import { randomUUID } from "node:crypto";

/**
 * Answers the comparison requests of an account with its own run log; returns false for any
 * other request.
 * @param {{ path: string, request: import("node:http").IncomingMessage,
 *   response: import("node:http").ServerResponse, url: URL, dataset: any, json: Function,
 *   matches: Function, ordered: Function, readBody: Function, aiFeatureState: Function }} context
 */
export async function handleAiComparisons(context) {
  const { path, request, response, url, dataset, json, matches, ordered, readBody } = context;
  const log = dataset && !dataset.deleted ? dataset.aiRunLog : null;
  if (!log) return false;
  const editor = ["admin", "writer"].includes(dataset.contentRole);
  log.comparisons ??= [];

  if (path === "/rest/v1/rpc/save_ai_comparison" && request.method === "POST") {
    if (!editor) {
      json(response, 403, { code: "42501", message: "not allowed" });
      return true;
    }
    const comparison = (await readBody(request))?.comparison;
    const bad = (message) => json(response, 400, { code: "22023", message });
    if (
      typeof comparison !== "object" ||
      comparison === null ||
      typeof comparison.run_a !== "string" ||
      typeof comparison.run_b !== "string" ||
      typeof comparison.blind !== "boolean" ||
      !Array.isArray(comparison.answers_a) ||
      !Array.isArray(comparison.answers_b)
    ) {
      bad("not a comparison");
      return true;
    }
    const a = log.runs.find((run) => run.id === comparison.run_a);
    const b = log.runs.find((run) => run.id === comparison.run_b);
    if (!a || !b) {
      json(response, 404, { code: "P0002", message: "no such run" });
      return true;
    }
    if (
      a.id === b.id ||
      a.run_by !== dataset.user.id ||
      b.run_by !== dataset.user.id ||
      a.status !== "ok" ||
      b.status !== "ok" ||
      a.feature_slug !== b.feature_slug ||
      (a.sample_id ?? null) !== (b.sample_id ?? null)
    ) {
      bad("the two runs must be your own, ended ok, of one feature and one sample");
      return true;
    }
    if (
      log.comparisons.some((row) => [row.run_a, row.run_b].some((id) => id === a.id || id === b.id))
    ) {
      json(response, 409, { code: "23505", message: "a run already belongs to a comparison" });
      return true;
    }
    const feature = context
      .aiFeatureState(dataset)
      .features.find((row) => row.slug === a.feature_slug);
    const questions = (feature?.pass_questions ?? []).map((item) => item.text);
    const oneEach = (list) =>
      list.length === questions.length && list.every((item) => typeof item === "boolean");
    if (
      questions.length === 0 ||
      !oneEach(comparison.answers_a) ||
      !oneEach(comparison.answers_b)
    ) {
      bad("one yes or no answer per pass question for each side");
      return true;
    }
    const id = randomUUID();
    log.comparisons.unshift({
      id,
      saved_by: dataset.user.id,
      saved_at: new Date().toISOString(),
      feature_slug: a.feature_slug,
      sample_id: a.sample_id ?? null,
      run_a: a.id,
      run_b: b.id,
      blind: comparison.blind,
      questions,
      answers_a: comparison.answers_a,
      answers_b: comparison.answers_b,
    });
    json(response, 200, id);
    return true;
  }

  if (path === "/rest/v1/ai_comparisons" && request.method === "GET") {
    const rows = ordered(
      (editor ? log.comparisons : []).filter((row) =>
        matches(row, [...url.searchParams.entries()]),
      ),
      url.searchParams.get("order"),
    );
    json(response, 200, rows);
    return true;
  }
  return false;
}
