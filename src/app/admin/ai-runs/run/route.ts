import { NextResponse } from "next/server";
import { readContentRole } from "@/lib/admin/roles";
import { readPrices } from "@/lib/ai-runs/cost";
import { labModelFromEnv } from "@/lib/ai-runs/model";
import { RUN_BODY_MAX_BYTES, runRequestProblem } from "@/lib/ai-runs/request-guard";
import { runPrompt, type RunDeps, type RunError, type RunFeature } from "@/lib/ai-runs/run";
import { logEvent } from "@/lib/logging/server-log";
import { readPromptVersions } from "@/lib/prompts/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

// #476 (FR-AILAB-1 to FR-AILAB-3; AI-RUN-PERMISSION, AI-RUN-LIVE, AI-LAB-STUB): POST
// /admin/ai-runs/run runs one prompt of a registry feature through the configured model and
// records the run. The proxy already answers 404 under /admin to anyone without a content role;
// this route refuses another site's request and checks the account and its role again before
// anything is read or sent. The model key stays on the server (FR-AILAB-2): it is read here and
// used only in the provider request. The run's row is written through public.start_ai_run BEFORE
// the model call and ended through public.finish_ai_run, with the user's own client and the
// server's prompt reader token, so only this route can write a run. Tests and agents use the stub
// model only.

/**
 * Seconds Vercel lets this function run: the lab call's 120 s (LAB_TIME_LIMIT_MS) plus 30 s for the
 * reads and the two run log writes. Needs Fluid compute or a plan that allows it (Human steps).
 */
export const maxDuration = 150;

const STATUS: Record<RunError, number> = {
  "not-allowed": 403,
  invalid: 400,
  "unknown-feature": 404,
  "unknown-prompt": 404,
  "unknown-sample": 404,
  "unknown-model": 400,
  "no-model": 503,
  "no-run-log": 503,
  "not-recorded": 503,
  "prompt-problem": 422,
  failed: 500,
};

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

let pricesWarned = false;
function warnPrices() {
  if (pricesWarned) return;
  pricesWarned = true;
  logEvent("ai-runs", { event: "ai_run_prices_malformed" }, { level: "warn" });
}

export async function POST(request: Request) {
  const problem = runRequestProblem(request.headers, request.url);
  if (problem) {
    const status = problem === "cross-origin" ? 403 : problem === "not-json" ? 415 : 413;
    return NextResponse.json({ ok: false, error: problem }, { status, headers: NO_STORE });
  }

  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  const role = user ? await readContentRole(client) : null;

  let body: unknown = null;
  try {
    const text = await request.text();
    body = text.length > RUN_BODY_MAX_BYTES ? null : JSON.parse(text);
  } catch {
    body = null;
  }

  const serverToken = process.env.PROMPTS_READ_TOKEN?.trim() ?? "";
  const deps: RunDeps = {
    userId: user?.id ?? null,
    role,
    readFeature: async (slug) => {
      const { data, error } = await client
        .from("ai_features")
        .select("slug,category,prompt_keys")
        .eq("slug", slug)
        .limit(1);
      if (error || !Array.isArray(data)) return null;
      return (data[0] as RunFeature | undefined) ?? undefined;
    },
    readPromptVersions: () =>
      readPromptVersions(async (name, args) => {
        const { data, error } = await client.rpc(name, args);
        return { data, error };
      }),
    // The sample library comes in #479; until then no sample id is known.
    readSample: async () => undefined,
    model: labModelFromEnv(process.env),
    prices: readPrices(process.env, warnPrices),
    runLog: serverToken
      ? {
          start: async (run) => {
            const { data, error } = await client.rpc("start_ai_run", {
              server_token: serverToken,
              run,
            });
            return error || typeof data !== "string" ? null : data;
          },
          finish: async (runId, result) => {
            const { error } = await client.rpc("finish_ai_run", {
              server_token: serverToken,
              run_id: runId,
              result,
            });
            return !error;
          },
        }
      : null,
  };

  const result = await runPrompt(body as Parameters<typeof runPrompt>[0], deps);
  const status = result.ok || result.error === "model-error" ? 200 : STATUS[result.error];
  return NextResponse.json(result, { status, headers: NO_STORE });
}
