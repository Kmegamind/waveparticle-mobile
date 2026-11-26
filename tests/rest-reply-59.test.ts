import { describe, expect, it, vi } from "vitest";
import { createModelGateway, type ModelGateway } from "@/lib/model-gateway";
import { allowUserWords, BANNED, checkCompanionLine } from "@/lib/model-gateway/checks";
import type { RestReplyInput } from "@/lib/model-gateway/types";
import { accountRestReply } from "@/lib/progress/account-lines";
import { generationInputs } from "@/lib/prototype/story-inputs";
import { restReplyFor } from "@/lib/prototype/rest-lines";
import { seedContent } from "./support/seed-content";
import { seedLineLimits, seedPromptSource } from "./support/seed-prompts";
import { OPPENHEIMER } from "./support/companion";

// #59 (US-AI-6): his reply in the rest conversation. No label on the reply (CHAT-NO-LABEL); the
// feelings rule and "end on his own situation" are in the prompt; a later word the person typed
// may be repeated (CHAT-USER-WORD); a crisis message gets no reply (US-SAF-2); the conversation
// never mentions that he is an AI (A4).

const seed = seedContent();
const checkReply = (text: string, forbidTerms: string[] = []) =>
  checkCompanionLine(text, "rest_reply", forbidTerms, seedLineLimits("rest_reply"), OPPENHEIMER);

/** The rest prompt the gateway sends, from the seed file. */
async function restPrompt(input: Partial<RestReplyInput> = {}): Promise<string> {
  const prompts: string[] = [];
  const gateway = createModelGateway({
    prompts: seedPromptSource(),
    provider: async ({ prompt }) => {
      prompts.push(prompt);
      return JSON.stringify({ reply: "I keep my notes dry under my coat." });
    },
  });
  await gateway.writeRestReply({
    companionName: OPPENHEIMER,
    facts: "He is at a table.",
    userMessage: "hello",
    ...input,
  });
  return prompts[0] ?? "";
}

/** A gateway that answers each attempt in turn and records the prompts. */
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

const reply = (text: string) => JSON.stringify({ reply: text });

describe("#59 AC1 one to three sentences in his voice, from his own situation", () => {
  it("test_59_ac1_the_prompt_asks_for_one_to_three_sentences_from_his_own_situation", async () => {
    const prompt = await restPrompt();
    expect(prompt).toMatch(/one to three first-person sentences/i);
    expect(prompt).toMatch(/his own situation/i);
    expect(prompt).toMatch(/could plausibly know in his time/i);
  });

  it("test_59_ac1_he_may_answer_a_question_about_the_work_or_the_world", async () => {
    const prompt = await restPrompt();
    expect(prompt).toMatch(/does not have to refuse/i);
  });

  it("test_59_ac1_the_prompt_says_to_end_by_returning_to_his_own_situation", async () => {
    expect(await restPrompt()).toMatch(/end by returning to his own situation/i);
  });

  it("test_59_ac1_a_reply_of_four_sentences_is_generated_again", async () => {
    const long = "I sit. I write. I wait. I look at the wall.";
    const short = "I sit at my desk and write.";
    const { gateway, prompts } = scripted([reply(long), reply(short)]);
    const result = await gateway.writeRestReply({
      companionName: OPPENHEIMER,
      facts: "f",
      userMessage: "hi",
    });
    expect(result).toEqual({ source: "generated", text: short });
    expect(prompts).toHaveLength(2);
  });
});

describe("#59 AC2 no label on the reply (CHAT-NO-LABEL)", () => {
  it("test_59_ac2_the_prompt_asks_for_the_reply_only_with_no_label", async () => {
    const prompt = await restPrompt();
    expect(prompt).toContain('Return JSON only: {"reply":"..."}');
    expect(prompt).not.toMatch(/scope|label|his_world|emotional/i);
  });

  it("test_59_ac2_a_label_returned_anyway_never_reaches_the_page", async () => {
    const { gateway } = scripted([
      JSON.stringify({ scope: "emotional", reply: "I sit with my own work." }),
    ]);
    expect(
      await gateway.writeRestReply({ companionName: OPPENHEIMER, facts: "f", userMessage: "hi" }),
    ).toEqual({
      source: "generated",
      text: "I sit with my own work.",
    });
  });
});

describe("#59 AC3 how the person feels: one line of his own, no advice", () => {
  it("test_59_ac3_the_feelings_rule_is_written_in_the_prompt", async () => {
    const prompt = await restPrompt();
    expect(prompt).toMatch(/how they feel/i);
    expect(prompt).toMatch(/one line of his own of similar weight/i);
    expect(prompt).toMatch(/no advice, no method and no promise that it will pass/i);
  });

  it("test_59_ac3_advice_or_a_promise_that_it_will_pass_is_rejected", () => {
    for (const text of [
      "I am tired too. You could rest a little.",
      "I know that weight. It will pass.",
      "I am tired too. Don't worry about it.",
      "Have you tried sleeping? I have not slept either.",
      "I feel it too. You need to rest.",
    ]) {
      const checked = checkReply(text);
      expect(checked.ok, text).toBe(false);
      if (!checked.ok) expect(checked.rejectedRules, text).toContain("cmd");
    }
  });

  it("test_59_ac3_his_own_lines_and_plain_empathy_are_not_advice", () => {
    for (const text of [
      "I don't worry about the rain.",
      "You must be tired. I am tired as well.",
      "I wish you could see the mesa.",
    ]) {
      expect(checkReply(text), text).toEqual({ ok: true, text });
    }
  });

  it("test_59_ac3_a_plain_line_of_his_own_passes", () => {
    const text = "I am tired as well. My hand aches from the pencil.";
    expect(checkReply(text)).toEqual({ ok: true, text });
  });
});

describe("#59 AC4 no fact from after his date; a later word the person typed may be repeated", () => {
  const later = generationInputs(seed, "bohr-difficulties").forbidTerms;

  it("test_59_ac4_the_rest_reply_gets_the_story_words_from_after_his_date", async () => {
    const call = vi.fn(async () => ({ source: "generated", text: "I do not know." }));
    const gateway = { writeRestReply: call } as unknown as ModelGateway;
    await restReplyFor(
      seed,
      { storyId: "bohr-difficulties", message: "hi", history: [], replyIndex: 0 },
      gateway,
    );
    const input = (call.mock.calls[0] as unknown[])[0] as RestReplyInput;
    expect(later).toContain("Los Alamos");
    expect(input.forbidTerms).toEqual(expect.arrayContaining(later));
  });

  it("test_59_ac4_a_reply_with_a_word_from_after_his_date_is_generated_again", async () => {
    const bad = "I have never been to Los Alamos.";
    const good = "I have never been west of Chicago.";
    const { gateway, prompts } = scripted([reply(bad), reply(good)]);
    const result = await gateway.writeRestReply({
      companionName: OPPENHEIMER,
      facts: "f",
      userMessage: "have you been to new mexico",
      forbidTerms: ["Los Alamos"],
    });
    expect(result).toEqual({ source: "generated", text: good });
    expect(prompts[1]).toMatch(/forbidden words/);
  });

  it("test_59_ac4_a_later_word_the_person_typed_may_be_repeated", async () => {
    const text = "I have never heard of a computer.";
    const { gateway } = scripted([reply(text)]);
    expect(
      await gateway.writeRestReply({
        companionName: OPPENHEIMER,
        facts: "f",
        userMessage: "do you use a computer",
        forbidTerms: ["computer"],
        userTexts: ["do you use a computer"],
      }),
    ).toEqual({ source: "generated", text });
  });

  it("test_59_ac4_a_later_word_typed_earlier_in_the_chat_may_be_repeated", async () => {
    const call = vi.fn(async () => ({ source: "generated", text: "I do not know it." }));
    const gateway = { writeRestReply: call } as unknown as ModelGateway;
    await restReplyFor(
      seed,
      {
        storyId: "bohr-difficulties",
        message: "and now?",
        history: [
          { from: "you", text: "Ever been to Los Alamos?" },
          { from: "him", text: "I do not know the place." },
        ],
        replyIndex: 0,
      },
      gateway,
    );
    const input = (call.mock.calls[0] as unknown[])[0] as RestReplyInput;
    expect(input.userTexts).toEqual(["Ever been to Los Alamos?", "and now?"]);
  });

  it("test_59_ac4_only_the_words_the_person_typed_are_let_through", () => {
    expect(
      allowUserWords(
        ["Los Alamos", "atomic bomb", "computer"],
        ["what is a computer", "Los Alamos?"],
      ),
    ).toEqual(["atomic bomb"]);
    expect(allowUserWords(["Los Alamos"], [])).toEqual(["Los Alamos"]);
  });

  it("test_59_ac4_i1_a_typed_word_counts_only_as_whole_words_with_its_capitals", () => {
    // Parts of words never let a later word through (review I-1).
    expect(allowUserWords(["pion"], ["In my opinion it is late"])).toEqual(["pion"]);
    expect(allowUserWords(["May"], ["maybe tomorrow"])).toEqual(["May"]);
    expect(allowUserWords(["Los"], ["I feel lost"])).toEqual(["Los"]);
    expect(allowUserWords(["New"], ["any news?"])).toEqual(["New"]);
    // A real later word the person typed is still allowed.
    expect(allowUserWords(["Los Alamos", "pion"], ["What about Los Alamos?"])).toEqual(["pion"]);
  });

  it("test_59_ac4_i1_a_later_word_inside_another_word_does_not_fail_the_reply", async () => {
    const text = "In my opinion the bench is a poor place.";
    const { gateway } = scripted([reply(text)]);
    expect(
      await gateway.writeRestReply({
        companionName: OPPENHEIMER,
        facts: "f",
        userMessage: "hi",
        forbidTerms: ["pion"],
      }),
    ).toEqual({ source: "generated", text });
  });

  it("test_59_ac4_the_prompt_allows_repeating_a_word_the_person_typed", async () => {
    const prompt = await restPrompt();
    expect(prompt).toMatch(/no fact from after his own time/i);
    expect(prompt).toMatch(/later word the person typed/i);
  });
});

describe("#59 AC5 at most one question; each reply ends on his own situation", () => {
  it("test_59_ac5_two_questions_are_rejected", () => {
    const checked = checkReply("Is it late? Are you tired?");
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.rejectedRules).toContain("question");
  });

  it("test_59_ac5_the_prompt_allows_at_most_one_question_and_ends_on_his_situation", async () => {
    const prompt = await restPrompt();
    expect(prompt).toMatch(/at most one question/i);
    expect(prompt).toMatch(/end by returning to his own situation/i);
  });
});

describe("#59 AC6 a crisis message gets no generated or shown reply (US-SAF-2)", () => {
  it("test_59_ac6_a_crisis_message_is_never_sent_to_the_model", async () => {
    const call = vi.fn();
    const gateway = { writeRestReply: call } as unknown as ModelGateway;
    const message = "I want to kill myself";
    expect(await restReplyFor(seed, { message, history: [], replyIndex: 0 }, gateway)).toEqual({
      status: "crisis",
    });
    expect(await accountRestReply(seed, { message, history: [] }, gateway)).toEqual({
      status: "crisis",
    });
    expect(call).not.toHaveBeenCalled();
  });
});

describe("#59 AC7 the conversation never mentions that he is an AI (A4)", () => {
  it("test_59_ac7_a_reply_that_mentions_ai_is_rejected", () => {
    for (const text of [
      "I am an AI and I cannot know.",
      "As an AI, I keep to my desk.",
      "I am only a language model at my desk.",
      "I am an artificial intelligence, I suppose.",
      "I am a chatbot in a quiet room.",
    ]) {
      const checked = checkReply(text);
      expect(checked.ok, text).toBe(false);
      if (!checked.ok) expect(checked.rejectedRules, text).toContain("ban");
    }
  });

  it("test_59_ac7_the_ai_words_apply_to_live_lines_only_not_premade_cards", () => {
    const pause = checkCompanionLine(
      "I am an AI at my desk.",
      "stuck_story",
      [],
      seedLineLimits("stuck_story"),
      OPPENHEIMER,
    );
    expect(pause.ok).toBe(false);
    const card = "I read about AI in no paper at all.";
    expect(
      checkCompanionLine(card, "step_card", [], seedLineLimits("step_card"), OPPENHEIMER).ok,
    ).toBe(true);
    expect(BANNED.test("I am an AI.")).toBe(false);
  });

  it("test_59_ac7_the_prompt_says_he_never_says_he_is_an_ai", async () => {
    expect(await restPrompt()).toMatch(/never says or hints that he is an AI/i);
  });

  it("test_59_ac7_ai_is_not_let_through_even_when_the_person_typed_it", async () => {
    const { gateway } = scripted([
      reply("I am not an AI."),
      reply("I am not an AI."),
      reply("I am not an AI."),
    ]);
    expect(
      await gateway.writeRestReply({
        companionName: OPPENHEIMER,
        facts: "f",
        userMessage: "are you an AI",
        userTexts: ["are you an AI"],
      }),
    ).toMatchObject({ source: "failed" });
  });
});

describe("#59 NO-BACKUP a failed reply is generated again, then fails with no text", () => {
  it("test_59_nobackup_a_reply_that_keeps_failing_ends_in_the_failure_screen", async () => {
    const { gateway, prompts } = scripted([
      reply("You should rest."),
      reply("You should rest."),
      reply("You should rest."),
    ]);
    const result = await gateway.writeRestReply({
      companionName: OPPENHEIMER,
      facts: "f",
      userMessage: "hi",
    });
    expect(result).toEqual({ source: "failed", reason: "checks" });
    expect(prompts.length).toBeGreaterThan(1);
    const page = await restReplyFor(
      seed,
      { message: "hi", history: [], replyIndex: 0 },
      gateway as ModelGateway,
    );
    expect(page).toEqual({ status: "failed" });
  });
});
