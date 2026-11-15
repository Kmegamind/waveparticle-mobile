import { describe, expect, it } from "vitest";
import { createModelGateway, type GatewayLog, type ModelGateway } from "@/lib/model-gateway";
import type { PromptKey, PromptRow, PromptSource } from "@/lib/prompts/repository";
import { seedPromptSource, seedRows } from "./support/seed-prompts";

// #282: the gateway reads every prompt from the prompt source. A missing, inactive or broken
// prompt fails the call before any model call: no stored line, no default prompt (NO-BACKUP).

const facts = "He is at the mesa.";

const calls: [string, (g: ModelGateway) => Promise<{ source: string }>][] = [
  ["plan_split", (g) => g.splitPlan({ goal: "SECRET_GOAL", totalMinutes: 30, splitFiner: false })],
  ["step_cards", (g) => g.writeStepCards({ minutes: 10, facts })],
  ["stuck_story", (g) => g.writeStuckStory({ pauseNumber: 1, facts })],
  ["rest_reply", (g) => g.writeRestReply({ facts, userMessage: "SECRET_MESSAGE" })],
  ["return_popup", (g) => g.writeReturnPopup({ trigger: "rest", facts, awayMinutes: 2 })],
  ["closing_line", (g) => g.writeClosingLine({ facts, lastMoment: "He waits." })],
];

function without(missing: PromptKey): PromptSource {
  const source = seedPromptSource();
  return async (key) => (key === missing ? null : source(key));
}

function changed(key: PromptKey, change: (row: PromptRow) => PromptRow): PromptSource {
  const rows = seedRows().map((row) => (row.key === key ? change(row) : row));
  return async (wanted) => rows.find((row) => row.key === wanted) ?? null;
}

async function run(prompts: PromptSource, call: (g: ModelGateway) => Promise<{ source: string }>) {
  const logs: GatewayLog[] = [];
  let modelCalls = 0;
  const gateway = createModelGateway({
    prompts,
    provider: async () => {
      modelCalls += 1;
      return "{}";
    },
    log: (event) => logs.push(event),
  });
  const result = await call(gateway);
  return { result, logs, modelCalls };
}

describe("the gateway and the prompt source (#282)", () => {
  for (const [key, call] of calls) {
    it(`test_282_missing_${key}_fails_with_no_model_call_and_no_text`, async () => {
      const { result, logs, modelCalls } = await run(without(key as PromptKey), call);
      expect(result).toEqual({ source: "failed", reason: "prompt" });
      expect(modelCalls).toBe(0);
      expect(logs).toEqual([
        expect.objectContaining({ call: key, source: "failed", reason: "prompt", attempts: 0 }),
      ]);
      expect(JSON.stringify(logs)).not.toMatch(/SECRET/);
    });
  }

  it("test_282_a_prompt_read_that_hangs_ends_within_the_time_limit", async () => {
    const hanging: PromptSource = () => new Promise(() => undefined);
    const logs: GatewayLog[] = [];
    let modelCalls = 0;
    const gateway = createModelGateway({
      prompts: hanging,
      timeLimitMs: 50,
      provider: async () => {
        modelCalls += 1;
        return "{}";
      },
      log: (event) => logs.push(event),
    });
    const started = Date.now();
    const result = await gateway.writeRestReply({ facts, userMessage: "hello" });
    expect(result).toEqual({ source: "failed", reason: "prompt" });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(modelCalls).toBe(0);
    expect(logs).toEqual([expect.objectContaining({ reason: "prompt", attempts: 0 })]);
  });

  it("test_282_missing_retry_hints_fails_every_call_before_the_model", async () => {
    for (const [, call] of calls) {
      const { result, modelCalls } = await run(without("retry_hints"), call);
      expect(result).toEqual({ source: "failed", reason: "prompt" });
      expect(modelCalls).toBe(0);
    }
  });

  it("test_282_a_prompt_with_an_unknown_placeholder_fails_instead_of_dropping_a_line", async () => {
    const prompts = changed("rest_reply", (row) => ({ ...row, body: `${row.body}\n{{typo}}` }));
    const { result, modelCalls } = await run(prompts, calls[3][1]);
    expect(result).toEqual({ source: "failed", reason: "prompt" });
    expect(modelCalls).toBe(0);
  });

  it("test_282_a_prompt_without_its_check_limits_fails", async () => {
    const prompts = changed("stuck_story", (row) => ({
      ...row,
      params: { ...row.params, checks: {} },
    }));
    const { result, modelCalls } = await run(prompts, calls[2][1]);
    expect(result).toEqual({ source: "failed", reason: "prompt" });
    expect(modelCalls).toBe(0);
  });

  it("test_282_a_new_limit_in_the_row_changes_the_check", async () => {
    const line = "I sit with my papers and my pencil and my cold coffee in the dark room.";
    const answer = JSON.stringify({ story: line });
    const tight = changed("stuck_story", (row) => ({
      ...row,
      params: { ...row.params, checks: { max_sentences: 2, max_words: 5 } },
    }));
    const gateway = (prompts: PromptSource) =>
      createModelGateway({ prompts, provider: async () => answer, maxAttempts: 1 });
    expect(
      (await gateway(seedPromptSource()).writeStuckStory({ pauseNumber: 1, facts })).source,
    ).toBe("generated");
    expect(await gateway(tight).writeStuckStory({ pauseNumber: 1, facts })).toEqual({
      source: "failed",
      reason: "checks",
    });
  });

  it("test_282_a_new_prompt_text_in_the_row_is_what_the_model_receives", async () => {
    const prompts = changed("rest_reply", (row) => ({
      ...row,
      body: "Answer kindly.\nThe person wrote: {{userMessage}}\nFacts: {{facts}}",
    }));
    const sent: string[] = [];
    const gateway = createModelGateway({
      prompts,
      provider: async ({ prompt }) => {
        sent.push(prompt);
        return JSON.stringify({ reply: "I keep to my own desk." });
      },
    });
    await gateway.writeRestReply({ facts: "F", userMessage: "hello" });
    expect(sent).toEqual(["Answer kindly.\nThe person wrote: hello\nFacts: F"]);
  });
});
