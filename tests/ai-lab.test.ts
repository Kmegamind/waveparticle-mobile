import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { postRun } from "@/lib/ai-runs/client";
import {
  answersComplete,
  defaultSides,
  hiddenNow,
  LAB_SAVE_PROBLEMS,
  saveComparison,
  sideOptions,
  sideOrder,
  sideRequest,
  type ComparisonDeps,
  type ComparisonWrite,
  type LabPrompt,
} from "@/lib/ai-runs/comparison";
import { labModelsFromEnv, pickLabModel, type LabModel } from "@/lib/ai-runs/model";
import { runPrompt, type RunDeps } from "@/lib/ai-runs/run";
import type { PromptVersionRow } from "@/lib/prompts/admin";

// #478 (FR-AILAB-4, FR-AILAB-5; AI-LAB-SAMPLES, AI-REGISTRY-FIELDS, AI-LAB-STUB): the comparison
// lab (/admin/ai-lab, drawing #reg-lab, AIR-4). Every model here is a fake with stub = true; no
// test calls a real model or the network. The screen is tested in e2e/ai-lab.live.spec.ts (stub
// model only) and e2e/admin-visual-ai-lab.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const MIGRATION = "supabase/migrations/20261206000000_ai_comparisons.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const sql = () => read(MIGRATION).replace(/--.*$/gm, "");

const PROMPT: LabPrompt = {
  key: "stuck_story",
  published: { version: 1, variables: ["name"] },
  draft: { version: 2, variables: ["name", "facts"] },
};
const MODELS = [
  { name: "stub", stub: true },
  { name: "stub-b", stub: true },
];

function fakeModel(name: string, text = `Invented answer of ${name}.`): LabModel {
  return {
    name,
    stub: true,
    call: vi.fn(async () => ({ text, inputTokens: 10, outputTokens: 5 })),
  };
}

describe("#478 AC1 two sides: prompt versions or models", () => {
  it("test_478_ac1_each_side_offers_the_versions_and_the_configured_models", () => {
    expect(sideOptions(PROMPT, MODELS)).toEqual([
      { value: "published", label: "Published version (v1)" },
      { value: "draft", label: "Draft version (v2)" },
      { value: "model:stub", label: "Stub model: stub (published version)" },
      { value: "model:stub-b", label: "Stub model: stub-b (published version)" },
    ]);
    // A key with no draft offers no draft; a real model says its name only.
    expect(
      sideOptions({ ...PROMPT, draft: null }, [{ name: "deepseek-chat", stub: false }]),
    ).toEqual([
      { value: "published", label: "Published version (v1)" },
      { value: "model:deepseek-chat", label: "deepseek-chat (published version)" },
    ]);
  });

  it("test_478_ac1_by_default_side_a_is_published_and_side_b_the_draft_or_a_second_model", () => {
    expect(defaultSides(PROMPT, MODELS)).toEqual({ a: "published", b: "draft" });
    expect(defaultSides({ ...PROMPT, draft: null }, MODELS)).toEqual({
      a: "published",
      b: "model:stub-b",
    });
    expect(defaultSides({ ...PROMPT, draft: null }, [MODELS[0]])).toEqual({
      a: "published",
      b: "published",
    });
  });

  it("test_478_ac1_a_side_is_a_run_request_of_the_existing_run_route_with_the_same_sample", () => {
    const base = { feature: "pause_message", prompt: PROMPT, sample: "invented-lamp-maker" };
    expect(sideRequest({ ...base, choice: "published", models: MODELS })).toEqual({
      feature: "pause_message",
      promptKey: "stuck_story",
      prompt: { source: "published" },
      sample: "invented-lamp-maker",
      model: "stub",
    });
    expect(sideRequest({ ...base, choice: "draft", models: MODELS })).toMatchObject({
      prompt: { source: "draft", version: 2 },
      model: "stub",
    });
    expect(sideRequest({ ...base, choice: "model:stub-b", models: MODELS })).toMatchObject({
      prompt: { source: "published" },
      model: "stub-b",
    });
    // No published version: a model side runs the draft.
    expect(
      sideRequest({
        ...base,
        prompt: { ...PROMPT, published: null },
        choice: "model:stub-b",
        models: MODELS,
        sample: null,
      }),
    ).toMatchObject({ prompt: { source: "draft", version: 2 }, model: "stub-b", sample: null });
    expect(sideRequest({ ...base, choice: "model:gone", models: MODELS })).toBeNull();
  });

  it("test_478_ac1_run_both_posts_each_side_to_the_existing_run_route", () => {
    const lab = read("src/app/admin/ai-lab/lab.tsx");
    expect(lab).toContain("postRun(");
    expect(lab).toContain("Promise.all(");
    // The Run panel calls the same client function: one route, one way to call it.
    expect(read("src/app/admin/ai-features/[slug]/run/run-panel.tsx")).toContain("postRun(");
    expect(read("src/lib/ai-runs/client.ts")).toContain('"/admin/ai-runs/run"');
    // No second run route and no second model client.
    expect(lab).not.toMatch(/createHttpModelCall|MODEL_API_KEY/);
  });

  it("test_478_ac1_the_client_maps_the_routes_answers", async () => {
    const answer = {
      ok: true,
      runId: "r1",
      recorded: true,
      output: "Invented.",
      checks: { applied: false, note: "n" },
      inputTokens: 1,
      outputTokens: 1,
      cost: null,
      costNote: null,
      stub: true,
      model: "stub",
      promptVersion: 1,
    };
    const reply = (body: unknown, status = 200) =>
      vi.fn(async () => new Response(JSON.stringify(body), { status }));
    expect(await postRun({}, reply(answer))).toEqual({ kind: "answer", answer });
    expect(
      await postRun(
        {},
        reply({ ok: false, error: "model-error", reason: "timeout", recorded: false, stub: true }),
      ),
    ).toEqual({ kind: "model-error", reason: "timeout", recorded: false, stub: true });
    expect(
      await postRun(
        {},
        reply({ ok: false, error: "prompt-problem", problems: ["{{facts}} is empty."] }, 422),
      ),
    ).toEqual({ kind: "refused", error: "prompt-problem", problems: ["{{facts}} is empty."] });
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await postRun({}, down)).toEqual({ kind: "refused", error: "network", problems: [] });
  });

  it("test_478_ac1_a_second_model_is_offered_only_when_its_three_settings_are_set", () => {
    const env = {
      MODEL_API_KEY: "k",
      MODEL_API_URL: "http://127.0.0.1:4199/v1/chat/completions",
      MODEL_NAME: "stub",
    };
    expect(labModelsFromEnv(env).map((model) => [model.name, model.stub])).toEqual([
      ["stub", true],
    ]);
    const two = labModelsFromEnv({
      ...env,
      LAB_MODEL_2_API_KEY: "k2",
      LAB_MODEL_2_API_URL: "http://127.0.0.1:4199/v1/chat/completions",
      LAB_MODEL_2_NAME: "stub-b",
    });
    expect(two.map((model) => [model.name, model.stub])).toEqual([
      ["stub", true],
      ["stub-b", true],
    ]);
    // Half set, or the same name twice: no second model.
    expect(labModelsFromEnv({ ...env, LAB_MODEL_2_NAME: "stub-b" })).toHaveLength(1);
    expect(
      labModelsFromEnv({
        ...env,
        LAB_MODEL_2_API_KEY: "k2",
        LAB_MODEL_2_API_URL: "http://127.0.0.1:4199/v1/chat/completions",
        LAB_MODEL_2_NAME: "stub",
      }),
    ).toHaveLength(1);
    // No first model: none at all.
    expect(labModelsFromEnv({ LAB_MODEL_2_API_KEY: "k2" })).toEqual([]);
    // No key in the model object's fields.
    expect(JSON.stringify(two)).not.toContain("k2");
  });

  it("test_478_ac1_the_route_runs_the_requested_model_and_refuses_an_unknown_one", async () => {
    const models = [fakeModel("stub"), fakeModel("stub-b")];
    expect(pickLabModel(models, "stub-b")?.name).toBe("stub-b");
    expect(pickLabModel(models, "other")?.name).toBe("stub");
    expect(pickLabModel([], "stub")).toBeNull();

    const versions: PromptVersionRow[] = [
      {
        key: "stuck_story",
        version: 1,
        active: true,
        body: "Invented prompt.",
        params: {},
        note: null,
        created_at: "2026-11-27T00:00:00Z",
        activated_at: null,
      } as unknown as PromptVersionRow,
    ];
    const deps = (model: LabModel | null): RunDeps => ({
      userId: "u1",
      role: "writer",
      readFeature: async () => ({
        slug: "pause_message",
        category: "runtime",
        prompt_keys: ["stuck_story"],
      }),
      readPromptVersions: async () => versions,
      readSample: async () => undefined,
      model,
      prices: {},
      runLog: { start: async () => "run-1", finish: async () => true },
    });
    const request = {
      feature: "pause_message",
      promptKey: "stuck_story",
      prompt: { source: "published" as const },
      sample: null,
      model: "stub-b",
    };
    const ran = await runPrompt(request, deps(pickLabModel(models, "stub-b")));
    expect(ran).toMatchObject({ ok: true, model: "stub-b", stub: true });
    expect(models[1].call).toHaveBeenCalledTimes(1);
    expect(models[0].call).not.toHaveBeenCalled();
    const unknown = await runPrompt(
      { ...request, model: "other" },
      deps(pickLabModel(models, "other")),
    );
    expect(unknown).toEqual({ ok: false, error: "unknown-model" });

    const route = read("src/app/admin/ai-runs/run/route.ts");
    expect(route).toContain("labModelsFromEnv(process.env)");
    expect(route).toContain("pickLabModel(");
  });
});

describe("#478 AC1 Blind hides which side is which until the pass questions are answered", () => {
  it("test_478_ac1_blind_shuffles_the_sides_and_not_blind_keeps_a_left", () => {
    expect(sideOrder(false, () => 0.9)).toEqual(["a", "b"]);
    expect(sideOrder(true, () => 0.9)).toEqual(["b", "a"]);
    expect(sideOrder(true, () => 0.1)).toEqual(["a", "b"]);
  });

  it("test_478_ac1_hidden_until_every_question_of_both_sides_is_answered", () => {
    expect(hiddenNow(true, [true, null], [false, true])).toBe(true);
    expect(hiddenNow(true, [true, false], [false, true])).toBe(false);
    expect(hiddenNow(false, [null, null], [null, null])).toBe(false);
    expect(answersComplete([true, false], 2)).toBe(true);
    expect(answersComplete([true], 2)).toBe(false);
    expect(answersComplete([true, null], 2)).toBe(false);
    expect(answersComplete([], 0)).toBe(false);
  });
});

describe("#478 AC2 pass answers, yes or no per side, saved with the runs", () => {
  const RUN_A = "11111111-1111-4111-8111-111111111111";
  const RUN_B = "22222222-2222-4222-8222-222222222222";
  const write: ComparisonWrite = {
    runA: RUN_A,
    runB: RUN_B,
    blind: true,
    answersA: [true, false, true],
    answersB: [false, false, true],
  };
  const deps = (answer: {
    data: unknown;
    error: unknown;
  }): ComparisonDeps & {
    calls: unknown[][];
  } => {
    const calls: unknown[][] = [];
    return {
      calls,
      userId: "u1",
      role: "writer",
      rpc: async (name, args) => {
        calls.push([name, args]);
        return answer;
      },
    };
  };

  it("test_478_ac2_the_answers_are_saved_with_both_runs_through_save_ai_comparison", async () => {
    const d = deps({ data: "33333333-3333-4333-8333-333333333333", error: null });
    expect(await saveComparison(write, d)).toEqual({
      ok: true,
      id: "33333333-3333-4333-8333-333333333333",
    });
    expect(d.calls).toEqual([
      [
        "save_ai_comparison",
        {
          comparison: {
            run_a: RUN_A,
            run_b: RUN_B,
            blind: true,
            answers_a: [true, false, true],
            answers_b: [false, false, true],
          },
        },
      ],
    ]);
  });

  it("test_478_ac2_only_admin_or_writer_and_only_yes_or_no_answers", async () => {
    const d = deps({ data: "x", error: null });
    expect(await saveComparison(write, { ...d, role: null })).toEqual({
      ok: false,
      error: "not-allowed",
    });
    expect(await saveComparison(write, { ...d, userId: null })).toEqual({
      ok: false,
      error: "not-allowed",
    });
    for (const bad of [
      { ...write, runA: "not-a-uuid" },
      { ...write, runB: RUN_A },
      { ...write, answersA: [true, "yes"] },
      { ...write, answersA: [true, null, true] },
      { ...write, answersA: [] },
      { ...write, answersB: [true] },
      { ...write, blind: "yes" },
    ]) {
      expect(await saveComparison(bad as ComparisonWrite, d)).toEqual({
        ok: false,
        error: "invalid",
      });
    }
    expect(d.calls).toHaveLength(0);
  });

  it("test_478_ac2_database_refusals_have_words", async () => {
    const cases: [string, string][] = [
      ["42501", "not-allowed"],
      ["P0002", "unknown-run"],
      ["23505", "already-saved"],
      ["22023", "invalid"],
      ["XX000", "failed"],
    ];
    for (const [code, error] of cases) {
      expect(await saveComparison(write, deps({ data: null, error: { code } }))).toEqual({
        ok: false,
        error,
      });
      expect(LAB_SAVE_PROBLEMS[error as keyof typeof LAB_SAVE_PROBLEMS]).toMatch(/\.$/);
    }
  });

  it("test_478_ac2_the_migration_stores_the_answers_with_both_runs", () => {
    const code = sql();
    expect(code).toMatch(/create table public\.ai_comparisons \(/);
    expect(code).toMatch(/run_a uuid not null unique references public\.ai_runs \(id\)/);
    expect(code).toMatch(/run_b uuid not null unique references public\.ai_runs \(id\)/);
    expect(code).toMatch(/feature_slug text not null references public\.ai_features \(slug\)/);
    for (const column of ["questions", "answers_a", "answers_b"]) {
      expect(code).toMatch(new RegExp(`${column} jsonb not null`));
    }
    expect(code).toMatch(/blind boolean not null/);
    expect(code).toContain("alter table public.ai_comparisons enable row level security;");
    expect(code).toContain("revoke all on public.ai_comparisons from public, anon, authenticated;");
    expect(code).toContain("grant select on public.ai_comparisons to authenticated;");
    expect(code).toMatch(
      /create policy ai_comparisons_read on public\.ai_comparisons\s+for select to authenticated\s+using \(\(select public\.is_content_editor\(\)\)\);/,
    );
    expect(code).toMatch(/create function public\.save_ai_comparison\(comparison jsonb\)/);
    expect(code).toMatch(/security definer/);
    expect(code).toMatch(/set search_path = ''/);
    // Who and when come from the database, the questions from the feature row, never the caller.
    expect(code).toMatch(/auth\.uid\(\)/);
    expect(code).toMatch(/pass_questions/);
    // Both runs are the caller's own, ended ok, of the same feature and sample.
    expect(code).toMatch(/a\.run_by is distinct from auth\.uid\(\)/);
    expect(code).toMatch(/b\.run_by is distinct from auth\.uid\(\)/);
    expect(code).toMatch(/a\.status is distinct from 'ok'/);
    expect(code).toMatch(/b\.status is distinct from 'ok'/);
    expect(code).toMatch(/sample_id is not distinct from/);
    expect(code).toContain(
      "revoke all on function public.save_ai_comparison(jsonb) from public, anon, authenticated;",
    );
    expect(code).toContain(
      "grant execute on function public.save_ai_comparison(jsonb) to authenticated;",
    );
    // No API role writes the table directly.
    expect(code).not.toMatch(/grant (insert|update|delete)[^;]*ai_comparisons/);
  });

  it("test_478_ac2_the_migration_comes_after_the_sample_library_and_says_its_undo", () => {
    const text = read(MIGRATION);
    expect(text).toMatch(/Run after 20261205000000_ai_samples\.sql/);
    expect(text).toContain("drop function public.save_ai_comparison(jsonb);");
    expect(text).toContain("drop table public.ai_comparisons;");
  });

  it("test_478_ac2_the_action_checks_the_account_before_saving", () => {
    const action = read("src/app/admin/ai-lab/actions.ts");
    expect(action).toMatch(/^"use server";/);
    expect(action).toContain("getCurrentUser(client)");
    expect(action).toContain("readContentRole(client)");
    expect(action).toContain("saveComparison(");
  });
});

describe("#478 the page, the menu and the stub model", () => {
  it("test_478_the_menu_lists_the_comparison_lab_as_air_4", () => {
    expect(read("src/app/admin/admin-shell.tsx")).toContain(
      '{ href: "/admin/ai-lab", id: "AIR-4", label: "Comparison lab" }',
    );
    expect(read("src/app/admin/styles.ts")).toContain('import "./ai-lab/ai-lab.css";');
  });

  it("test_478_the_page_gives_the_browser_model_names_never_a_key", () => {
    const page = read("src/app/admin/ai-lab/page.tsx");
    expect(page).toContain("labModelsFromEnv(process.env)");
    expect(page).toMatch(/name: model\.name,\s+stub: model\.stub/);
    expect(page).not.toMatch(/apiKey|MODEL_API_KEY|call:/);
  });

  it("test_478_ac3_every_e2e_model_is_the_stub_on_this_machine", () => {
    const config = read("playwright.config.ts");
    expect(config).toContain(
      "LAB_MODEL_2_API_URL: `http://127.0.0.1:${stubPort}/v1/chat/completions`",
    );
    expect(config).toContain('LAB_MODEL_2_NAME: "stub-b"');
    const e2e = read("e2e/ai-lab.live.spec.ts");
    expect(e2e).not.toMatch(/deepseek|api\.openai|https:\/\//i);
  });
});
