import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PromptVersionRow } from "@/lib/prompts/admin";
import { parsePrices, readPrices, runCost, AI_RUN_PRICES_ENV } from "@/lib/ai-runs/cost";
import { isStubModel, labModelFromEnv, type LabModel } from "@/lib/ai-runs/model";
import { runRequestProblem } from "@/lib/ai-runs/request-guard";
import {
  LAB_MAX_TOKENS,
  LAB_MAX_TOKENS_CAP,
  LAB_TIME_LIMIT_MS,
  runPrompt,
  type RunDeps,
  type RunFinish,
  type RunLog,
  type RunRequest,
  type RunStart,
} from "@/lib/ai-runs/run";
import { readRunSpend, todayWindow } from "@/lib/ai-runs/spend";

// #476 (FR-AILAB-1 to FR-AILAB-3, FR-AILAB-8; AI-RUN-PERMISSION, AI-RUN-LIVE, AI-LAB-STUB): the
// run log and the server Run route. Every model here is a fake with stub = true; no test calls a
// real model or the network. The route is also run against the stub model in
// e2e/ai-runs.live.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const MIGRATION = "20261203000000_ai_runs.sql";
const sql = () => read(`supabase/migrations/${MIGRATION}`).replace(/--.*$/gm, "");

/** A test price, invented for the tests: 1 dollar per million input tokens, 2 per million output. */
const TEST_PRICES = {
  "stub-model": { input_usd_per_million_tokens: 1, output_usd_per_million_tokens: 2 },
};
const KEY = "sk-test-key-never-shown-0001";

/** A fake model: the stub, with fixed token counts. */
function fakeModel(answer: string | Error = "A quiet answer."): LabModel & {
  prompts: string[];
} {
  const prompts: string[] = [];
  return {
    name: "stub-model",
    stub: true,
    prompts,
    call: async ({ prompt }) => {
      prompts.push(prompt);
      if (answer instanceof Error) throw answer;
      return { text: answer, inputTokens: 120, outputTokens: 30 };
    },
  };
}

const versions = (): PromptVersionRow[] => [
  {
    key: "rest_reply",
    version: 1,
    active: true,
    body: "Published rest prompt {{facts}}",
    params: { checks: { max_words: 40, max_sentences: 3 } },
    note: "",
    created_at: "2026-11-20T00:00:00Z",
    activated_at: "2026-11-20T00:00:00Z",
    category: "runtime",
  },
  {
    key: "rest_reply",
    version: 2,
    active: false,
    body: "Draft rest prompt {{facts}}",
    params: { checks: { max_words: 40, max_sentences: 3 } },
    note: "",
    created_at: "2026-11-21T00:00:00Z",
    activated_at: null,
    category: "runtime",
  },
  {
    key: "s1_find_episodes",
    version: 1,
    active: true,
    body: "Find the episodes.",
    params: {},
    note: "",
    created_at: "2026-11-21T00:00:00Z",
    activated_at: "2026-11-21T00:00:00Z",
    category: "pipeline",
  },
];

/** A run row as the in-memory run log holds it: the start, then the finish (status running until then). */
type LoggedRun = RunStart &
  Partial<Omit<RunFinish, "status">> & { status: "running" | "ok" | "error" };

/** An in-memory run log, as start_ai_run and finish_ai_run: the row first, its end after. */
function memoryLog(records: LoggedRun[], events: string[] = []): RunLog {
  return {
    start: async (run) => {
      events.push("start");
      records.push({ ...run, status: "running" });
      return `run-${records.length}`;
    },
    finish: async (runId, result) => {
      events.push("finish");
      const row = records[Number(runId.slice(4)) - 1];
      if (!row || row.status !== "running") return false;
      Object.assign(row, result);
      return true;
    },
  };
}

function deps(over: Partial<RunDeps> = {}): RunDeps & { records: LoggedRun[] } {
  const records: LoggedRun[] = [];
  return {
    userId: "user-1",
    role: "writer",
    readFeature: async (slug) =>
      slug === "rest_reply"
        ? { slug, category: "runtime", prompt_keys: ["rest_reply"] }
        : slug === "p01_find_episodes"
          ? { slug, category: "pipeline", prompt_keys: ["s1_find_episodes"] }
          : undefined,
    readPromptVersions: async () => versions(),
    readSample: async () => undefined,
    model: fakeModel(),
    prices: TEST_PRICES,
    runLog: memoryLog(records),
    records,
    ...over,
  };
}

const request = (over: Partial<RunRequest> = {}): RunRequest => ({
  feature: "rest_reply",
  promptKey: "rest_reply",
  prompt: { source: "published" },
  sample: null,
  model: "stub-model",
  ...over,
});

describe("#476 cost from tokens and the owner's price", () => {
  it("test_476_cost_is_tokens_times_the_configured_price", () => {
    expect(runCost("stub-model", { inputTokens: 120, outputTokens: 30 }, TEST_PRICES)).toEqual({
      cost: 0.00018,
      note: null,
    });
  });

  it("test_476_no_price_set_stores_null_and_says_price_not_set", () => {
    expect(runCost("other-model", { inputTokens: 120, outputTokens: 30 }, TEST_PRICES)).toEqual({
      cost: null,
      note: "price not set",
    });
    expect(runCost("stub-model", { inputTokens: null, outputTokens: 30 }, TEST_PRICES)).toEqual({
      cost: null,
      note: "tokens not reported",
    });
  });

  it("test_476_prices_come_from_the_server_setting_and_a_bad_value_counts_as_unset", () => {
    expect(AI_RUN_PRICES_ENV).toBe("AI_RUN_PRICES");
    expect(readPrices({ AI_RUN_PRICES: JSON.stringify(TEST_PRICES) })).toEqual(TEST_PRICES);
    expect(readPrices({})).toEqual({});
    expect(parsePrices("not json")).toBeNull();
    expect(
      parsePrices(
        '{"m": {"input_usd_per_million_tokens": -1, "output_usd_per_million_tokens": 1}}',
      ),
    ).toBeNull();
    expect(readPrices({ AI_RUN_PRICES: "[1]" })).toEqual({});
    // A malformed setting is reported (the route logs one warning); an unset one is not.
    const warn = vi.fn();
    readPrices({ AI_RUN_PRICES: "{not json" }, warn);
    readPrices({}, warn);
    readPrices({ AI_RUN_PRICES: JSON.stringify(TEST_PRICES) }, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    // The setting names the currency: US dollars.
    expect(
      parsePrices('{"m": {"input_per_million_tokens": 1, "output_per_million_tokens": 1}}'),
    ).toBeNull();
    // No price is written in the code: the only prices are the owner's setting.
    expect(read("src/lib/ai-runs/cost.ts")).not.toMatch(/deepseek/i);
  });
});

describe("#476 the model and its key", () => {
  it("test_476_the_stub_model_is_marked_stub", () => {
    expect(isStubModel("http://127.0.0.1:4299/v1/chat/completions", "stub")).toBe(true);
    expect(isStubModel("http://localhost:3199/v1/chat/completions", "anything")).toBe(true);
    expect(isStubModel("https://api.example.invalid/v1/chat/completions", "stub")).toBe(true);
    expect(isStubModel("https://api.example.invalid/v1/chat/completions", "real-model")).toBe(
      false,
    );
  });

  it("test_476_no_model_without_the_three_settings", () => {
    expect(labModelFromEnv({ MODEL_API_KEY: KEY, MODEL_NAME: "stub" })).toBeNull();
  });

  it("test_476_the_key_is_sent_to_the_provider_only_and_tokens_are_read", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${KEY}`);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Stub answer." } }],
          usage: { prompt_tokens: 120, completion_tokens: 30 },
        }),
        { status: 200 },
      );
    });
    const model = labModelFromEnv(
      {
        MODEL_API_KEY: KEY,
        MODEL_API_URL: "http://127.0.0.1:4299/v1/chat/completions",
        MODEL_NAME: "stub-model",
      },
      fetchImpl as unknown as typeof fetch,
    );
    expect(model).not.toBeNull();
    expect(model!.stub).toBe(true);
    expect(JSON.stringify(model)).not.toContain(KEY);
    const d = deps({ model: model! });
    const result = await runPrompt(request(), d);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(d.records)).not.toContain(KEY);
    expect(d.records[0]).toMatchObject({ input_tokens: 120, output_tokens: 30, stub: true });
  });

  it("test_476_the_key_is_not_in_an_error_either", async () => {
    const fetchImpl = vi.fn(async () => new Response(`bad key ${KEY}`, { status: 401 }));
    const model = labModelFromEnv(
      {
        MODEL_API_KEY: KEY,
        MODEL_API_URL: "http://127.0.0.1:4299/v1/chat/completions",
        MODEL_NAME: "stub-model",
      },
      fetchImpl as unknown as typeof fetch,
    )!;
    const d = deps({ model });
    const result = await runPrompt(request(), d);
    expect(result).toMatchObject({ ok: false, error: "model-error", reason: "request" });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(d.records)).not.toContain(KEY);
  });
});

describe("#476 a run", () => {
  it("test_476_a_run_is_recorded_with_tokens_and_cost", async () => {
    const d = deps();
    const result = await runPrompt(request(), d);
    expect(result).toMatchObject({
      ok: true,
      runId: "run-1",
      recorded: true,
      output: "A quiet answer.",
      inputTokens: 120,
      outputTokens: 30,
      cost: 0.00018,
      costNote: null,
      stub: true,
      model: "stub-model",
      promptVersion: 1,
    });
    expect(d.records).toHaveLength(1);
    expect(d.records[0]).toEqual({
      feature_slug: "rest_reply",
      prompt_key: "rest_reply",
      prompt_source: "published",
      prompt_version: 1,
      pasted_text: null,
      sample_id: null,
      model: "stub-model",
      input: "Published rest prompt {{facts}}",
      output: "A quiet answer.",
      input_tokens: 120,
      output_tokens: 30,
      cost: 0.00018,
      stub: true,
      status: "ok",
      error_reason: null,
      steps: [],
    });
    // The result columns are not part of the start: they come from the finish only.
    expect(Object.keys(d.records[0])).not.toContain("finished_at");
    // Who and when are set by the database (auth.uid(), now()), never sent by the route.
    expect(Object.keys(d.records[0])).not.toContain("run_by");
    expect(Object.keys(d.records[0])).not.toContain("run_at");
  });

  it("test_476_without_a_price_the_cost_is_null_and_price_not_set", async () => {
    const d = deps({ prices: {} });
    const result = await runPrompt(request(), d);
    expect(result).toMatchObject({ ok: true, cost: null, costNote: "price not set", stub: true });
    expect(d.records[0]).toMatchObject({ cost: null, stub: true });
  });

  it("test_476_a_writer_and_an_admin_may_run", async () => {
    for (const role of ["writer", "admin"] as const) {
      const d = deps({ role });
      expect((await runPrompt(request(), d)).ok).toBe(true);
      expect(d.records[0].stub).toBe(true);
    }
  });

  it("test_476_an_app_user_is_refused_before_any_model_call", async () => {
    const model = fakeModel();
    const d = deps({ role: null, model });
    expect(await runPrompt(request(), d)).toEqual({ ok: false, error: "not-allowed" });
    expect(model.prompts).toHaveLength(0);
    expect(d.records).toHaveLength(0);
  });

  it("test_476_anon_is_refused_before_any_model_call", async () => {
    const model = fakeModel();
    const d = deps({ userId: null, role: null, model });
    expect(await runPrompt(request(), d)).toEqual({ ok: false, error: "not-allowed" });
    expect(model.prompts).toHaveLength(0);
    expect(d.records).toHaveLength(0);
  });

  it("test_476_a_model_error_is_recorded_with_status_error_and_the_reason", async () => {
    const d = deps({ model: fakeModel(new Error("request")) });
    const result = await runPrompt(request(), d);
    expect(result).toEqual({
      ok: false,
      error: "model-error",
      reason: "request",
      runId: "run-1",
      recorded: true,
      stub: true,
      model: "stub-model",
    });
    expect(d.records[0]).toMatchObject({
      status: "error",
      error_reason: "request",
      output: null,
      input_tokens: null,
      output_tokens: null,
      cost: null,
      stub: true,
    });
  });

  it("test_476_a_model_that_takes_too_long_is_recorded_as_timeout", async () => {
    const slow: LabModel = {
      name: "stub-model",
      stub: true,
      call: ({ signal }) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("x")))),
    };
    const d = deps({ model: slow, timeLimitMs: 5 });
    expect(await runPrompt(request(), d)).toMatchObject({
      ok: false,
      error: "model-error",
      reason: "timeout",
    });
    expect(d.records[0]).toMatchObject({ status: "error", error_reason: "timeout", stub: true });
  });

  it("test_476_draft_and_pasted_versions", async () => {
    const d = deps();
    const draft = await runPrompt(request({ prompt: { source: "draft", version: 2 } }), d);
    expect(draft).toMatchObject({ ok: true, promptVersion: 2 });
    expect(d.records[0]).toMatchObject({
      prompt_source: "draft",
      prompt_version: 2,
      input: "Draft rest prompt {{facts}}",
    });
    await runPrompt(request({ prompt: { source: "pasted", text: "  Pasted text.  " } }), d);
    expect(d.records[1]).toMatchObject({
      prompt_source: "pasted",
      prompt_version: null,
      pasted_text: "Pasted text.",
      input: "Pasted text.",
      stub: true,
    });
    expect(
      await runPrompt(request({ prompt: { source: "draft", version: 9 } }), deps()),
    ).toMatchObject({ ok: false, error: "unknown-prompt" });
    expect(
      await runPrompt(request({ prompt: { source: "pasted", text: " " } }), deps()),
    ).toMatchObject({ ok: false, error: "invalid" });
  });

  it("test_476_the_feature_and_its_prompt_key_must_match_the_registry", async () => {
    expect(await runPrompt(request({ feature: "nope" }), deps())).toMatchObject({
      ok: false,
      error: "unknown-feature",
    });
    expect(await runPrompt(request({ promptKey: "s1_find_episodes" }), deps())).toMatchObject({
      ok: false,
      error: "unknown-prompt",
    });
    const pipeline = await runPrompt(
      request({ feature: "p01_find_episodes", promptKey: "s1_find_episodes" }),
      deps(),
    );
    expect(pipeline).toMatchObject({
      ok: true,
      checks: { applied: false, note: "No checks for a pipeline feature." },
    });
  });

  it("test_476_only_the_configured_model_runs", async () => {
    expect(await runPrompt(request({ model: "other" }), deps())).toMatchObject({
      ok: false,
      error: "unknown-model",
    });
    expect(await runPrompt(request(), deps({ model: null }))).toMatchObject({
      ok: false,
      error: "no-model",
    });
  });

  it("test_476_nothing_runs_without_a_run_log", async () => {
    const model = fakeModel();
    expect(await runPrompt(request(), deps({ model, runLog: null }))).toEqual({
      ok: false,
      error: "no-run-log",
    });
    expect(model.prompts).toHaveLength(0);
  });

  it("test_476_the_row_is_written_before_the_model_call_and_ended_after", async () => {
    const events: string[] = [];
    const records: LoggedRun[] = [];
    const log = memoryLog(records, events);
    const model = fakeModel();
    const call = model.call;
    model.call = async (input) => {
      events.push("model");
      // While the model answers, the row already exists with the status running.
      expect(records[0]).toMatchObject({ status: "running", stub: true });
      return call(input);
    };
    await runPrompt(request(), deps({ model, runLog: log }));
    expect(events).toEqual(["start", "model", "finish"]);
    expect(records[0]).toMatchObject({ status: "ok", stub: true });
  });

  it("test_476_a_run_whose_row_cannot_be_written_never_reaches_the_model", async () => {
    for (const start of [async () => null, async () => Promise.reject(new Error("db down"))]) {
      const model = fakeModel();
      const runLog: RunLog = { start, finish: async () => true };
      expect(await runPrompt(request(), deps({ model, runLog }))).toEqual({
        ok: false,
        error: "not-recorded",
      });
      expect(model.prompts).toHaveLength(0);
    }
  });

  it("test_476_a_failed_finish_keeps_the_row_running_and_says_so", async () => {
    for (const finish of [async () => false, async () => Promise.reject(new Error("x"))]) {
      const records: LoggedRun[] = [];
      const runLog: RunLog = { start: memoryLog(records).start, finish };
      const result = await runPrompt(request(), deps({ runLog }));
      expect(result).toMatchObject({ ok: true, recorded: false, runId: "run-1", stub: true });
      expect(records[0]).toMatchObject({ status: "running", stub: true });
    }
  });

  it("test_476_max_tokens_defaults_to_4096_and_is_capped_at_8192", async () => {
    expect(LAB_MAX_TOKENS).toBe(4096);
    expect(LAB_MAX_TOKENS_CAP).toBe(8192);
    expect(LAB_TIME_LIMIT_MS).toBe(120_000);
    const seen: (number | undefined)[] = [];
    const model: LabModel = {
      name: "stub-model",
      stub: true,
      call: async ({ maxTokens }) => {
        seen.push(maxTokens);
        return { text: "x", inputTokens: 1, outputTokens: 1 };
      },
    };
    const withParams = (params: Record<string, unknown>) => async () =>
      versions().map((row) => (row.key === "rest_reply" ? { ...row, params } : row));
    await runPrompt(request(), deps({ model, readPromptVersions: withParams({}) }));
    await runPrompt(
      request(),
      deps({ model, readPromptVersions: withParams({ max_tokens: 2000 }) }),
    );
    await runPrompt(
      request(),
      deps({ model, readPromptVersions: withParams({ max_tokens: 1_000_000 }) }),
    );
    expect(seen).toEqual([4096, 2000, 8192]);
  });

  it("test_476_a_sample_id_until_the_library_exists_is_unknown", async () => {
    const model = fakeModel();
    expect(await runPrompt(request({ sample: "s-1" }), deps({ model }))).toEqual({
      ok: false,
      error: "unknown-sample",
    });
    expect(model.prompts).toHaveLength(0);
  });

  it("test_476_without_a_sample_runtime_checks_say_a_sample_is_needed", async () => {
    expect(await runPrompt(request(), deps())).toMatchObject({
      ok: true,
      checks: { applied: false, note: "The checks need a sample." },
    });
  });

  it("test_476_with_a_sample_the_gateway_builds_the_prompt_and_runs_its_checks", async () => {
    const model = fakeModel(JSON.stringify({ reply: "I am here, at the bench, and it's quiet." }));
    const sample = {
      id: "invented-1",
      values: {},
      calls: {
        rest_reply: {
          companionName: "Invented Person",
          facts: "He sits at a bench.",
          userMessage: "",
        },
      },
    };
    const d = deps({ model, readSample: async (id) => (id === "invented-1" ? sample : undefined) });
    const passed = await runPrompt(request({ sample: "invented-1" }), d);
    expect(model.prompts[0]).toContain("He sits at a bench.");
    expect(passed).toMatchObject({
      ok: true,
      checks: { applied: true, passed: true, failedRules: [] },
    });
    expect(d.records[0]).toMatchObject({ sample_id: "invented-1", stub: true });

    const failing = fakeModel(JSON.stringify({ reply: "Great news! You should take a break" }));
    const failed = await runPrompt(
      request({ sample: "invented-1" }),
      deps({ model: failing, readSample: async () => sample }),
    );
    expect(failed).toMatchObject({ ok: true, checks: { applied: true, passed: false } });
    if (failed.ok && failed.checks.applied) {
      expect(failed.checks.failedRules).toEqual(expect.arrayContaining(["praise", "cmd", "form"]));
    }
  });

  it("test_476_a_sample_fills_a_pipeline_prompt", async () => {
    const model = fakeModel();
    const sample = { id: "invented-2", values: { persona: "An invented persona." } };
    const d = deps({
      model,
      readSample: async () => sample,
      readPromptVersions: async () => [{ ...versions()[2], body: "Persona: {{persona}}" }],
    });
    await runPrompt(
      request({
        feature: "p01_find_episodes",
        promptKey: "s1_find_episodes",
        sample: "invented-2",
      }),
      d,
    );
    expect(model.prompts[0]).toBe("Persona: An invented persona.");
    expect(d.records[0].input).toBe("Persona: An invented persona.");
  });

  it("test_476_bad_requests_are_refused", async () => {
    for (const bad of [
      null,
      {},
      { ...request(), feature: "Bad Slug" },
      { ...request(), prompt: { source: "draft", version: 0 } },
      { ...request(), prompt: { source: "pasted", text: "x".repeat(20_001) } },
      { ...request(), sample: 5 },
    ]) {
      expect(await runPrompt(bad as RunRequest, deps())).toEqual({ ok: false, error: "invalid" });
    }
  });
});

describe("#476 today's spend and spend by user", () => {
  it("test_476_today_is_the_utc_day", () => {
    expect(todayWindow(new Date("2026-11-26T23:30:00Z"))).toEqual({
      day: "2026-11-26",
      from: "2026-11-26T00:00:00.000Z",
      to: "2026-11-27T00:00:00.000Z",
    });
  });

  it("test_476_spend_totals_and_by_user", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          user_id: "u1",
          email: "a@example.invalid",
          runs: 3,
          unpriced_runs: 1,
          running_runs: 1,
          cost: "0.0004",
        },
        { user_id: null, email: null, runs: 1, unpriced_runs: 0, running_runs: 0, cost: 0.0001 },
      ],
      error: null,
    }));
    const spend = await readRunSpend(rpc, new Date("2026-11-26T10:00:00Z"));
    expect(rpc).toHaveBeenCalledWith("ai_run_spend", {
      from_time: "2026-11-26T00:00:00.000Z",
      to_time: "2026-11-27T00:00:00.000Z",
    });
    expect(spend).toEqual({
      day: "2026-11-26",
      runs: 4,
      unpricedRuns: 1,
      runningRuns: 1,
      cost: 0.0005,
      byUser: [
        {
          userId: "u1",
          email: "a@example.invalid",
          runs: 3,
          unpricedRuns: 1,
          runningRuns: 1,
          cost: 0.0004,
        },
        { userId: null, email: null, runs: 1, unpricedRuns: 0, runningRuns: 0, cost: 0.0001 },
      ],
    });
    expect(await readRunSpend(async () => ({ data: null, error: { code: "42501" } }))).toBeNull();
  });
});

describe("#476 the run log migration", () => {
  it("test_476_runs_after_the_registry_migration", () => {
    const names = readdirSync(path.join(root, "supabase", "migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names).toContain(MIGRATION);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261202000000_ai_registry.sql"),
    );
  });

  it("test_476_the_runs_table_has_every_column_of_FR_AILAB_3", () => {
    const table = sql().slice(sql().indexOf("create table public.ai_runs ("));
    for (const column of [
      "run_by uuid references auth.users (id) on delete set null",
      "run_at timestamptz not null default now()",
      "feature_slug text not null references public.ai_features (slug)",
      "prompt_key text not null",
      "prompt_source text not null check (prompt_source in ('published', 'draft', 'pasted'))",
      "prompt_version integer",
      "pasted_text text",
      "sample_id text",
      "model text not null",
      "input text not null",
      "output text",
      "input_tokens integer",
      "output_tokens integer",
      "cost numeric(14, 8)",
      "stub boolean not null",
      "status text not null check (status in ('ok', 'error'))",
      "error_reason text",
    ]) {
      expect(table, column).toContain(column);
    }
    expect(sql()).toContain("create table public.ai_run_steps (");
    expect(sql()).toMatch(
      /run_id uuid not null references public\.ai_runs \(id\) on delete cascade/,
    );
  });

  it("test_476_editors_read_and_nobody_writes_directly", () => {
    const code = sql();
    for (const table of ["ai_runs", "ai_run_steps"]) {
      expect(code).toContain(`alter table public.${table} enable row level security;`);
      expect(code).toContain(`revoke all on public.${table} from public, anon, authenticated;`);
      expect(code).toContain(`grant select on public.${table} to authenticated;`);
      expect(code).toMatch(
        new RegExp(
          `create policy ${table}_read on public\\.${table}\\s+for select to authenticated\\s+using \\(\\(select public\\.is_content_editor\\(\\)\\)\\);`,
        ),
      );
    }
    expect(code).not.toMatch(/grant (insert|update|delete)/);
    expect(code).not.toMatch(/for (insert|update|delete|all)/);
    // No spending cap (AI-RUN-PERMISSION): nothing refuses a run for its cost.
    expect(code).not.toMatch(/cap|limit/i);
  });

  const fnBody = (name: string) => {
    const code = sql();
    const fn = code.slice(code.indexOf(`create function ${name}(`));
    return fn.slice(0, fn.indexOf("$$;"));
  };

  it("test_476_both_writers_need_the_server_token_and_a_content_editor", () => {
    const code = sql();
    const gate = fnBody("private.ai_run_writer_ok");
    expect(gate).toContain("security definer");
    expect(gate).toContain("from private.prompt_reader r");
    expect(gate).toContain("auth.uid() is null or not public.is_content_editor()");
    expect(gate).toContain("errcode = '42501'");
    expect(code).toContain(
      "revoke all on function private.ai_run_writer_ok(text) from public, anon, authenticated;",
    );
    for (const [name, args] of [
      ["public.start_ai_run", "text, jsonb"],
      ["public.finish_ai_run", "text, uuid, jsonb"],
    ]) {
      const body = fnBody(name);
      expect(body).toContain("security definer");
      expect(body).toContain("perform private.ai_run_writer_ok(server_token);");
      expect(code).toContain(
        `revoke all on function ${name}(${args}) from public, anon, authenticated;`,
      );
      expect(code).toContain(`grant execute on function ${name}(${args}) to authenticated;`);
    }
  });

  it("test_476_a_run_starts_as_running_before_the_call", () => {
    const start = fnBody("public.start_ai_run");
    expect(start).toMatch(/values \(\s+auth\.uid\(\),/);
    expect(start).toContain("'running'");
    // The result columns are never taken from the start.
    expect(start).not.toMatch(/'output'|'cost'|'status'|'input_tokens'/);
    expect(sql()).toContain("status text not null check (status in ('running', 'ok', 'error'))");
    expect(sql()).toContain(
      "constraint ai_runs_finished_when_ended check ((status = 'running') = (finished_at is null))",
    );
  });

  it("test_476_only_the_starter_ends_a_running_run_once", () => {
    const finish = fnBody("public.finish_ai_run");
    expect(finish).toContain(
      "where r.id = run_id and r.run_by = auth.uid() and r.status = 'running';",
    );
    expect(finish).toContain("errcode = 'P0002'");
    expect(finish).toContain("finished_at = now()");
  });

  it("test_476_running_runs_count_in_the_spend", () => {
    const spend = fnBody("public.ai_run_spend");
    expect(spend).toContain("running_runs bigint");
    expect(spend).toContain("count(*) filter (where r.status = 'running')");
  });

  it("test_476_the_cost_column_says_us_dollars", () => {
    expect(read(`supabase/migrations/${MIGRATION}`)).toMatch(
      /comment on column public\.ai_runs\.cost is\s+'US dollars \(USD\)/,
    );
  });

  it("test_476_the_spend_function_is_for_content_editors", () => {
    const code = sql();
    const fn = code.slice(code.indexOf("create function public.ai_run_spend("));
    expect(fn).toContain("if not public.is_content_editor() then");
    expect(code).toContain(
      "grant execute on function public.ai_run_spend(timestamptz, timestamptz) to authenticated;",
    );
  });
});

describe("#476 the registry undo keeps the run log", () => {
  it("test_476_the_registry_undo_stops_before_any_change_when_rows_have_runs", async () => {
    const { registryUndoSql } = await import("../scripts/ai-features/registry-seed.mjs");
    const undo = registryUndoSql();
    const guard = undo.indexOf("if to_regclass('public.ai_runs') is not null then");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(undo.indexOf("delete from public.ai_features"));
    expect(undo).toContain("raise exception 'These rows have prompt lab runs and are kept");
    // The comment no longer says the runs go with the rows.
    expect(read("scripts/ai-features/registry-seed.mjs")).not.toContain(
      "their history and test runs go with them; they had none before",
    );
  });
});

describe("#476 the route", () => {
  const route = () => read("src/app/admin/ai-runs/run/route.ts");

  it("test_476_the_route_is_a_post_under_admin_that_runs_through_runPrompt", () => {
    expect(route()).toMatch(/export async function POST\(/);
    expect(route()).toContain("runPrompt(");
    expect(route()).toContain("readContentRole(");
    expect(route()).toContain('"start_ai_run"');
    expect(route()).toContain('"finish_ai_run"');
    expect(route()).toContain("runRequestProblem(");
  });

  it("test_476_the_route_runs_long_enough_for_the_lab_call", () => {
    const match = route().match(/export const maxDuration = (\d+);/);
    expect(match).not.toBeNull();
    // The lab call's wait plus at least 15 s for the reads and the two run log writes.
    expect(Number(match![1]) * 1000).toBeGreaterThanOrEqual(LAB_TIME_LIMIT_MS + 15_000);
    expect(Number(match![1])).toBe(150);
  });

  it("test_476_another_sites_request_is_refused", () => {
    const url = "https://app.example.invalid/admin/ai-runs/run";
    const headers = (values: Record<string, string>) =>
      new Headers({ host: "app.example.invalid", "content-type": "application/json", ...values });
    expect(runRequestProblem(headers({ "sec-fetch-site": "same-origin" }), url)).toBeNull();
    expect(runRequestProblem(headers({ origin: "https://app.example.invalid" }), url)).toBeNull();
    expect(runRequestProblem(headers({}), url)).toBeNull();
    expect(runRequestProblem(headers({ "sec-fetch-site": "cross-site" }), url)).toBe(
      "cross-origin",
    );
    expect(runRequestProblem(headers({ "sec-fetch-site": "same-site" }), url)).toBe("cross-origin");
    expect(runRequestProblem(headers({ origin: "https://evil.example.invalid" }), url)).toBe(
      "cross-origin",
    );
    expect(runRequestProblem(headers({ origin: "null" }), url)).toBe("cross-origin");
    expect(
      runRequestProblem(
        new Headers({ host: "app.example.invalid", "content-type": "text/plain" }),
        url,
      ),
    ).toBe("not-json");
    expect(runRequestProblem(headers({ "content-length": String(200 * 1024) }), url)).toBe(
      "too-large",
    );
  });

  it("test_476_the_key_is_server_only", () => {
    for (const file of [
      "src/app/admin/ai-runs/run/route.ts",
      "src/lib/ai-runs/run.ts",
      "src/lib/ai-runs/model.ts",
    ]) {
      expect(read(file)).not.toContain("NEXT_PUBLIC_MODEL");
    }
    // The answer is built field by field: never the model object or the settings.
    expect(read("src/lib/ai-runs/run.ts")).not.toMatch(/MODEL_API_KEY|process\.env/);
  });
});
