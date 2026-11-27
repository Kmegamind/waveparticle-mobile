import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LAB_CALL_INPUTS, callInputFrom } from "@/lib/ai-runs/call-inputs";
import {
  answersLocked,
  comparisonWrite,
  defaultSides,
  setAnswer,
  sideOptions,
  sideRequest,
  sideVariables,
  withSideReply,
  type AnswerState,
  type LabPrompt,
} from "@/lib/ai-runs/comparison";
import type { LabModel } from "@/lib/ai-runs/model";
import { runPrompt, type LabSample, type RunDeps, type RunRequest } from "@/lib/ai-runs/run";
import type { PromptVersionRow } from "@/lib/prompts/admin";
import { seedRows } from "./support/seed-prompts";

// #517 AC4: the comparison lab (#478) and the Run route (#476) run ANY stored version of a prompt
// (active or not, from public.prompts) of each of the six keys, on any sample. One run route, one
// fake model, the same empty-variable refusal and the same shared client. Every model here is a
// fake with stub = true; nothing reaches a real model or the network.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const SIX = [
  "rest_reply",
  "rest_reply_review",
  "stuck_story",
  "pause_predicament",
  "return_popup",
  "closing_line",
] as const;

const MODELS = [{ name: "stub", stub: true }];

/** rest_reply: v3 published, v4 the draft, v1 and v2 earlier stored versions. */
const PROMPT: LabPrompt = {
  key: "rest_reply",
  published: { version: 3, variables: ["facts", "userMessage"] },
  draft: { version: 4, variables: ["facts", "userMessage"] },
  stored: [
    { version: 4, active: false, variables: ["facts", "userMessage"] },
    { version: 3, active: true, variables: ["facts", "userMessage"] },
    { version: 2, active: false, variables: ["facts"] },
    { version: 1, active: false, variables: ["name"] },
  ],
  callInputs: ["userMessage"],
};

describe("#517 AC4 the lab offers every stored version", () => {
  it("test_517_ac4_each_side_offers_every_stored_version_after_published_and_draft", () => {
    expect(sideOptions(PROMPT, MODELS)).toEqual([
      { value: "published", label: "Published version (v3)" },
      { value: "draft", label: "Draft version (v4)" },
      { value: "version:2", label: "Stored version (v2)" },
      { value: "version:1", label: "Stored version (v1)" },
      { value: "model:stub", label: "Stub model: stub (published version)" },
    ]);
  });

  it("test_517_ac4_a_key_with_only_an_inactive_version_offers_it", () => {
    // rest_reply_review before the owner activates it: one inactive version, no published one.
    const review: LabPrompt = {
      key: "rest_reply_review",
      published: null,
      draft: { version: 1, variables: ["draft"] },
      stored: [{ version: 1, active: false, variables: ["draft"] }],
      callInputs: ["userMessage", "draft"],
    };
    expect(sideOptions(review, MODELS).map((option) => option.value)).toEqual([
      "draft",
      "model:stub",
    ]);
    expect(defaultSides(review, MODELS)).toEqual({ a: "draft", b: "draft" });
  });

  it("test_517_ac4_a_stored_version_side_is_a_run_request_of_that_version", () => {
    const base = {
      feature: "rest_reply",
      prompt: PROMPT,
      sample: "invented-lamp-maker",
      models: MODELS,
    };
    expect(sideRequest({ ...base, choice: "version:1" })).toEqual({
      feature: "rest_reply",
      promptKey: "rest_reply",
      prompt: { source: "draft", version: 1 },
      sample: "invented-lamp-maker",
      model: "stub",
    });
    expect(sideRequest({ ...base, choice: "version:9" })).toBeNull();
    expect(sideRequest({ ...base, choice: "version:x" })).toBeNull();
    expect(sideVariables(PROMPT, "version:1")).toEqual(["name"]);
    expect(sideVariables(PROMPT, "version:2")).toEqual(["facts"]);
  });

  it("test_517_ac4_the_call_inputs_go_with_the_request_when_given", () => {
    const request = sideRequest({
      feature: "rest_reply",
      prompt: PROMPT,
      choice: "version:2",
      sample: "invented-lamp-maker",
      models: MODELS,
      inputs: { userMessage: "An invented message." },
    });
    expect(request).toMatchObject({ inputs: { userMessage: "An invented message." } });
  });

  it("test_517_ac4_the_page_gives_the_browser_every_stored_versions_number_not_its_text", () => {
    const page = read("src/app/admin/ai-lab/page.tsx");
    expect(page).toContain("stored:");
    expect(page).toContain("callInputs:");
    expect(page).not.toMatch(/stored:[^\n]*body:/);
  });

  it("test_517_ac4_the_lab_reuses_the_shared_client_and_one_run_route", () => {
    const lab = read("src/app/admin/ai-lab/lab.tsx");
    expect(lab).toContain("postRun(");
    expect(lab).not.toMatch(/fetch\(/);
    expect(read("src/lib/ai-runs/client.ts")).toContain('"/admin/ai-runs/run"');
  });
});

describe("#517 AC4 Blind and the per-side answers still hold with stored versions", () => {
  it("test_517_ac4_side_a_answers_go_with_run_a_and_lock_once_shown", () => {
    let state: AnswerState = {
      blind: true,
      peeked: false,
      order: ["b", "a"],
      a: { runId: null, answers: [null, null] },
      b: { runId: null, answers: [null, null] },
    };
    state = withSideReply(state, "a", "11111111-1111-4111-8111-111111111111");
    state = withSideReply(state, "b", "22222222-2222-4222-8222-222222222222");
    state = setAnswer(state, "a", 0, true);
    state = setAnswer(state, "a", 1, false);
    state = setAnswer(state, "b", 0, false);
    state = setAnswer(state, "b", 1, true);
    expect(answersLocked(state)).toBe(true);
    expect(setAnswer(state, "a", 0, false)).toBe(state);
    expect(comparisonWrite(state)).toEqual({
      runA: "11111111-1111-4111-8111-111111111111",
      runB: "22222222-2222-4222-8222-222222222222",
      blind: true,
      answersA: [true, false],
      answersB: [false, true],
    });
  });
});

describe("#517 AC4 call inputs: the rest of a runtime call's input, beside the sample", () => {
  it("test_517_ac4_every_one_of_the_six_keys_has_its_call_inputs", () => {
    expect(Object.keys(LAB_CALL_INPUTS).sort()).toEqual([...SIX].sort());
    expect(LAB_CALL_INPUTS.rest_reply_review.map((field) => field.name)).toEqual([
      "userMessage",
      "draft",
    ]);
  });

  it("test_517_ac4_the_sample_gives_the_companion_and_the_facts", () => {
    expect(
      callInputFrom(
        "rest_reply_review",
        { name: "Ada Tester", facts: "- She sells lamps." },
        { userMessage: " Hello ", draft: "I count the wicks." },
      ),
    ).toEqual({
      ok: true,
      input: {
        companionName: "Ada Tester",
        facts: "- She sells lamps.",
        userMessage: "Hello",
        draft: "I count the wicks.",
      },
    });
    expect(
      callInputFrom(
        "return_popup",
        { name: "A", facts: "f" },
        { trigger: "absence", awayMinutes: "45" },
      ),
    ).toEqual({
      ok: true,
      input: { companionName: "A", facts: "f", trigger: "absence", awayMinutes: 45 },
    });
    expect(callInputFrom("stuck_story", { name: "A", facts: "f" }, { pauseNumber: "3" })).toEqual({
      ok: true,
      input: { companionName: "A", facts: "f", pauseNumber: 3 },
    });
  });

  it("test_517_ac4_an_empty_sample_field_or_call_input_is_refused_and_named", () => {
    expect(callInputFrom("rest_reply", { name: null, facts: "f" }, { userMessage: "hi" })).toEqual({
      ok: false,
      problems: ["This sample has no Companion, which {{name}} needs."],
    });
    expect(callInputFrom("rest_reply", { name: "A", facts: "f" }, { userMessage: "  " })).toEqual({
      ok: false,
      problems: ["Write the call input The person wrote ({{userMessage}})."],
    });
    expect(
      callInputFrom("stuck_story", { name: "A", facts: "f" }, { pauseNumber: "0" }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      callInputFrom("return_popup", { name: "A", facts: "f" }, { trigger: "x", awayMinutes: "5" }),
    ).toMatchObject({
      ok: false,
    });
  });
});

// ---- The Run route with a stored version of each of the six keys ----

function fakeModel(text: string): LabModel {
  return {
    name: "stub",
    stub: true,
    call: vi.fn(async () => ({ text, inputTokens: 3, outputTokens: 2 })),
  };
}

const seed = seedRows();
/** The seed row of a key, or an invented review row: v1 earlier, v2 active, v3 draft. */
function versionsOf(key: string): PromptVersionRow[] {
  const row = seed.find((item) => item.key === key) ?? {
    key,
    version: 1,
    body: 'Return JSON only: {"reply":"..."}\nFacts: {{facts}}\nThe person wrote: {{userMessage}}\nDraft: {{draft}}',
    params: { checks: { max_sentences: 3, max_words: 80, min_sentences: 1 } },
  };
  const base = { note: "", created_at: "2026-11-27T00:00:00Z", category: "runtime" as const };
  return [
    {
      ...base,
      key,
      version: 1,
      active: false,
      body: `${row.body}\nStored v1 marker.`,
      params: row.params,
      activated_at: "2026-11-20T00:00:00Z",
    },
    {
      ...base,
      key,
      version: 2,
      active: true,
      body: row.body,
      params: row.params,
      activated_at: "2026-11-21T00:00:00Z",
    },
    {
      ...base,
      key,
      version: 3,
      active: false,
      body: `${row.body}\nDraft v3 marker.`,
      params: row.params,
      activated_at: null,
    },
  ];
}

const FEATURE: Record<string, string> = {
  rest_reply: "rest_reply",
  rest_reply_review: "rest_reply_review",
  stuck_story: "pause_message",
  pause_predicament: "pause_message",
  return_popup: "return_popup",
  closing_line: "closing_line",
};

const INPUTS: Record<string, Record<string, string>> = {
  rest_reply: { userMessage: "An invented message." },
  rest_reply_review: { userMessage: "An invented message.", draft: "I count the wicks again." },
  stuck_story: { pauseNumber: "1" },
  pause_predicament: { pauseNumber: "1", story: "He has lost the count of the wicks." },
  return_popup: { trigger: "rest", awayMinutes: "5" },
  closing_line: { lastMoment: "The lamps are lit." },
};

const SAMPLE: LabSample = {
  id: "invented-lamp-maker",
  values: { name: "Ada Tester", facts: "- She sells lamps on market days." },
};

function deps(key: string, model: LabModel, starts: unknown[]): RunDeps {
  return {
    userId: "u1",
    role: "admin",
    readFeature: async (slug) => ({ slug, category: "runtime", prompt_keys: [key] }),
    readPromptVersions: async () => versionsOf(key),
    readSample: async () => SAMPLE,
    model,
    prices: {},
    runLog: {
      start: async (run) => {
        starts.push(run);
        return "run-1";
      },
      finish: async () => true,
    },
  };
}

describe("#517 AC4 the Run route runs any stored version of each of the six keys on a sample", () => {
  for (const key of SIX) {
    it(`test_517_ac4_${key}_runs_an_earlier_stored_version_with_the_gateways_prompt_and_checks`, async () => {
      const model = fakeModel("not an answer");
      const starts: { prompt_version: number; prompt_source: string; input: string }[] = [];
      const request: RunRequest = {
        feature: FEATURE[key],
        promptKey: key,
        prompt: { source: "draft", version: 1 },
        sample: SAMPLE.id,
        model: "stub",
        inputs: INPUTS[key],
      };
      const ran = await runPrompt(request, deps(key, model, starts));
      expect(ran).toMatchObject({ ok: true, promptVersion: 1, stub: true });
      // The version run is v1 (an earlier, inactive version), built by the gateway's builder.
      expect(starts[0]).toMatchObject({ prompt_version: 1, prompt_source: "draft" });
      expect(starts[0].input).toContain("Stored v1 marker.");
      expect(starts[0].input).not.toContain("{{");
      // The gateway's checks are applied to the answer.
      if (ran.ok) expect(ran.checks).toMatchObject({ applied: true, passed: false });
      expect(model.call).toHaveBeenCalledTimes(1);
    });
  }

  it("test_517_ac4_the_draft_and_the_active_version_run_too", async () => {
    for (const [prompt, version] of [
      [{ source: "draft", version: 3 }, 3],
      [{ source: "published" }, 2],
    ] as const) {
      const starts: { prompt_version: number }[] = [];
      const ran = await runPrompt(
        {
          feature: "rest_reply",
          promptKey: "rest_reply",
          prompt,
          sample: SAMPLE.id,
          model: "stub",
          inputs: INPUTS.rest_reply,
        },
        deps("rest_reply", fakeModel('{"reply":"I count the wicks."}'), starts),
      );
      expect(ran).toMatchObject({ ok: true, promptVersion: version });
    }
  });

  it("test_517_ac4_an_empty_sample_field_stops_the_run_before_the_row_and_the_model", async () => {
    const model = fakeModel("x");
    const starts: unknown[] = [];
    const empty = deps("rest_reply", model, starts);
    empty.readSample = async () => ({ id: "s", values: { name: "Ada", facts: null } });
    const ran = await runPrompt(
      {
        feature: "rest_reply",
        promptKey: "rest_reply",
        prompt: { source: "draft", version: 1 },
        sample: "s",
        model: "stub",
        inputs: { userMessage: "hi" },
      },
      empty,
    );
    expect(ran).toEqual({
      ok: false,
      error: "prompt-problem",
      problems: ["This sample has no Facts, which {{facts}} needs."],
    });
    expect(starts).toEqual([]);
    expect(model.call).not.toHaveBeenCalled();
  });

  it("test_517_ac4_without_call_inputs_the_route_works_as_before", async () => {
    // No `inputs`: the sample fills the {{variables}} and the existing refusal names what is missing.
    const model = fakeModel("x");
    const starts: unknown[] = [];
    const ran = await runPrompt(
      {
        feature: "rest_reply",
        promptKey: "rest_reply",
        prompt: { source: "draft", version: 1 },
        sample: SAMPLE.id,
        model: "stub",
      },
      deps("rest_reply", model, starts),
    );
    expect(ran).toMatchObject({ ok: false, error: "prompt-problem" });
    expect(model.call).not.toHaveBeenCalled();
  });

  it("test_517_ac4_bad_call_inputs_are_refused_as_an_invalid_request", async () => {
    const model = fakeModel("x");
    for (const inputs of [{ userMessage: 5 }, { userMessage: "x".repeat(2001) }, "text", ["a"]]) {
      const ran = await runPrompt(
        {
          feature: "rest_reply",
          promptKey: "rest_reply",
          prompt: { source: "published" },
          sample: SAMPLE.id,
          model: "stub",
          inputs,
        } as unknown as RunRequest,
        deps("rest_reply", model, []),
      );
      expect(ran).toEqual({ ok: false, error: "invalid" });
    }
  });
});
