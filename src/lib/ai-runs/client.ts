// #478: the browser's one way to call the Run route (POST /admin/ai-runs/run, #476), shared by the
// Run panel (#477) and the comparison lab (#478), so both read the route's answers the same way.
// No server code and no model key: the route checks the account, records the run and calls the
// model.

/** A finished run as the route answers it (RunResult with ok: true, src/lib/ai-runs/run.ts). */
export type RunAnswer = {
  ok: true;
  runId: string;
  recorded: boolean;
  output: string;
  checks:
    { applied: true; passed: boolean; failedRules: string[] } | { applied: false; note: string };
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  costNote: string | null;
  stub: boolean;
  model: string;
  promptVersion: number | null;
};

export type RunReply =
  | { kind: "answer"; answer: RunAnswer }
  | { kind: "model-error"; reason: string; recorded: boolean; stub: boolean }
  /** Refused before the model was called; "network" when the server did not answer. */
  | { kind: "refused"; error: string; problems: string[] };

/** Posts one run request to the Run route and reads its answer. Never throws. */
export async function postRun(
  request: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<RunReply> {
  try {
    const response = await fetchImpl("/admin/ai-runs/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (result?.ok === true) return { kind: "answer", answer: result as unknown as RunAnswer };
    if (result?.error === "model-error") {
      return {
        kind: "model-error",
        reason: String(result.reason ?? "request"),
        recorded: result.recorded !== false,
        stub: result.stub === true,
      };
    }
    return {
      kind: "refused",
      error: typeof result?.error === "string" ? result.error : "failed",
      problems: Array.isArray(result?.problems) ? result.problems.map(String) : [],
    };
  } catch {
    return { kind: "refused", error: "network", problems: [] };
  }
}
