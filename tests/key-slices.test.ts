import { describe, expect, it } from "vitest";

import type { OppenheimerStory } from "../src/lib/content/types";
import { seedStoryRecords } from "./support/seed-content";

const oppenheimerStories = seedStoryRecords();
import { startStory } from "../src/lib/story/start";

const FUTURE = /\b(will|won't|going to)\b|'ll/i;
const PRESENT = /\b(have|has|am|is|are|do|does)\b|'(ve|m|re)\b/i;
const PAST =
  /\b(\w+ed|told|said|heard|met|sat|found|read|gave|stood|made|left|came|went|saw|knew|thought|kept|held|led|brought|took|got|spoke|wrote|chose|ran|rose|felt|put|set|began|meant|was|were|had|did)\b/i;

function keyLineFailure(line: string): string | null {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (!/^[A-Z][^!?]*\.$/.test(line) || line.includes("...")) {
    return "not one sentence";
  }
  if (words.length > 18) {
    return "longer than 18 words";
  }
  if (!/\bI\b/.test(line) && !/\b(my|me|mine)\b/i.test(line)) {
    return "not first person";
  }
  if (FUTURE.test(line) || PRESENT.test(line) || !PAST.test(line)) {
    return "not past tense";
  }
  return null;
}

function eightSliceStory(): OppenheimerStory {
  const ids = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
  return {
    id: "cut-example",
    sequence: 8,
    title: "Cut example",
    date: "1942-11-16",
    goal: "Find the place.",
    facts: ids.map((id) => ({ id, taskId: id, text: `Fact ${id}.` })),
    forbiddenTerms: ["Hiroshima"],
    keySlices: [
      {
        id: "s8",
        factIds: ["s8"],
        keyLine: "I reached the last ridge.",
        confirmed: true,
      },
      {
        id: "s4",
        factIds: ["s4"],
        keyLine: "I heard that the canyon would never do.",
        confirmed: true,
      },
      {
        id: "s6",
        factIds: ["s6"],
        keyLine: "I named the mesa and the boys' school.",
        confirmed: true,
      },
    ],
    provenance: { entry: "example", sequence: "example", keySlices: "example" },
  };
}

function trailingStory(): OppenheimerStory {
  const ids = ["a", "b", "c", "d", "e"];
  return {
    id: "trailing",
    sequence: 1,
    title: "Trailing",
    date: "1926-05-01",
    goal: "Finish the talk.",
    facts: ids.map((id) => ({ id, taskId: id, text: `Fact ${id}.` })),
    forbiddenTerms: ["later"],
    keySlices: [
      {
        id: "late",
        factIds: ["c"],
        keyLine: "I finished the hard part.",
        confirmed: true,
      },
      {
        id: "early",
        factIds: ["a", "b"],
        keyLine: "I started the climb.",
        confirmed: true,
      },
    ],
    provenance: { entry: "example", sequence: "example", keySlices: "example" },
  };
}

describe("US-CON-2 key slices", () => {
  it("test_us_con_2_ac1_key_line_is_one_past_tense_sentence", () => {
    const failures = oppenheimerStories.flatMap((story) =>
      story.keySlices.map((keySlice) => ({
        id: `${story.id}.${keySlice.id}`,
        failure: keyLineFailure(keySlice.keyLine),
      })),
    );

    expect(failures.filter((item) => item.failure)).toEqual([]);
  });

  it("test_us_con_2_ac2_start_gives_the_whole_story_and_must_use_key_slices", () => {
    const story = eightSliceStory();
    const started = startStory(story, [{ minutes: 10 }, { minutes: 20 }, { minutes: 30 }]);

    expect(started.storyId).toBe("cut-example");
    expect(started.stepCount).toBe(3);
    expect(started.facts.map((fact) => fact.id)).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "s7",
      "s8",
    ]);
    expect(started.mustUseKeySlices.map((keySlice) => keySlice.id)).toEqual(["s4", "s6", "s8"]);
    expect(started.steps.map((step) => step.minutes)).toEqual([10, 20, 30]);
    expect(started.instruction).toContain("divided into 3 steps");
    expect(started.instruction).toContain("According to the story's progress");
    expect(started.instruction).toContain("n story cards");
    expect(started.instruction).toContain("must use");
    for (const fact of story.facts) {
      expect(started.instruction).toContain(fact.id);
      expect(started.instruction).toContain(fact.text);
    }
    for (const keySlice of story.keySlices) {
      expect(started.instruction).toContain(keySlice.id);
      expect(started.instruction).toContain(keySlice.keyLine);
    }
    expect(started.instruction).toContain("10");
    expect(started.instruction).toContain("20");
    expect(started.instruction).toContain("30");
  });

  it("test_us_con_2_ac3_key_slice_ends_a_step_when_the_step_count_allows", () => {
    const story = eightSliceStory();

    expect(startStory(story, [{ minutes: 15 }, { minutes: 15 }, { minutes: 15 }]).steps).toEqual([
      {
        index: 1,
        minutes: 15,
        factIds: ["s1", "s2", "s3", "s4"],
        endingKeySliceId: "s4",
        mustUseKeySliceIds: ["s4"],
        continuesTo: "next-step",
      },
      {
        index: 2,
        minutes: 15,
        factIds: ["s5", "s6"],
        endingKeySliceId: "s6",
        mustUseKeySliceIds: ["s6"],
        continuesTo: "next-step",
      },
      {
        index: 3,
        minutes: 15,
        factIds: ["s7", "s8"],
        endingKeySliceId: "s8",
        mustUseKeySliceIds: ["s8"],
        continuesTo: "summary",
      },
    ]);

    expect(
      startStory(story, [
        { minutes: 10 },
        { minutes: 10 },
        { minutes: 10 },
        { minutes: 10 },
      ]).steps.map((step) => ({
        factIds: step.factIds,
        endingKeySliceId: step.endingKeySliceId,
      })),
    ).toEqual([
      { factIds: ["s1", "s2"], endingKeySliceId: null },
      { factIds: ["s3", "s4"], endingKeySliceId: "s4" },
      { factIds: ["s5", "s6"], endingKeySliceId: "s6" },
      { factIds: ["s7", "s8"], endingKeySliceId: "s8" },
    ]);

    expect(
      startStory(story, [
        { minutes: 5 },
        { minutes: 5 },
        { minutes: 5 },
        { minutes: 5 },
        { minutes: 5 },
      ]).steps.map((step) => ({
        factIds: step.factIds,
        endingKeySliceId: step.endingKeySliceId,
      })),
    ).toEqual([
      { factIds: ["s1", "s2"], endingKeySliceId: null },
      { factIds: ["s3"], endingKeySliceId: null },
      { factIds: ["s4"], endingKeySliceId: "s4" },
      { factIds: ["s5", "s6"], endingKeySliceId: "s6" },
      { factIds: ["s7", "s8"], endingKeySliceId: "s8" },
    ]);
  });

  it("test_us_con_2_ac4_fewer_steps_merge_later_key_slices_into_the_last_step", () => {
    const started = startStory(eightSliceStory(), [{ minutes: 20 }, { minutes: 20 }]);

    expect(started.steps.map((step) => step.factIds)).toEqual([
      ["s1", "s2", "s3", "s4"],
      ["s5", "s6", "s7", "s8"],
    ]);
    expect(started.steps[0]?.endingKeySliceId).toBe("s4");
    expect(started.steps[1]?.mustUseKeySliceIds).toEqual(["s6", "s8"]);
    expect(started.mergedKeyMoments).toEqual([
      { id: "s6", keyLine: "I named the mesa and the boys' school." },
      { id: "s8", keyLine: "I reached the last ridge." },
    ]);
    expect(started.instruction).toContain("I named the mesa and the boys' school.");
    expect(started.instruction).toContain("I reached the last ridge.");
  });

  it("test_no_merged_moments_the_instruction_does_not_ask_for_a_summary_list", () => {
    // NO-MERGED-MOMENTS (2026-11-18): the summary no longer lists merged key moments.
    const started = startStory(eightSliceStory(), [{ minutes: 20 }, { minutes: 20 }]);
    expect(started.mergedKeyMoments).toHaveLength(2);
    expect(started.instruction).not.toMatch(/summary lists|merged key moment/i);
  });

  it("test_us_con_2_ac5_one_step_goes_straight_to_the_summary", () => {
    const started = startStory(eightSliceStory(), [{ minutes: 45 }]);

    expect(started.hasNextStepCards).toBe(false);
    expect(started.steps).toHaveLength(1);
    expect(started.steps[0]?.continuesTo).toBe("summary");
    expect(started.steps.every((step) => step.continuesTo !== "next-step")).toBe(true);
    expect(started.mergedKeyMoments.map((moment) => moment.id)).toEqual(["s4", "s6", "s8"]);
    expect(started.mergedKeyMoments.map((moment) => moment.keyLine)).toEqual([
      "I heard that the canyon would never do.",
      "I named the mesa and the boys' school.",
      "I reached the last ridge.",
    ]);
  });

  it("test_us_con_2_ac6_step_count_follows_the_plan_not_the_slices", () => {
    const story = oppenheimerStories.find((item) => item.id === "bohr-difficulties");
    expect(story).toBeDefined();
    if (!story) {
      return;
    }

    expect(startStory(story, [{ minutes: 30 }]).stepCount).toBe(1);
    expect(startStory(story, [{ minutes: 15 }, { minutes: 15 }]).stepCount).toBe(2);
    expect(
      startStory(
        story,
        Array.from({ length: 9 }, () => ({ minutes: 10 })),
      ).stepCount,
    ).toBe(9);

    const twoSteps = startStory(story, [{ minutes: 20 }, { minutes: 25 }]);
    expect(twoSteps.steps[0]).toMatchObject({
      minutes: 20,
      endingKeySliceId: "quit_the_films",
      factIds: [
        "quit_the_films.happened-1",
        "quit_the_films.happened-2",
        "quit_the_films.happened-3",
      ],
      continuesTo: "next-step",
    });
    expect(twoSteps.steps[1]?.factIds[0]).toBe("match_the_two_theories.happened-1");
    expect(twoSteps.steps[1]?.factIds.at(-1)).toBe("answer_bohr.happened-4");
    expect(twoSteps.steps[1]?.endingKeySliceId).toBe("answer_bohr");
    expect(twoSteps.steps[1]?.minutes).toBe(25);
    expect(twoSteps.mergedKeyMoments).toEqual([]);
  });

  it("keeps facts that follow the last key slice in the last step until a spare step exists", () => {
    const story = trailingStory();

    expect(
      startStory(story, [{ minutes: 10 }, { minutes: 10 }]).steps.map((step) => ({
        factIds: step.factIds,
        endingKeySliceId: step.endingKeySliceId,
      })),
    ).toEqual([
      { factIds: ["a", "b"], endingKeySliceId: "early" },
      { factIds: ["c", "d", "e"], endingKeySliceId: null },
    ]);

    expect(
      startStory(story, [{ minutes: 10 }, { minutes: 10 }, { minutes: 10 }]).steps.map((step) => ({
        factIds: step.factIds,
        endingKeySliceId: step.endingKeySliceId,
        continuesTo: step.continuesTo,
      })),
    ).toEqual([
      { factIds: ["a", "b"], endingKeySliceId: "early", continuesTo: "next-step" },
      { factIds: ["c"], endingKeySliceId: "late", continuesTo: "next-step" },
      { factIds: ["d", "e"], endingKeySliceId: null, continuesTo: "summary" },
    ]);
  });
});
