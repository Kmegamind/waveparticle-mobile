import { expect, test, type APIRequestContext } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #476 (FR-AILAB-1 to FR-AILAB-3; AI-RUN-PERMISSION, AI-LAB-STUB): POST /admin/ai-runs/run on the
// "mobile-live" app, whose model is the stub model (e2e/support/stub-model.mjs: 120 input and 30
// output tokens per answer) with a test price of 1 and 2 dollars per million tokens
// (playwright.config.ts, AI_RUN_PRICES). No real model is ever called. Every run is read back from
// the Supabase stand-in as the writer who made it, so parallel tests never meet.

const RUN = "/admin/ai-runs/run";
const body = (over: Record<string, unknown> = {}) => ({
  feature: "rest_reply",
  promptKey: "rest_reply",
  prompt: { source: "published" },
  sample: null,
  model: "stub",
  ...over,
});

type Run = Record<string, unknown>;

async function runsOf(token: string, userId: string): Promise<Run[]> {
  const response = await fetch(`${STUB_SUPABASE}/rest/v1/ai_runs?run_by=eq.${userId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Run[];
}

async function allRunCount(token: string): Promise<number> {
  const response = await fetch(`${STUB_SUPABASE}/rest/v1/ai_runs`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return ((await response.json()) as Run[]).length;
}

const post = (request: APIRequestContext, data: unknown) => request.post(RUN, { data });

test("test_476_a_writer_runs_a_prompt_and_the_run_is_recorded_with_tokens_and_cost", async ({
  page,
  context,
}) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const response = await post(page.request, body());
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({
    ok: true,
    recorded: true,
    inputTokens: 120,
    outputTokens: 30,
    cost: 0.00018,
    costNote: null,
    stub: true,
    model: "stub",
    checks: { applied: false, note: "The checks need a sample." },
  });
  expect(typeof result.output).toBe("string");

  const runs = await runsOf(writer.token, writer.userId);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    id: result.runId,
    feature_slug: "rest_reply",
    prompt_key: "rest_reply",
    prompt_source: "published",
    sample_id: null,
    model: "stub",
    output: result.output,
    input_tokens: 120,
    output_tokens: 30,
    cost: 0.00018,
    stub: true,
    status: "ok",
    error_reason: null,
  });
  expect(typeof runs[0].input).toBe("string");
  // Started before the call (status running), then ended.
  expect(typeof runs[0].finished_at).toBe("string");
});

test("test_476_a_model_error_is_recorded_with_status_error", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const response = await post(
    page.request,
    body({ prompt: { source: "pasted", text: "STUB MODEL ERROR" } }),
  );
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: false,
    error: "model-error",
    reason: "request",
    recorded: true,
    stub: true,
  });
  const runs = await runsOf(writer.token, writer.userId);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    prompt_source: "pasted",
    pasted_text: "STUB MODEL ERROR",
    status: "error",
    error_reason: "request",
    output: null,
    cost: null,
    stub: true,
  });
});

test("test_476_an_app_user_is_refused_and_nothing_is_recorded", async ({ page, context }) => {
  const user = await signIn(context, baseUrlOf(page));
  const response = await post(page.request, body());
  // The admin's proxy answers 404 to an account without a content role (#287).
  expect(response.status()).toBe(404);
  expect(await allRunCount(user.token)).toBe(0);
  // Nor can the account write a run itself: start_ai_run needs the server's token.
  const direct = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/start_ai_run`, {
    method: "POST",
    headers: { authorization: `Bearer ${user.token}`, "content-type": "application/json" },
    body: JSON.stringify({ server_token: "guess", run: {} }),
  });
  expect(direct.status).toBe(403);
});

test("test_476_anon_is_refused", async ({ page }) => {
  const response = await post(page.request, body());
  expect(response.status()).toBe(404);
});

test("test_476_a_writer_cannot_record_a_run_without_the_server", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const direct = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/start_ai_run`, {
    method: "POST",
    headers: { authorization: `Bearer ${writer.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      server_token: "guess",
      run: { feature_slug: "rest_reply", status: "ok", stub: false },
    }),
  });
  expect(direct.status).toBe(403);
  expect(await runsOf(writer.token, writer.userId)).toHaveLength(0);
});

test("test_476_a_request_from_another_site_is_refused_before_any_run", async ({
  page,
  context,
}) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const response = await page.request.post(RUN, {
    data: body(),
    headers: { origin: "https://evil.example.invalid", "sec-fetch-site": "cross-site" },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ ok: false, error: "cross-origin" });
  expect(await runsOf(writer.token, writer.userId)).toHaveLength(0);
});
