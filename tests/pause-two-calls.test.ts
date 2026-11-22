import { describe, expect, it } from "vitest";
import { createModelGateway, type GatewayLog, type ModelProvider } from "@/lib/model-gateway";
import { checkCompanionLine, PAUSE_MESSAGE_LIMITS } from "@/lib/model-gateway/checks";
import {
  eventVerbs,
  otherProps,
  unlistedObjects,
  unlistedPlaces,
  usesProp,
} from "@/lib/model-gateway/pause-checks";
import { PROMPT_KEYS } from "@/lib/prompts/repository";
import { PROMPT_PURPOSE } from "@/lib/prompts/admin";
import { promptRowProblems } from "@/lib/model-gateway";
import { seedPromptSource, seedRows } from "./support/seed-prompts";

// #56 (US-AI-3, PAUSE-TWO-CALLS): the pause message is two calls. Call one returns {prop, story};
// call two returns his words about the predicament and his feelings as plain text. Checks per
// AI_03 section A4; failures are generated again with the reason, then fail (NO-BACKUP).

const scene = {
  present: ["Kitty"],
  allowedWords: ["Kitty", "Haakon", "Berkeley"],
  props: ["martini glass", "shaker", "lamp", "notebook"],
  pauseProp: "shaker",
  laterWords: ["Mesa"],
};
const companionProps = ["telegram", "witness chair", "microphone", "shaker", "lamp"];
const good = {
  prop: "shaker",
  story: "The shaker lid has stuck fast, and his cold fingers slip on it.",
};

function provider(replies: string[]) {
  const calls: string[] = [];
  const impl: ModelProvider = async ({ prompt }) => {
    calls.push(prompt);
    return replies.shift() ?? "";
  };
  return { calls, impl };
}

function gatewayWith(replies: string[]) {
  const fake = provider(replies);
  const logs: GatewayLog[] = [];
  const gateway = createModelGateway({
    prompts: seedPromptSource(),
    provider: fake.impl,
    log: (event) => logs.push(event),
  });
  return { gateway, logs, calls: fake.calls };
}

const stuckInput = {
  pauseNumber: 1,
  facts: "He is at home in Berkeley.",
  category: "gear" as const,
  prop: "shaker",
  scene,
  people: ["Kitty", "Haakon", "Strauss"],
  companionProps,
};

describe("#56 AC1 two calls, two prompts", () => {
  it("test_56_ac1_both_prompts_are_seeded_and_listed_in_the_admin", () => {
    expect(PROMPT_KEYS).toContain("stuck_story");
    expect(PROMPT_KEYS).toContain("pause_predicament");
    expect(PROMPT_PURPOSE.pause_predicament).toMatch(/call two/i);
    const rows = seedRows();
    const stuck = rows.find((row) => row.key === "stuck_story")!;
    const predicament = rows.find((row) => row.key === "pause_predicament")!;
    expect(stuck.version).toBe(3);
    expect(predicament.version).toBe(1);
    expect(promptRowProblems(stuck)).toEqual([]);
    expect(promptRowProblems(predicament)).toEqual([]);
  });

  it("test_56_ac1_call_one_returns_prop_and_story", async () => {
    const { gateway, calls } = gatewayWith([JSON.stringify(good)]);
    const result = await gateway.writeStuckStory(stuckInput);
    expect(result).toEqual({ source: "generated", ...good });
    expect(calls[0]).toMatch(/^Return JSON only: \{"prop":"\.\.\.","story":"\.\.\."\}/);
    expect(calls[0]).toContain("Pause number: 1");
    expect(calls[0]).toContain("chosen for you: shaker");
    expect(calls[0]).toMatch(/Gear: /);
    expect(calls[0]).not.toMatch(/"why"|"back"/);
  });

  it("test_56_ac1_call_two_returns_plain_text_built_on_the_story_with_the_pause_number", async () => {
    const line = "My fingers will not work the shaker lid, and I feel foolish and slow tonight.";
    const { gateway, calls } = gatewayWith([line]);
    const result = await gateway.writePausePredicament({
      pauseNumber: 3,
      facts: "He is at home.",
      story: good.story,
      prop: "shaker",
      scene,
    });
    expect(result).toEqual({ source: "generated", text: line });
    expect(calls[0]).toMatch(/^Write plain text only/);
    expect(calls[0]).toContain(good.story);
    expect(calls[0]).toContain("Pause number: 3");
    expect(calls[0]).toMatch(/worried you may fail/);
  });

  it("test_56_ac1_call_two_answered_as_json_is_generated_again", async () => {
    const line = "I cannot get the lid off, and it makes me restless.";
    const { gateway, logs } = gatewayWith([JSON.stringify({ message: line }), line]);
    const result = await gateway.writePausePredicament({
      pauseNumber: 1,
      facts: "f",
      story: good.story,
    });
    expect(result).toEqual({ source: "generated", text: line });
    expect(logs.at(-1)?.rejectedRules).toEqual(["plain"]);
  });
});

describe("#56 AC3 the checks on call one", () => {
  async function rulesFor(answer: unknown, input = stuckInput) {
    const { gateway, logs } = gatewayWith([JSON.stringify(answer), JSON.stringify(good)]);
    const result = await gateway.writeStuckStory(input);
    expect(result).toEqual({ source: "generated", ...good });
    return logs.at(-1)?.rejectedRules ?? [];
  }

  it("test_56_ac3_a_prop_that_is_not_the_offered_one_fails", async () => {
    expect(
      await rulesFor({
        prop: "lamp",
        story: "The lamp flickers, and he cannot read his notebook.",
      }),
    ).toContain("prop");
  });

  it("test_56_ac3_a_story_that_does_not_use_the_offered_prop_fails", async () => {
    expect(
      await rulesFor({
        prop: "shaker",
        story: "His cold fingers will not hold the pencil steady.",
      }),
    ).toContain("prop");
  });

  it("test_56_ac2_the_story_uses_only_the_offered_prop", async () => {
    expect(
      await rulesFor({
        prop: "shaker",
        story: "The shaker sticks, and the lamp is too dim to see it.",
      }),
    ).toContain("prop");
    expect(
      otherProps("The martini glass and the shaker.", "martini glass", ["martini glass", "glass"]),
    ).toEqual([]);
    expect(otherProps("His car door sticks.", "car door", ["car", "car door"])).toEqual([]);
    expect(
      otherProps("His car door sticks by the car.", "car door", ["car", "car door", "map"]),
    ).toEqual([]);
    expect(otherProps("His map flaps against the car.", "map", ["car", "car door", "map"])).toEqual(
      ["car"],
    );
  });

  it("test_56_ac3_an_object_outside_the_scene_table_fails", async () => {
    expect(
      await rulesFor({ prop: "shaker", story: "A telegram lies beside the shaker, and he stops." }),
    ).toContain("object");
    expect(unlistedObjects("He sets the shaker by the microphone.", scene, companionProps)).toEqual(
      ["microphone"],
    );
    expect(unlistedObjects("The martini glasses and the shaker sit still.", scene, [])).toEqual([]);
  });

  it("test_56_ac3_an_event_verb_fails", async () => {
    for (const story of [
      "Kitty arrives as the shaker lid sticks.",
      "He finds the shaker lid stuck fast.",
      "He decides the shaker can wait.",
      "Kitty says the shaker lid is stuck.",
      "He loses his grip on the shaker.",
    ]) {
      expect(await rulesFor({ prop: "shaker", story }), story).toContain("event");
    }
    expect(eventVerbs("The shaker lid is stuck, and his hands are cold.")).toEqual([]);
  });

  it("test_56_ac3_a_new_person_fails_with_the_374_person_check", async () => {
    expect(
      await rulesFor({ prop: "shaker", story: "Strauss watches him fight the shaker lid." }),
    ).toContain("people");
  });

  it("test_56_ac3_a_new_place_fails", async () => {
    expect(
      await rulesFor({
        prop: "shaker",
        story: "His mind drifts to Chicago while the shaker sticks.",
      }),
    ).toContain("place");
    expect(unlistedPlaces("He thinks of the hall in Berkeley.", scene)).toEqual([]);
  });

  it("test_56_ac3_a_later_fact_fails_whole_word_and_case_sensitive", async () => {
    expect(
      await rulesFor({ prop: "shaker", story: "He thinks of the Mesa while the shaker sticks." }),
    ).toContain("leak");
    const { gateway } = gatewayWith([
      JSON.stringify({ prop: "shaker", story: "The shaker sticks on the mesa of the table." }),
    ]);
    expect((await gateway.writeStuckStory(stuckInput)).source).toBe("generated");
  });

  it("test_56_ac3_a_near_repeat_of_an_earlier_snag_fails", async () => {
    const fresh = {
      prop: "shaker",
      story: "The shaker rattles so loudly that his thought keeps slipping away.",
    };
    const { gateway, logs } = gatewayWith([JSON.stringify(good), JSON.stringify(fresh)]);
    const result = await gateway.writeStuckStory({
      ...stuckInput,
      earlierStories: ["The shaker lid has stuck fast and his fingers slip on it."],
    });
    expect(result).toEqual({ source: "generated", ...fresh });
    expect(logs.at(-1)?.rejectedRules).toContain("similar");
  });

  it("test_56_ac3_the_prop_may_appear_in_the_last_card_without_failing_card_nouns", async () => {
    const { gateway } = gatewayWith([JSON.stringify(good)]);
    const result = await gateway.writeStuckStory({
      ...stuckInput,
      lastCard: "I set the shaker on the shelf.",
    });
    expect(result.source).toBe("generated");
  });

  it("test_56_ac3_a_prop_with_several_words_counts_in_the_plural_too", () => {
    expect(usesProp("The martini glasses rattle.", "martini glass")).toBe(true);
    expect(usesProp("A glass rattles.", "martini glass")).toBe(false);
  });
});

describe("#56 AC3 LEN-PAUSE: the final message is at most 30 words", () => {
  const long =
    "I have been turning the shaker lid for a long while now and it will not move at all, and my hands are cold, and I feel slow and foolish tonight.";

  it("test_56_ac3_a_final_message_over_30_words_fails", async () => {
    expect(long.split(/\s+/).length).toBeGreaterThan(30);
    const ok = "The shaker lid will not turn, and I feel slow and foolish.";
    const { gateway, logs } = gatewayWith([long, ok]);
    const result = await gateway.writePausePredicament({ pauseNumber: 1, facts: "f", story: "s." });
    expect(result).toEqual({ source: "generated", text: ok });
    expect(logs.at(-1)?.rejectedRules).toContain("len");
  });

  it("test_56_ac3_a_prompt_row_cannot_lengthen_the_pause_message", () => {
    expect(PAUSE_MESSAGE_LIMITS).toEqual({ max_sentences: 2, max_words: 30 });
    const loose = { max_words: 200, max_sentences: 9 };
    expect(checkCompanionLine(long, "pause_message", [], loose)).toMatchObject({ ok: false });
    const three = "I sit. I wait. I stare at the shaker.";
    expect(checkCompanionLine(three, "pause_message", [], loose)).toMatchObject({ ok: false });
  });

  it("test_56_ac3_the_stuck_story_is_third_person_and_the_message_first_person", () => {
    const limits = { max_words: 30, max_sentences: 2 };
    expect(checkCompanionLine(good.story, "stuck_story", [], limits).ok).toBe(true);
    expect(checkCompanionLine(good.story, "pause_message", [], limits)).toMatchObject({
      ok: false,
      rejectedRules: ["first_person"],
    });
  });
});

describe("#56 AC4 a failing answer is retried with the reason, then fails with no stored text", () => {
  it("test_56_ac4_retried_once_with_the_reason_then_generated_again_then_the_failure", async () => {
    const bad = JSON.stringify({ prop: "shaker", story: "Kitty arrives with a telegram." });
    const { gateway, calls, logs } = gatewayWith([bad, bad, bad, bad]);
    const result = await gateway.writeStuckStory(stuckInput);
    expect(result).toEqual({ source: "failed", reason: "checks" });
    expect(calls).toHaveLength(3);
    expect(calls[1]).toContain("The last answer was rejected.");
    expect(calls[1]).toMatch(/Nothing may happen in his story/);
    expect(calls[1]).toMatch(/Name no object other than the objects listed/);
    expect(logs.at(-1)).toMatchObject({ call: "stuck_story", source: "failed" });
  });

  it("test_56_ac4_call_two_fails_the_same_way_with_no_stored_text", async () => {
    const { gateway, calls } = gatewayWith(["You should stop pausing!", "", "Later!"]);
    const result = await gateway.writePausePredicament({ pauseNumber: 1, facts: "f", story: "s." });
    expect(result).toEqual({ source: "failed", reason: "checks" });
    expect(calls).toHaveLength(3);
  });
});
