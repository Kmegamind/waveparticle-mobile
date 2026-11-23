import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ModelProvider } from "@/lib/model-gateway";
import type { PromptRow } from "@/lib/prompts/repository";
import { saveDisplayName, type ProfileFields, type ProfileWriter } from "@/lib/me/profile";
import { createSafetyClassifier } from "@/lib/safety/classifier";
import {
  createSafetyCheck,
  type SafetyCheck,
  type SafetyContext,
  type SafetyEvent,
  type SafetyGate,
} from "@/lib/safety/check";
import { MeSafetyGate } from "@/app/me/me-safety-gate";
import { seedRows } from "./support/seed-prompts";

// #392: the display name on Me passes the server's safety check before it is saved
// (US-SAF-1, FR-SAFETY-2, SAFETY-FIELDS-NAME). Fakes only: the real model is never called.
// The action wiring and the Me edit state are tested by behaviour in me-display-name-398.test.ts
// (#398); the page itself in e2e/me-display-name-safety.spec.ts.

const USER = "11111111-1111-4111-8111-111111111111";
const row = seedRows().find((seed) => seed.key === "safety_classifier") as PromptRow;

function memoryProfile() {
  const rows: ProfileFields[] = [];
  const writer: ProfileWriter = {
    upsert: vi.fn(async (_userId: string, fields: ProfileFields) => {
      rows.push(fields);
    }),
  };
  return { rows, writer };
}

/** A fake check that answers one fixed gate and records what it was asked. */
function fixedCheck(gate: SafetyGate) {
  const calls: { text: string; context: SafetyContext }[] = [];
  const check = vi.fn<SafetyCheck>(async (text, context) => {
    calls.push({ text, context });
    return gate;
  });
  return { check, calls };
}

/** The real check around a fake provider (never the real model). */
function checkWithProvider(answer: string | Error) {
  const provider = vi.fn<ModelProvider>(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const events: SafetyEvent[] = [];
  const check = createSafetyCheck({
    classifier: createSafetyClassifier({ provider, prompts: async () => row }),
    onEvent: (event) => events.push(event),
  });
  return { check, provider, events };
}

describe("#392 AC1 the server checks the display name before the save", () => {
  it("test_392_ac1_a_crisis_saves_nothing_and_returns_crisis", async () => {
    const { rows, writer } = memoryProfile();
    const { check, calls } = fixedCheck({
      action: "crisis-page",
      tier: "crisis",
      layer: "classifier",
    });
    expect(
      await saveDisplayName(
        { name: "  a quiet goodbye  " },
        { userId: USER, writer, safety: check },
      ),
    ).toEqual({ status: "crisis" });
    expect(writer.upsert).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
    // The trimmed name, position display_name, and no earlier messages (a one-off field).
    expect(calls).toEqual([{ text: "a quiet goodbye", context: { position: "display_name" } }]);
  });

  it("test_392_ac1_an_unsure_answer_counts_as_crisis_and_saves_nothing", async () => {
    const { writer } = memoryProfile();
    const { check, provider } = checkWithProvider('{"tier":"unsure"}');
    expect(await saveDisplayName({ name: "Ada" }, { userId: USER, writer, safety: check })).toEqual(
      { status: "crisis" },
    );
    expect(provider).toHaveBeenCalledTimes(1);
    expect(writer.upsert).not.toHaveBeenCalled();
  });

  it("test_392_ac1_keyword_crisis_words_save_nothing_and_reach_no_model", async () => {
    const { writer } = memoryProfile();
    const { check, provider } = checkWithProvider('{"tier":"none"}');
    expect(
      await saveDisplayName(
        { name: "I want to kill myself" },
        { userId: USER, writer, safety: check },
      ),
    ).toEqual({ status: "crisis" });
    expect(provider).not.toHaveBeenCalled();
    expect(writer.upsert).not.toHaveBeenCalled();
  });

  it("test_392_ac1_without_a_server_check_the_keyword_layer_still_runs", async () => {
    const { writer } = memoryProfile();
    expect(
      await saveDisplayName({ name: "I want to kill myself" }, { userId: USER, writer }),
    ).toEqual({ status: "crisis" });
    expect(writer.upsert).not.toHaveBeenCalled();
  });

  it("test_392_ac1_an_invalid_name_is_refused_before_any_classifier_call", async () => {
    const { writer } = memoryProfile();
    const { check } = fixedCheck({ action: "continue", tier: "none", layer: "classifier" });
    for (const name of ["", "   ", "x".repeat(61), 42]) {
      expect(
        await saveDisplayName({ name }, { userId: USER, writer, safety: check }),
        String(name),
      ).toEqual({ status: "invalid" });
    }
    expect(await saveDisplayName({ name: "Ada" }, { userId: null, writer, safety: check })).toEqual(
      { status: "failed" },
    );
    expect(check).not.toHaveBeenCalled();
    expect(writer.upsert).not.toHaveBeenCalled();
  });

  it("test_392_ac1_a_check_that_throws_saves_nothing", async () => {
    const { writer } = memoryProfile();
    const check = vi.fn<SafetyCheck>(async () => {
      throw new Error("broken");
    });
    expect(await saveDisplayName({ name: "Ada" }, { userId: USER, writer, safety: check })).toEqual(
      { status: "failed" },
    );
    expect(writer.upsert).not.toHaveBeenCalled();
  });
});

describe("#392 AC3 ordinary text is saved as today", () => {
  for (const tier of ["none", "stress"] as const) {
    it(`test_392_ac3_a_${tier}_answer_saves_the_trimmed_name`, async () => {
      const { rows, writer } = memoryProfile();
      const { check, provider } = checkWithProvider(`{"tier":"${tier}"}`);
      expect(
        await saveDisplayName({ name: "  Ada  " }, { userId: USER, writer, safety: check }),
      ).toEqual({ status: "ok", name: "Ada" });
      expect(provider).toHaveBeenCalledTimes(1);
      expect(rows).toEqual([{ nickname: "Ada" }]);
    });
  }

  it("test_392_ac3_a_failed_classifier_leaves_the_keyword_layer_and_saves", async () => {
    const { rows, writer } = memoryProfile();
    const { check, events } = checkWithProvider(new Error("request"));
    expect(await saveDisplayName({ name: "Ada" }, { userId: USER, writer, safety: check })).toEqual(
      { status: "ok", name: "Ada" },
    );
    expect(rows).toEqual([{ nickname: "Ada" }]);
    expect(events).toEqual([
      expect.objectContaining({ kind: "classifier_failed", position: "display_name" }),
    ]);
  });
});

describe("#392 AC2 the Me page shows S1 in place of Me", () => {
  it("test_392_ac2_the_gate_shows_me_until_a_crisis", () => {
    const html = renderToStaticMarkup(
      createElement(MeSafetyGate, null, createElement("main", null, "Me content")),
    );
    expect(html).toContain("Me content");
    expect(html).not.toContain("hidden");
    expect(html).not.toContain("crisis-page");
  });
});
