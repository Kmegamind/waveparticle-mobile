import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway, promptRowProblems } from "@/lib/model-gateway";
import { buildLabCall, DEFAULT_TIME_LIMIT_MS } from "@/lib/model-gateway/gateway";
import type { GatewayLog, RestReplyInput } from "@/lib/model-gateway/types";
import {
  createPromptRepository,
  OPTIONAL_PROMPT_KEYS,
  PROMPT_KEYS,
  type PromptLog,
  type PromptRow,
  type PromptSource,
} from "@/lib/prompts/repository";
import { restReplyFor } from "@/lib/prototype/rest-lines";
import type { SafetyCheck } from "@/lib/safety/check";
import { seedContent } from "./support/seed-content";
import { seedPromptSource, seedRows } from "./support/seed-prompts";
import { OPPENHEIMER } from "./support/companion";

// #517 (REST-TWO-CALLS, owner decision 2026-11-27): the rest chat reply is two model calls.
// Call 1 (rest_reply) writes the reply; call 2 (rest_reply_review) reads that draft ({{draft}})
// and returns it unchanged or rewritten as {"reply": "..."}. The final reply passes every rest chat
// check; when call 2 fails, call 1's reply is shown; with no active rest_reply_review the gateway
// runs call 1 only, as before. Every model here is a fake (an in-test function): no real model.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/** An invented review row as the owner stores it: the same check limits as rest_reply. */
const REVIEW_ROW: PromptRow = {
  key: "rest_reply_review",
  version: 1,
  body: [
    'Return JSON only: {"reply":"..."}',
    "Invented review prompt for tests.",
    "Facts already known: {{facts}}",
    "The person wrote: {{userMessage}}",
    "Draft: {{draft}}",
  ].join("\n"),
  params: { checks: { max_sentences: 3, max_words: 80, min_sentences: 1 } },
};

/** The seed prompts, plus the review row when one is given. */
function prompts(review: PromptRow | null = REVIEW_ROW): PromptSource {
  const seed = seedPromptSource();
  return async (key) => (key === "rest_reply_review" ? review : seed(key));
}

const reply = (text: string) => JSON.stringify({ reply: text });
const DRAFT = "I keep my notes dry under my coat.";
const REWRITE = "I keep my notes dry and I wait for the rain to stop.";

const INPUT: RestReplyInput = {
  companionName: OPPENHEIMER,
  facts: "He is at a table.",
  userMessage: "hello",
};

type Answer = string | Error | "hang";

/** A fake model that answers each call in turn and records every prompt it was sent. */
function scripted(
  answers: Answer[],
  options: { review?: PromptRow | null; timeLimitMs?: number; source?: PromptSource } = {},
) {
  const sent: string[] = [];
  const logs: GatewayLog[] = [];
  const gateway = createModelGateway({
    prompts: options.source ?? prompts(options.review === undefined ? REVIEW_ROW : options.review),
    timeLimitMs: options.timeLimitMs ?? 60_000,
    log: (event) => logs.push(event),
    provider: ({ prompt, signal }) => {
      sent.push(prompt);
      const answer = answers[sent.length - 1] ?? "no json";
      if (answer === "hang") {
        return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal)));
      }
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(answer);
    },
  });
  return { gateway, sent, logs };
}

describe("#517 AC1 two calls, the final reply shown, call 1 as the fallback", () => {
  it("test_517_ac1_a_rest_message_makes_two_calls_and_shows_the_final_reply", async () => {
    const { gateway, sent } = scripted([reply(DRAFT), reply(REWRITE)]);
    const result = await gateway.writeRestReply(INPUT);
    expect(result).toEqual({ source: "generated", text: REWRITE });
    expect(sent).toHaveLength(2);
    // Call 2 gets call 1's reply as {{draft}}, with the same facts and message.
    expect(sent[1]).toContain(`Draft: ${DRAFT}`);
    expect(sent[1]).toContain("The person wrote: hello");
    expect(sent[1]).toContain("Facts already known: He is at a table.");
    expect(sent[0]).not.toContain("Draft:");
  });

  it("test_517_ac1_an_unchanged_draft_from_call_2_is_shown", async () => {
    const { gateway, sent } = scripted([reply(DRAFT), reply(DRAFT)]);
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    expect(sent).toHaveLength(2);
  });

  it.each([
    ["a failed request", new Error("down") as Answer],
    ["invalid JSON", "not json at all"],
    ["JSON without a reply", JSON.stringify({ text: REWRITE })],
    ["an empty reply", reply("")],
  ])("test_517_ac1_when_call_2_gives_%s_call_1s_reply_is_shown", async (_, second) => {
    const { gateway, sent, logs } = scripted([reply(DRAFT), second]);
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    // Call 2 is one attempt: no retry of the review.
    expect(sent).toHaveLength(2);
    expect(logs.map((event) => [event.call, event.source])).toEqual([
      ["rest_reply", "generated"],
      ["rest_reply_review", "failed"],
    ]);
  });

  it("test_517_ac1_when_call_2_times_out_call_1s_reply_is_shown_within_the_time_limit", async () => {
    const { gateway, logs } = scripted([reply(DRAFT), "hang"], { timeLimitMs: 300 });
    const started = Date.now();
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    // Both calls together stay within the one time limit (plus timer slack).
    expect(Date.now() - started).toBeLessThan(300 + 200);
    expect(logs.at(-1)).toMatchObject({ call: "rest_reply_review", reason: "timeout" });
  });

  it("test_517_ac1_when_reading_the_review_prompt_fails_call_1s_reply_is_shown", async () => {
    const seed = seedPromptSource();
    const source: PromptSource = async (key) => {
      if (key === "rest_reply_review") throw new Error("read failed");
      return seed(key);
    };
    const { gateway, sent } = scripted([reply(DRAFT), reply(REWRITE)], { source });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    expect(sent).toHaveLength(1);
  });

  it("test_517_ac1_an_unusable_review_row_falls_back_to_call_1_without_a_second_call", async () => {
    const broken = { ...REVIEW_ROW, body: `${REVIEW_ROW.body}\n{{unknownName}}` };
    const { gateway, sent } = scripted([reply(DRAFT), reply(REWRITE)], { review: broken });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    expect(sent).toHaveLength(1);
  });

  it("test_517_ac1_when_both_calls_fail_the_result_is_the_failure_with_no_text", async () => {
    // Call 1 fails every attempt (it is regenerated within the time limit, as before): call 2 is
    // never made, and the result is the failure the screens show with Retry.
    const { gateway, sent } = scripted(["no json", "no json", "no json", reply(REWRITE)]);
    const result = await gateway.writeRestReply(INPUT);
    expect(result).toEqual({ source: "failed", reason: "checks" });
    expect(sent).toHaveLength(3);
    expect(sent.some((prompt) => prompt.includes("Draft:"))).toBe(false);
  });

  it("test_517_ac1_call_1_is_regenerated_within_the_limit_then_reviewed", async () => {
    const { gateway, sent } = scripted(["no json", reply(DRAFT), reply(REWRITE)]);
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: REWRITE });
    expect(sent).toHaveLength(3);
    expect(sent[2]).toContain(`Draft: ${DRAFT}`);
  });

  it("test_517_ac1_the_rest_screen_gets_the_failure_status_when_both_fail", async () => {
    const seed = seedContent();
    const { gateway } = scripted(["no json", "no json", "no json"]);
    const answer = await restReplyFor(
      seed,
      { message: "hello", history: [], replyIndex: 0 },
      gateway,
    );
    expect(answer).toEqual({ status: "failed" });
  });

  it("test_517_ac1_the_rest_screen_shows_call_2s_reply", async () => {
    const seed = seedContent();
    const { gateway } = scripted([reply(DRAFT), reply(REWRITE)]);
    const answer = await restReplyFor(
      seed,
      { message: "hello", history: [], replyIndex: 0 },
      gateway,
    );
    expect(answer).toEqual({ status: "ok", isTestData: false, text: REWRITE });
  });
});

describe("#517 AC2 the final reply passes every rest chat check", () => {
  it.each([
    ["a dash (AI-6 form)", "I keep my notes dry — under my coat."],
    ["an exclamation mark (AI-6 form)", "I keep my notes dry under my coat!"],
    ["two questions (AI-6 question)", "Do you write? Do you sleep?"],
    ["his own name (AI-6 name)", `${OPPENHEIMER} keeps his notes dry.`],
    ["four sentences (rest chat length)", "I sit. I write. I wait. I look at the wall."],
  ])("test_517_ac2_a_rewrite_with_%s_is_not_shown", async (_, bad) => {
    const { gateway } = scripted([reply(DRAFT), reply(bad)]);
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
  });

  it("test_517_ac2_a_rewrite_with_a_later_word_is_not_shown", async () => {
    const { gateway } = scripted([reply(DRAFT), reply("I have a computer on my desk.")]);
    const input = { ...INPUT, forbidTerms: ["computer"] };
    expect(await gateway.writeRestReply(input)).toEqual({ source: "generated", text: DRAFT });
  });

  it("test_517_ac2_a_rewrite_with_a_later_word_the_person_typed_is_shown_chat_user_word", async () => {
    const said = "I have never heard of a computer.";
    const { gateway } = scripted([reply(DRAFT), reply(said)]);
    const input = {
      ...INPUT,
      userMessage: "do you have a computer",
      forbidTerms: ["computer"],
      userTexts: ["do you have a computer"],
    };
    expect(await gateway.writeRestReply(input)).toEqual({ source: "generated", text: said });
  });

  it("test_517_ac2_a_rewrite_that_spoils_a_later_part_is_not_shown_chat_spoiler_check", async () => {
    const spoiler = "I think of the Trinity test tonight.";
    const any = scripted([reply(DRAFT), reply(spoiler)]);
    expect(await any.gateway.writeRestReply({ ...INPUT, laterFacts: ["trinity"] })).toEqual({
      source: "generated",
      text: DRAFT,
    });
    const exact = scripted([reply(DRAFT), reply(spoiler)]);
    expect(await exact.gateway.writeRestReply({ ...INPUT, laterWords: ["Trinity"] })).toEqual({
      source: "generated",
      text: DRAFT,
    });
  });

  it("test_517_ac2_a_review_row_cannot_loosen_the_rest_reply_limits", async () => {
    // The review row allows 200 words; the rest_reply row's own limit (80) still applies.
    const loose = {
      ...REVIEW_ROW,
      params: { checks: { max_sentences: 3, max_words: 200, min_sentences: 1 } },
    };
    const long = `I ${"wait and ".repeat(45)}write.`;
    const { gateway } = scripted([reply(DRAFT), reply(long)], { review: loose });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
  });

  it("test_517_ac2_a_crisis_message_reaches_neither_call_safety_classifier", async () => {
    const seed = seedContent();
    const { gateway, sent } = scripted([reply(DRAFT), reply(REWRITE)]);
    const crisis: SafetyCheck = async () =>
      ({ action: "crisis-page" }) as Awaited<ReturnType<SafetyCheck>>;
    const answer = await restReplyFor(
      seed,
      { message: "an invented crisis message", history: [], replyIndex: 0 },
      gateway,
      crisis,
    );
    expect(answer).toEqual({ status: "crisis" });
    expect(sent).toHaveLength(0);
  });
});

describe("#517 AC3 no active rest_reply_review: one call, exactly as before", () => {
  it("test_517_ac3_with_no_active_review_the_gateway_makes_one_call", async () => {
    const { gateway, sent, logs } = scripted([reply(DRAFT), reply(REWRITE)], { review: null });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    expect(sent).toHaveLength(1);
    expect(logs.map((event) => event.call)).toEqual(["rest_reply"]);
  });

  it("test_517_ac3_with_no_active_review_only_call_1s_attempts_and_log_happen", async () => {
    // Fix round 1 (M-1): explicit expectations, not a comparison of the new code with itself.
    // With no active review, every outcome is call 1's own: its attempts, its result, its one log.
    const cases: { answers: Answer[]; result: unknown; attempts: number; source: string }[] = [
      {
        answers: [reply(DRAFT)],
        result: { source: "generated", text: DRAFT },
        attempts: 1,
        source: "generated",
      },
      {
        answers: ["no json", reply(DRAFT)],
        result: { source: "generated", text: DRAFT },
        attempts: 2,
        source: "generated",
      },
      {
        answers: ["no json", "no json", "no json"],
        result: { source: "failed", reason: "checks" },
        attempts: 3,
        source: "failed",
      },
    ];
    for (const { answers, result, attempts, source } of cases) {
      const none = scripted(answers, { review: null });
      expect(await none.gateway.writeRestReply(INPUT)).toEqual(result);
      expect(none.sent).toHaveLength(attempts);
      expect(none.sent.every((prompt) => !prompt.includes("Draft:"))).toBe(true);
      expect(none.logs).toHaveLength(1);
      expect(none.logs[0]).toMatchObject({ call: "rest_reply", source, attempts });
    }
    expect(seedRows().some((row) => row.key === "rest_reply_review")).toBe(false);
  });

  it("test_517_ac3_the_review_lookup_shares_call_1s_read_when_the_cache_expires_during_call_1", async () => {
    // Fix round 1 (I-1): the cache is filled, then expires while call 1 waits for the model. The
    // review lookup started with call 1's own read, so no read happens after call 1.
    let clock = 0;
    let reads = 0;
    const logs: PromptLog[] = [];
    const repository = createPromptRepository({
      readRows: async () => {
        reads += 1;
        return seedRows();
      },
      cacheMs: 1_000,
      now: () => clock,
      log: (event) => logs.push(event),
    });
    await repository.getActivePrompt("rest_reply"); // fills the cache at 0
    clock = 900; // 100 ms before it expires
    const sent: string[] = [];
    const gateway = createModelGateway({
      prompts: repository.getActivePrompt,
      timeLimitMs: 60_000,
      provider: async ({ prompt }) => {
        sent.push(prompt);
        clock += 5_000; // call 1 takes long enough for the cache to expire
        return reply(DRAFT);
      },
    });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    expect(sent).toHaveLength(1);
    expect(reads).toBe(1);
    expect(logs).toEqual([]);
  });

  it("test_517_ac3_a_failed_prompt_read_logs_only_call_1s_keys_as_before", async () => {
    const logs: PromptLog[] = [];
    const repository = createPromptRepository({
      readRows: async () => {
        throw new Error("down");
      },
      log: (event) => logs.push(event),
    });
    const sent: string[] = [];
    const gateway = createModelGateway({
      prompts: repository.getActivePrompt,
      provider: async ({ prompt }) => {
        sent.push(prompt);
        return reply(DRAFT);
      },
    });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "failed", reason: "prompt" });
    expect(sent).toHaveLength(0);
    expect(logs.map((event) => event.key).sort()).toEqual(["rest_reply", "retry_hints"]);
  });

  it("test_517_ac3_a_row_of_another_key_never_turns_call_2_on", async () => {
    // A prompt source that answers every key with the same row (as some test fakes do).
    const seed = seedPromptSource();
    const source: PromptSource = async (key) =>
      key === "rest_reply_review" ? { ...REVIEW_ROW, key: "rest_reply" } : seed(key);
    const { gateway, sent } = scripted([reply(DRAFT), reply(REWRITE)], { source });
    expect(await gateway.writeRestReply(INPUT)).toEqual({ source: "generated", text: DRAFT });
    expect(sent).toHaveLength(1);
  });

  it("test_517_ac3_a_missing_review_prompt_is_not_logged_as_a_missing_prompt", async () => {
    const logs: PromptLog[] = [];
    const repository = createPromptRepository({
      readRows: async () => seedRows(),
      log: (event) => logs.push(event),
    });
    expect(await repository.getActivePrompt("rest_reply_review")).toBeNull();
    expect(logs).toEqual([]);
    // A required key is still logged.
    const only = createPromptRepository({
      readRows: async () => seedRows().filter((row) => row.key !== "plan_split"),
      log: (event) => logs.push(event),
    });
    expect(await only.getActivePrompt("plan_split")).toBeNull();
    expect(logs).toEqual([{ event: "prompt_missing", key: "plan_split" }]);
  });

  it("test_517_ac3_the_review_key_is_optional_and_not_a_seeded_key", () => {
    expect(OPTIONAL_PROMPT_KEYS).toEqual(["rest_reply_review"]);
    expect(PROMPT_KEYS as readonly string[]).not.toContain("rest_reply_review");
  });

  it("test_517_ac3_the_default_time_limit_is_unchanged", () => {
    expect(DEFAULT_TIME_LIMIT_MS).toBe(12_000);
  });
});

describe("#517 the review row is checked like every prompt row", () => {
  it("test_517_a_usable_review_row_has_no_problems", () => {
    expect(promptRowProblems(REVIEW_ROW)).toEqual([]);
  });

  it("test_517_a_review_row_without_checks_or_with_an_unknown_name_is_refused", () => {
    expect(promptRowProblems({ ...REVIEW_ROW, params: {} })).toEqual([
      "Missing or unusable setting: checks.",
    ]);
    expect(promptRowProblems({ ...REVIEW_ROW, body: "{{nope}}" })).toEqual([
      "Unknown {{nope}} in the prompt.",
    ]);
  });

  it("test_517_the_lab_builds_the_review_call_with_its_draft", () => {
    const built = buildLabCall("rest_reply_review", REVIEW_ROW, { ...INPUT, draft: DRAFT });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.prompt).toContain(`Draft: ${DRAFT}`);
    expect(built.check(reply(REWRITE))).toEqual({ passed: true, failedRules: [] });
    expect(built.check("nope").passed).toBe(false);
  });

  it("test_517_the_server_log_names_the_review_call", () => {
    expect(read("src/lib/model-gateway/types.ts")).toMatch(/\| "rest_reply_review"/);
  });
});
