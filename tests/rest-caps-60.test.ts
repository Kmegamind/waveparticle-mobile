import { describe, expect, it, vi } from "vitest";
import { createModelGateway, type ModelGateway } from "@/lib/model-gateway";
import { checkCompanionLine, mentionsWord } from "@/lib/model-gateway/checks";
import type { RestReplyInput } from "@/lib/model-gateway/types";
import { normaliseRestRequest } from "@/lib/prototype/line-requests";
import { isChatLaterFact, laterStoryWords } from "@/lib/prototype/rest-later-words";
import { MAX_MESSAGE_CHARS, restReplyFor } from "@/lib/prototype/rest-lines";
import type { RestMessage } from "@/lib/prototype/session";
import { seedContent } from "./support/seed-content";
import { seedLineLimits, seedPromptSource } from "./support/seed-prompts";

// #60 (US-AI-7): every rest reply is checked (words from after his date, facts from later in the
// Story, advice, length, questions; a later word the person typed is allowed, CHAT-USER-WORD),
// only the last six turns and at most 1000 characters of a message go to the model, and there is
// no message limit (R2). A reply that keeps failing ends in the failure screen (NO-BACKUP).

const seed = seedContent();
const STORY = "bohr-difficulties";
const checkReply = (text: string) =>
  checkCompanionLine(text, "rest_reply", [], seedLineLimits("rest_reply"));
const reply = (text: string) => JSON.stringify({ reply: text });

function recorder(text = "I keep to my desk.") {
  const call = vi.fn(async () => ({ source: "generated", text }));
  return { gateway: { writeRestReply: call } as unknown as ModelGateway, call };
}
const inputOf = (call: ReturnType<typeof vi.fn>) =>
  (call.mock.calls[0] as unknown[])[0] as RestReplyInput;

function scripted(answers: string[]) {
  const prompts: string[] = [];
  const gateway = createModelGateway({
    prompts: seedPromptSource(),
    timeLimitMs: 60_000,
    provider: async ({ prompt }) => {
      prompts.push(prompt);
      return answers[prompts.length - 1] ?? "no json";
    },
  });
  return { gateway, prompts };
}

describe("#60 AC1 every reply is checked", () => {
  it("test_60_ac1_words_from_after_his_date_reach_the_reply_check", async () => {
    const { gateway, call } = recorder();
    await restReplyFor(
      seed,
      { storyId: STORY, message: "hi", history: [], replyIndex: 0 },
      gateway,
    );
    expect(inputOf(call).forbidTerms).toEqual(
      expect.arrayContaining(["Los Alamos", "atomic bomb"]),
    );
  });

  it("test_60_ac1_facts_from_parts_not_reached_are_later_facts", () => {
    // Five parts and five Steps: on Step 1 only part 1 is reached.
    const first = laterStoryWords(seed, STORY, { stepIndex: 0, stepCount: 5 });
    expect(first.laterFacts).toEqual(
      expect.arrayContaining(["wave mechanics", "continuous spectrum", "rutherford's office"]),
    );
    expect(first.laterFacts).not.toContain("river cam");
    expect(first.laterFacts).not.toContain("great things");
    // On Step 4 parts 1 to 4 are reached; only part 5 is later.
    const fourth = laterStoryWords(seed, STORY, { stepIndex: 3, stepCount: 5 });
    expect(fourth.laterFacts).toContain("rutherford's office");
    expect(fourth.laterFacts).not.toContain("continuous spectrum");
    // On the last Step nothing in the Story is later.
    expect(laterStoryWords(seed, STORY, { stepIndex: 4, stepCount: 5 }).laterFacts).toEqual([]);
  });

  it("test_60_ac1_fewer_steps_than_parts_reach_whole_parts", () => {
    // Two Steps over five parts: Step 1 holds parts 1 to 3 (CARDS-SPREAD).
    const words = laterStoryWords(seed, STORY, { stepIndex: 0, stepCount: 2 });
    expect(words.laterFacts).not.toContain("wave mechanics");
    expect(words.laterFacts).toEqual(
      expect.arrayContaining(["continuous spectrum", "rutherford's office"]),
    );
  });

  it("test_60_ac1_i2b_single_lower_case_spoiler_words_are_left_out_of_the_chat_check", () => {
    const words = laterStoryWords(seed, STORY, { stepIndex: 0, stepCount: 5 }).laterFacts;
    for (const dropped of ["collision", "difficulties", "dirac", "beryllium"]) {
      expect(words, dropped).not.toContain(dropped);
    }
    expect(isChatLaterFact("hard work")).toBe(true);
    expect(isChatLaterFact("Los Alamos")).toBe(true);
    expect(isChatLaterFact("Kapitza")).toBe(true);
    expect(isChatLaterFact("anyway")).toBe(false);
    expect(isChatLaterFact("drizzl")).toBe(false);
  });

  it("test_60_ac1_without_a_position_only_the_first_part_is_reached", () => {
    expect(laterStoryWords(seed, STORY, undefined)).toEqual(
      laterStoryWords(seed, STORY, { stepIndex: 0, stepCount: 5 }),
    );
  });

  it("test_60_ac1_the_story_scene_later_words_are_later_facts", () => {
    expect(laterStoryWords(seed, STORY, { stepIndex: 4, stepCount: 5 }).laterWords).toEqual(
      expect.arrayContaining(["Kapitza Club"]),
    );
  });

  it("test_60_ac1_the_later_facts_of_this_step_reach_the_reply_check", async () => {
    const { gateway, call } = recorder();
    await restReplyFor(
      seed,
      { storyId: STORY, message: "hi", history: [], replyIndex: 0, stepIndex: 0, stepCount: 5 },
      gateway,
    );
    const input = inputOf(call);
    expect(input.laterFacts).toEqual(
      laterStoryWords(seed, STORY, { stepIndex: 0, stepCount: 5 }).laterFacts,
    );
    expect(input.laterWords).toEqual(expect.arrayContaining(["Kapitza Club"]));
  });

  it("test_60_ac1_a_reply_with_a_later_fact_is_generated_again", async () => {
    const bad = "I keep thinking about wave mechanics.";
    const good = "I keep thinking about the bench.";
    const { gateway, prompts } = scripted([reply(bad), reply(good)]);
    expect(
      await gateway.writeRestReply({
        facts: "f",
        userMessage: "hi",
        laterFacts: ["wave mechanics"],
      }),
    ).toEqual({ source: "generated", text: good });
    expect(prompts[1]).toMatch(/forbidden words/);
    // I-2a: the retry names the matched later fact, so the model can avoid it.
    expect(prompts[1]).toContain('Do not use these words: "wave mechanics".');
  });

  it("test_60_ac1_i2a_the_retry_names_every_matched_later_word", async () => {
    const bad = "I hear the Kapitza Club and talk of wave mechanics in Los Alamos.";
    const { gateway, prompts } = scripted([reply(bad), reply("I hear the rain.")]);
    await gateway.writeRestReply({
      facts: "f",
      userMessage: "hi",
      forbidTerms: ["Los Alamos"],
      laterFacts: ["wave mechanics"],
      laterWords: ["Kapitza Club"],
    });
    expect(prompts[1]).toContain(
      'Do not use these words: "Los Alamos", "wave mechanics", "Kapitza Club".',
    );
  });

  it("test_60_ac1_a_later_fact_matches_whole_words_only", async () => {
    const text = "I have my notes and my difficulty.";
    const { gateway } = scripted([reply(text)]);
    expect(
      await gateway.writeRestReply({ facts: "f", userMessage: "hi", laterFacts: ["difficulties"] }),
    ).toEqual({ source: "generated", text });
    expect(mentionsWord("Some Difficulties remain.", "difficulties")).toBe(true);
    expect(mentionsWord("No difficulty.", "difficulties")).toBe(false);
  });

  it("test_60_ac1_a_scene_later_word_fails_with_its_capitals", async () => {
    const bad = "I hear Kapitza laughing.";
    const good = "I hear a man laughing.";
    const { gateway, prompts } = scripted([reply(bad), reply(good)]);
    expect(
      await gateway.writeRestReply({ facts: "f", userMessage: "hi", laterWords: ["Kapitza"] }),
    ).toEqual({ source: "generated", text: good });
    expect(prompts).toHaveLength(2);
  });

  it("test_60_ac1_a_later_word_the_person_typed_is_allowed", async () => {
    const text = "I have never met a Kapitza or seen wave mechanics.";
    // The typed word counts with the same capitals (CHAT-USER-WORD, review I-1).
    const { gateway } = scripted([reply(text)]);
    expect(
      await gateway.writeRestReply({
        facts: "f",
        userMessage: "do you know Kapitza and wave mechanics",
        laterFacts: ["wave mechanics"],
        laterWords: ["Kapitza"],
        userTexts: ["do you know Kapitza and wave mechanics"],
      }),
    ).toEqual({ source: "generated", text });
  });

  it("test_60_ac1_advice_length_and_questions_are_checked_on_every_reply", () => {
    for (const [text, rule] of [
      ["I am tired too. You should sleep.", "cmd"],
      ["I sit. I write. I wait. I look up.", "len"],
      ["Is it late? Are you tired?", "question"],
    ] as const) {
      const checked = checkReply(text);
      expect(checked.ok, text).toBe(false);
      if (!checked.ok) expect(checked.rejectedRules, text).toContain(rule);
    }
  });

  it("test_60_ac1_a_reply_that_keeps_failing_ends_in_the_failure_screen", async () => {
    const bad = reply("I keep thinking about wave mechanics.");
    const { gateway } = scripted([bad, bad, bad]);
    expect(
      await restReplyFor(
        seed,
        { storyId: STORY, message: "hi", history: [], replyIndex: 0, stepIndex: 0, stepCount: 5 },
        gateway,
      ),
    ).toEqual({ status: "failed" });
  });
});

describe("#60 AC3 cost caps: the last six turns, 1000 characters a message", () => {
  const history: RestMessage[] = Array.from({ length: 10 }, (_, index) => ({
    from: index % 2 === 0 ? "him" : "you",
    text: `turn-${index}-marker`,
  }));

  it("test_60_ac3_only_the_last_six_turns_are_sent", async () => {
    const { gateway, call } = recorder();
    await restReplyFor(seed, { message: "now", history, replyIndex: 0 }, gateway);
    const facts = inputOf(call).facts;
    for (let index = 0; index < 4; index += 1) expect(facts).not.toContain(`turn-${index}-marker`);
    for (let index = 4; index < 10; index += 1) expect(facts).toContain(`turn-${index}-marker`);
  });

  it("test_60_ac3_a_message_over_1000_characters_is_shortened", async () => {
    const { gateway, call } = recorder();
    const long = "b".repeat(3_000);
    await restReplyFor(
      seed,
      { message: "a".repeat(3_000), history: [{ from: "you", text: long }], replyIndex: 0 },
      gateway,
    );
    const input = inputOf(call);
    expect(MAX_MESSAGE_CHARS).toBe(1_000);
    expect(input.userMessage).toHaveLength(1_000);
    expect(input.facts).toContain("b".repeat(1_000));
    expect(input.facts).not.toContain("b".repeat(1_001));
  });
});

describe("#60 AC4 no message limit and no hidden cap (R2)", () => {
  it("test_60_ac4_a_long_conversation_still_gets_a_reply", async () => {
    const history: RestMessage[] = Array.from({ length: 400 }, (_, index) => ({
      from: index % 2 === 0 ? "him" : "you",
      text: `line ${index}`,
    }));
    const request = normaliseRestRequest({ message: "still here", history, replyIndex: 199 });
    expect(request.history).toHaveLength(400);
    const { gateway, call } = recorder("I am still at my desk.");
    expect(await restReplyFor(seed, request, gateway)).toEqual({
      status: "ok",
      isTestData: false,
      text: "I am still at my desk.",
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("test_60_ac4_the_step_position_is_kept_in_bounds", () => {
    expect(normaliseRestRequest({ message: "m", stepIndex: 2, stepCount: 4 })).toMatchObject({
      stepIndex: 2,
      stepCount: 4,
    });
    for (const raw of [
      { stepIndex: 4, stepCount: 4 },
      { stepIndex: -1, stepCount: 4 },
      { stepIndex: 1.5, stepCount: 4 },
      { stepIndex: 0, stepCount: 0 },
      { stepIndex: "1", stepCount: 4 },
    ]) {
      const request = normaliseRestRequest({ message: "m", ...raw });
      expect(request.stepIndex, JSON.stringify(raw)).toBeUndefined();
      expect(request.stepCount, JSON.stringify(raw)).toBeUndefined();
    }
  });
});
