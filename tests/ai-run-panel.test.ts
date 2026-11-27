import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RegistryFeature } from "@/lib/ai-features/registry";
import { setExampleFromRun, type RunExampleDeps } from "@/lib/ai-runs/example";
import {
  costOf,
  filterRuns,
  parseRunFilter,
  peopleFromSpend,
  RUN_END_WAIT_MS,
  runBy,
  runsHref,
  runState,
  todayCounts,
  type RunLogRow,
} from "@/lib/ai-runs/log";
import type { LabModel } from "@/lib/ai-runs/model";
import { costText, formatUsd, tokensText, versionLabel } from "@/lib/ai-runs/panel";
import {
  runPrompt,
  SAMPLE_WITHOUT_CALL_NOTE,
  type RunDeps,
  type RunRequest,
} from "@/lib/ai-runs/run";
import { librarySamples, type ExcerptRow, type SampleRow } from "@/lib/ai-samples/library";
import {
  factsText,
  planText,
  readLabSample,
  SAMPLE_VARIABLE_NAMES,
  SAMPLE_VARIABLES,
  sampleValues,
  unfilledVariables,
} from "@/lib/ai-samples/variables";
import type { PromptVersionRow } from "@/lib/prompts/admin";
import { renderPrompt } from "@/lib/prompts/template";

// #477 (FR-AILAB-1, FR-AILAB-3, FR-AILAB-6; AI-LAB-SAMPLES, AI-RUN-PERMISSION, AI-LAB-STUB;
// docs/decisions/0037): the Run panel and the Runs page. Every model here is a fake with
// stub = true and every sample text is invented (AI-SAMPLES-LOCAL); no test calls a real model or
// the network. The screens are tested in e2e/ai-run-panel.live.spec.ts (stub model) and
// e2e/ai-runs-page.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const SAMPLE: SampleRow = {
  id: "invented-lamp",
  position: 1,
  name: "Invented lamp maker",
  companion: "Ada Tester",
  mode: "historical",
  persona: "A careful maker of lamps.",
  source_excerpt_id: "invented-lamp",
  background: "",
  facts: ["She sells lamps.", "  ", "Her workshop has one window."],
  world_record: "The town has one road.",
  standing_task: "",
  plan: {
    goal: "Twelve lamps by the fair.",
    aims: [
      { title: "Count the wicks", note: "Twice." },
      { title: "Fill the oil", note: "" },
    ],
  },
};
const EXCERPT: ExcerptRow = {
  id: "invented-lamp",
  source_label: "Invented notebook, page 1",
  body: "The lamp maker counts the wicks twice before dark.",
};
const library = () => librarySamples([SAMPLE], [EXCERPT])[0];

describe("#477 how a sample fills a prompt's {{variables}} (docs/decisions/0037)", () => {
  it("test_477_each_sample_field_fills_its_variables", () => {
    expect(sampleValues(library())).toEqual({
      name: "Ada Tester",
      character_name: "Ada Tester",
      mode: "historical",
      persona: "A careful maker of lamps.",
      source_excerpt: "The lamp maker counts the wicks twice before dark.",
      story_source: "The lamp maker counts the wicks twice before dark.",
      source_label: "Invented notebook, page 1",
      background: null,
      facts: "- She sells lamps.\n- Her workshop has one window.",
      world_record: "The town has one road.",
      standing_task: null,
      plan: "Goal: Twelve lamps by the fair.\n1. Count the wicks: Twice.\n2. Fill the oil",
      goal: "Twelve lamps by the fair.",
    });
    // The table names exactly the values a sample gives.
    expect(Object.keys(sampleValues(library())).sort()).toEqual([...SAMPLE_VARIABLE_NAMES].sort());
    expect(SAMPLE_VARIABLES.map((row) => row.field)).toContain("Source excerpt");
  });

  it("test_477_an_empty_field_drops_its_line", () => {
    const values = sampleValues(library());
    const prompt = "Persona: {{persona}}\nBackground: {{background}}\nTask: {{standing_task}}";
    expect(renderPrompt(prompt, values)).toBe("Persona: A careful maker of lamps.");
  });

  it("test_477_a_sample_without_excerpt_or_plan", () => {
    const [bare] = librarySamples(
      [{ ...SAMPLE, companion: null, mode: null, source_excerpt_id: null, plan: null, facts: [] }],
      [],
    );
    expect(sampleValues(bare)).toMatchObject({
      name: null,
      mode: null,
      source_excerpt: null,
      story_source: null,
      source_label: null,
      facts: null,
      plan: null,
      goal: null,
    });
    expect(factsText([])).toBeNull();
    expect(planText(null)).toBeNull();
  });

  it("test_477_variables_no_sample_fills_are_named", () => {
    expect(unfilledVariables(["persona", "book_title", "userMessage", "book_title"])).toEqual([
      "book_title",
      "userMessage",
    ]);
    expect(unfilledVariables(["name", "facts", "story_source"])).toEqual([]);
  });

  it("test_477_the_route_reads_one_sample_with_its_excerpt", async () => {
    const calls: string[] = [];
    const found = await readLabSample(async (table, column, value) => {
      calls.push(`${table}:${column}=${value}`);
      return { data: table === "ai_samples" ? [SAMPLE] : [EXCERPT], error: null };
    }, "invented-lamp");
    expect(calls).toEqual(["ai_samples:id=invented-lamp", "ai_source_excerpts:id=invented-lamp"]);
    expect(found?.id).toBe("invented-lamp");
    expect(found?.values.story_source).toBe(EXCERPT.body);

    expect(await readLabSample(async () => ({ data: [], error: null }), "nope")).toBeUndefined();
    expect(
      await readLabSample(async () => ({ data: null, error: { code: "500" } }), "x"),
    ).toBeNull();
  });

  it("test_477_the_route_no_longer_answers_unknown_sample_for_every_id", () => {
    const route = read("src/app/admin/ai-runs/run/route.ts");
    expect(route).toContain("readLabSample(");
    expect(route).not.toContain("readSample: async () => undefined");
  });
});

/** A fake model: the stub, with fixed token counts. */
function fakeModel(): LabModel & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    name: "stub-model",
    stub: true,
    prompts,
    call: async ({ prompt }) => {
      prompts.push(prompt);
      return { text: "An invented answer.", inputTokens: 10, outputTokens: 5 };
    },
  };
}

const versions = (body: string): PromptVersionRow[] => [
  {
    key: "p04_plan_historical",
    version: 1,
    active: true,
    body,
    params: {},
    note: "",
    created_at: "2026-11-20T00:00:00Z",
    activated_at: "2026-11-20T00:00:00Z",
    category: "pipeline",
  },
  {
    key: "rest_reply",
    version: 1,
    active: true,
    body: "Facts: {{facts}}\nThe person wrote: {{userMessage}}",
    params: {},
    note: "",
    created_at: "2026-11-20T00:00:00Z",
    activated_at: "2026-11-20T00:00:00Z",
    category: "runtime",
  },
];

function deps(body: string, model = fakeModel()): RunDeps & { started: number } {
  const state = { started: 0 };
  return Object.assign(state, {
    userId: "user-1",
    role: "writer" as const,
    readFeature: async (slug: string) =>
      slug === "p04_plan_historical"
        ? { slug, category: "pipeline", prompt_keys: ["p04_plan_historical"] }
        : slug === "rest_reply"
          ? { slug, category: "runtime", prompt_keys: ["rest_reply"] }
          : undefined,
    readPromptVersions: async () => versions(body),
    readSample: async (id: string) =>
      id === "invented-lamp" ? { id, values: sampleValues(library()) } : undefined,
    model,
    prices: {},
    runLog: {
      start: async () => {
        state.started += 1;
        return "run-1";
      },
      finish: async () => true,
    },
  });
}

const request = (over: Partial<RunRequest> = {}): RunRequest => ({
  feature: "p04_plan_historical",
  promptKey: "p04_plan_historical",
  prompt: { source: "published" },
  sample: "invented-lamp",
  model: "stub-model",
  ...over,
});

describe("#477 a Run with a sample of the library", () => {
  it("test_477_a_pipeline_prompt_is_filled_from_the_sample", async () => {
    const model = fakeModel();
    const d = deps(
      "You write for {{character_name}} ({{mode}}).\n{{persona}}\nSource:\n{{story_source}}\nBackground: {{background}}",
      model,
    );
    const result = await runPrompt(request(), d);
    expect(result).toMatchObject({ ok: true, stub: true, costNote: "price not set" });
    expect(model.prompts[0]).toBe(
      "You write for Ada Tester (historical).\nA careful maker of lamps.\nSource:\nThe lamp maker counts the wicks twice before dark.",
    );
  });

  it("test_477_a_variable_the_sample_does_not_fill_stops_the_run_before_the_model", async () => {
    const model = fakeModel();
    const d = deps("Book: {{book_title}}\nChapters: {{chapters}}\n{{persona}}", model);
    expect(await runPrompt(request(), d)).toEqual({
      ok: false,
      error: "prompt-problem",
      problems: [
        'A sample has no value for {{book_title}}, {{chapters}}. Choose "No sample" to send the prompt as written.',
      ],
    });
    expect(model.prompts).toHaveLength(0);
    expect(d.started).toBe(0);
  });

  it("test_477_no_sample_sends_the_prompt_as_written", async () => {
    const model = fakeModel();
    await runPrompt(request({ sample: null }), deps("Book: {{book_title}}", model));
    expect(model.prompts[0]).toBe("Book: {{book_title}}");
  });

  it("test_477_a_runtime_prompt_with_a_library_sample_says_why_no_checks_ran", async () => {
    const model = fakeModel();
    const d = deps("unused", model);
    const refused = await runPrompt(request({ feature: "rest_reply", promptKey: "rest_reply" }), d);
    expect(refused).toMatchObject({ ok: false, error: "prompt-problem" });
    const pasted = await runPrompt(
      request({
        feature: "rest_reply",
        promptKey: "rest_reply",
        prompt: { source: "pasted", text: "Facts: {{facts}}" },
      }),
      d,
    );
    expect(pasted).toMatchObject({
      ok: true,
      checks: { applied: false, note: SAMPLE_WITHOUT_CALL_NOTE },
    });
    expect(model.prompts[0]).toBe("Facts: - She sells lamps.\n- Her workshop has one window.");
  });
});

describe("#477 the panel's words and numbers", () => {
  it("test_477_cost_from_tokens_and_price_not_set_when_unset", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.00018)).toBe("$0.000180");
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(costText(0.00018, null, false)).toBe("$0.000180");
    expect(costText(null, "price not set", false)).toBe("Price not set");
    expect(costText(null, "tokens not reported", false)).toBe("Tokens not reported");
    // The fake model never charges, whatever test price is set.
    expect(costText(0.00018, null, true)).toBe("$0.000180 (stub, no charge)");
    expect(tokensText(120, 30)).toBe("120 in · 30 out");
    expect(tokensText(null, null)).toBe("Not reported");
    expect(versionLabel("draft", 3)).toBe("Draft v3");
    expect(versionLabel("published", 1)).toBe("Published v1");
    expect(versionLabel("pasted", null)).toBe("Pasted text");
  });

  it("test_477_the_panel_never_gets_the_model_key", () => {
    const page = read("src/app/admin/ai-features/[slug]/run/page.tsx");
    expect(page).toContain("{ name: lab.name, stub: lab.stub }");
    const panel = read("src/app/admin/ai-features/[slug]/run/run-panel.tsx");
    expect(panel).toMatch(/^"use client";/);
    expect(panel).not.toMatch(/MODEL_API_KEY|process\.env|labModelFromEnv/);
    expect(panel).toContain('fetch("/admin/ai-runs/run"');
  });

  it("test_477_the_feature_page_links_the_run_panel_and_the_menu_lists_runs", () => {
    expect(read("src/app/admin/ai-features/[slug]/page.tsx")).toContain("href={`${base}/run`}");
    const shell = read("src/app/admin/admin-shell.tsx");
    expect(shell).toContain('{ href: "/admin/ai-runs", id: "AIR-5", label: "Runs" }');
    expect(read("src/app/admin/styles.ts")).toContain('import "./ai-runs/ai-runs.css";');
  });
});

const run = (over: Partial<RunLogRow> = {}): RunLogRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  run_by: "user-a",
  run_at: "2026-11-27T10:00:00.000Z",
  finished_at: "2026-11-27T10:00:05.000Z",
  feature_slug: "pause_message",
  prompt_key: "stuck_story",
  prompt_source: "draft",
  prompt_version: 2,
  sample_id: null,
  model: "stub",
  input_tokens: 120,
  output_tokens: 30,
  cost: "0.00018000",
  stub: true,
  status: "ok",
  error_reason: null,
  ...over,
});

describe("#477 the Runs page", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");

  it("test_477_a_run_that_never_ended_is_shown_not_hidden", () => {
    expect(runState(run(), now)).toBe("ok");
    expect(runState(run({ status: "error" }), now)).toBe("error");
    const fresh = new Date(now.getTime() - 60_000).toISOString();
    expect(runState(run({ status: "running", run_at: fresh }), now)).toBe("running");
    const old = new Date(now.getTime() - RUN_END_WAIT_MS - 1000).toISOString();
    expect(runState(run({ status: "running", run_at: old }), now)).toBe("not-recorded");
  });

  it("test_477_today_is_the_utc_day_and_stub_runs_are_counted_apart", () => {
    const rows = [
      run({ run_at: "2026-11-27T00:00:00.000Z" }),
      run({ run_at: "2026-11-27T23:59:59.000Z", stub: false }),
      run({ run_at: "2026-11-26T23:59:59.000Z" }),
      run({ run_at: "2026-11-28T00:00:00.000Z" }),
    ];
    expect(todayCounts(rows, now)).toEqual({ runs: 2, stub: 1, real: 1 });
  });

  it("test_477_filter_by_feature_user_model_and_stub", () => {
    const rows = [
      run({ id: "a" }),
      run({ id: "b", feature_slug: "rest_reply" }),
      run({ id: "c", run_by: "user-b", stub: false, model: "real-model" }),
    ];
    const ids = (filter: Record<string, string>) =>
      filterRuns(rows, parseRunFilter(filter)).map((row) => row.id);
    expect(ids({})).toEqual(["a", "b", "c"]);
    expect(ids({ feature: "rest_reply" })).toEqual(["b"]);
    expect(ids({ user: "user-b" })).toEqual(["c"]);
    expect(ids({ model: "stub" })).toEqual(["a", "b"]);
    expect(ids({ stub: "1" })).toEqual(["a", "b"]);
    expect(runsHref(parseRunFilter({ feature: "rest_reply", stub: "1" }), "b")).toBe(
      "/admin/ai-runs?feature=rest_reply&stub=1&run=b",
    );
    expect(runsHref(parseRunFilter({}))).toBe("/admin/ai-runs");
  });

  it("test_477_who_ran_it_by_email", () => {
    const people = peopleFromSpend([
      { user_id: "user-a", email: "a@example.invalid" },
      { user_id: "user-b", email: null },
    ]);
    expect(runBy("user-a", people)).toBe("a@example.invalid");
    expect(runBy("user-b1234567", people)).toBe("Account user-b12");
    expect(runBy(null, people)).toBe("Deleted account");
    expect(costOf(run())).toBe(0.00018);
    expect(costOf(run({ cost: null }))).toBeNull();
  });

  it("test_477_the_page_reads_the_log_with_the_users_own_client", () => {
    const page = read("src/app/admin/ai-runs/page.tsx");
    expect(page).toContain("createSupabaseServerClient");
    expect(page).not.toMatch(/service_role|SERVICE_ROLE|labModelFromEnv|runPrompt/);
    expect(page).toContain('"ai_run_spend"');
    expect(page).toContain("readRunSpend(");
  });
});

const RUN_ID = "00000000-0000-4000-8000-0000000000aa";

function exampleDeps(over: Partial<RunExampleDeps> = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const feature = {
    slug: "pause_message",
    example_text: "Old example.",
    example_state: "confirmed",
    example_set_at: "2026-11-20T00:00:00.000Z",
  } as RegistryFeature;
  const deps: RunExampleDeps = {
    userId: "user-1",
    role: "writer",
    readFeature: async (slug) => (slug === feature.slug ? feature : undefined),
    readRun: async (id) =>
      id === RUN_ID
        ? { id, feature_slug: "pause_message", status: "ok", output: "The run's own answer." }
        : undefined,
    rpc: async (name, args) => {
      calls.push({ name, args });
      feature.example_set_at = "2026-11-27T12:00:00.000Z";
      return { data: null, error: null };
    },
    ...over,
  };
  return { deps, calls };
}

describe("#477 Set as candidate example and Confirm from a run (FR-AILAB-6)", () => {
  const write = {
    slug: "pause_message",
    runId: RUN_ID,
    state: "candidate" as const,
    loadedAt: "2026-11-20T00:00:00.000Z",
  };

  it("test_477_set_as_candidate_stores_the_runs_own_output_through_set_ai_feature_example", async () => {
    const { deps, calls } = exampleDeps();
    expect(await setExampleFromRun(write, deps)).toEqual({
      ok: true,
      savedAt: "2026-11-27T12:00:00.000Z",
    });
    expect(calls).toEqual([
      {
        name: "set_ai_feature_example",
        args: {
          target_feature: "pause_message",
          new_text: "The run's own answer.",
          new_state: "candidate",
        },
      },
    ]);
  });

  it("test_477_confirm_stores_it_as_confirmed_any_role", async () => {
    const { deps, calls } = exampleDeps({ role: "writer" });
    expect(await setExampleFromRun({ ...write, state: "confirmed" }, deps)).toMatchObject({
      ok: true,
    });
    expect(calls[0].args.new_state).toBe("confirmed");
  });

  it("test_477_the_example_editor_rules_still_hold", async () => {
    const anon = exampleDeps({ userId: null, role: null });
    expect(await setExampleFromRun(write, anon.deps)).toEqual({ ok: false, error: "not-allowed" });
    const stale = exampleDeps();
    expect(await setExampleFromRun({ ...write, loadedAt: null }, stale.deps)).toEqual({
      ok: false,
      error: "changed-since",
    });
    const long = exampleDeps({
      readRun: async (id) => ({
        id,
        feature_slug: "pause_message",
        status: "ok",
        output: "x".repeat(8001),
      }),
    });
    expect(await setExampleFromRun(write, long.deps)).toEqual({
      ok: false,
      error: "field-too-long",
    });
    for (const d of [anon, stale, long]) expect(d.calls).toHaveLength(0);
  });

  it("test_477_only_a_finished_run_of_this_feature_can_be_set", async () => {
    for (const readRun of [
      async () => undefined,
      async (id: string) => ({
        id,
        feature_slug: "rest_reply",
        status: "ok" as const,
        output: "x",
      }),
      async (id: string) => ({
        id,
        feature_slug: "pause_message",
        status: "error" as const,
        output: null,
      }),
      async (id: string) => ({
        id,
        feature_slug: "pause_message",
        status: "running" as const,
        output: null,
      }),
    ]) {
      const { deps, calls } = exampleDeps({ readRun });
      expect(await setExampleFromRun(write, deps)).toEqual({ ok: false, error: "invalid" });
      expect(calls).toHaveLength(0);
    }
    const { deps } = exampleDeps();
    expect(await setExampleFromRun({ ...write, runId: "not-a-uuid" }, deps)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      await setExampleFromRun({ ...write, state: "none" as unknown as "candidate" }, deps),
    ).toEqual({ ok: false, error: "invalid" });
  });
});

describe("#477 owner decisions of 2026-11-27 recorded where they were open", () => {
  it("test_477_the_open_markers_of_0035_and_0036_are_closed", () => {
    const d35 = read("docs/decisions/0035-ai-registry-editing.md");
    expect(d35).not.toContain("Owner to decide");
    expect(d35).not.toContain("(owner decision)");
    expect(d35.match(/Owner decided \(2026-11-27\)/g)?.length).toBeGreaterThanOrEqual(2);
    const d36 = read("docs/decisions/0036-ai-sample-library.md");
    expect(d36).not.toContain("It needs an owner decision");
    expect(d36).toContain("Owner decided (2026-11-27)");
    expect(d36).toContain("#500");
  });

  it("test_477_the_variable_mapping_is_recorded_in_0037", () => {
    const d37 = read("docs/decisions/0037-ai-run-panel-and-runs.md");
    for (const row of SAMPLE_VARIABLES) {
      for (const name of row.variables) expect(d37).toContain(`{{${name}}}`);
    }
  });
});
