import { describe, expect, it } from "vitest";
import {
  FIELD_LIMITS,
  fieldProblems,
  parseFieldKey,
  periodChoices,
  periodsOf,
} from "@/lib/content-fields/fields";

// #309: the rules of the Companion and story fields the admin edits (ADM-03 to ADM-05).

/** Stories s1 to s5: s1 alone in "Youth", s2 to s4 in "Berkeley", s5 alone in "War". */
const stories = [
  { id: "s1", sequence: 1, period: "Youth" },
  { id: "s2", sequence: 2, period: "Berkeley" },
  { id: "s3", sequence: 3, period: "Berkeley" },
  { id: "s4", sequence: 4, period: "Berkeley" },
  { id: "s5", sequence: 5, period: "War" },
];

const story = (storyId: string, field: string) => parseFieldKey(`opp.${storyId}.${field}`)!;

describe("content fields (#309)", () => {
  it("test_309_field_keys_name_the_companion_or_story_and_the_field", () => {
    expect(parseFieldKey("chr.opp.name")).toEqual({
      item: "companion",
      code: "opp",
      field: "name",
    });
    expect(parseFieldKey("chr.opp.period.2")).toEqual({
      item: "companion",
      code: "opp",
      field: "period",
      period: 2,
    });
    expect(parseFieldKey("opp.trinity.goal")).toEqual({
      item: "story",
      code: "opp",
      storyId: "trinity",
      field: "goal",
    });
    for (const bad of ["chr.opp.line", "chr.opp.period.0", "opp.trinity.facts", "ui.F3.x", ""]) {
      expect(parseFieldKey(bad), bad).toBeNull();
    }
  });

  it("test_309_period_numbers_follow_story_order", () => {
    expect(periodsOf([...stories].reverse())).toEqual([
      { number: 1, name: "Youth", storyIds: ["s1"] },
      { number: 2, name: "Berkeley", storyIds: ["s2", "s3", "s4"] },
      { number: 3, name: "War", storyIds: ["s5"] },
    ]);
  });

  it("test_309_ac2_blank_long_and_dated_text_is_refused", () => {
    const title = story("s3", "title");
    expect(fieldProblems(title, "  ", { stories })).toEqual([
      "Write a text first. An empty field is not saved.",
    ]);
    expect(fieldProblems(title, "x".repeat(FIELD_LIMITS.title + 1), { stories })).toEqual([
      `Keep it to ${FIELD_LIMITS.title} characters or fewer.`,
    ]);
    expect(fieldProblems(title, "The summer of 1943", { stories })).toEqual([
      'Mentions a year ("1943"). Years and dates stay in the admin.',
    ]);
    expect(fieldProblems(story("s3", "who"), "I am 38 years old.", { stories })).toEqual([
      'Mentions an age ("38 years old"). Ages stay in the admin.',
    ]);
    expect(fieldProblems(story("s3", "path"), "On May 3 I leave.", { stories })).toEqual([
      'Mentions a date ("May 3"). Years and dates stay in the admin.',
    ]);
    const period = parseFieldKey("chr.opp.period.1")!;
    expect(fieldProblems(period, "When I was {age}", { stories })).toEqual([
      "Mentions an age ({age}). Ages stay in the admin.",
    ]);
    expect(fieldProblems(title, "The Trade of a Theorist", { stories })).toEqual([]);
  });

  it("test_309_ac2_the_opening_ends_with_the_question", () => {
    const opening = story("s3", "opening");
    expect(fieldProblems(opening, "I am at the lab.", { stories })).toEqual([
      'End the opening with "What are you working on?"',
    ]);
    expect(
      fieldProblems(opening, "I am at the lab. What are you working on?", { stories }),
    ).toEqual([]);
  });

  it("test_309_ac2_a_story_moves_only_to_a_neighbouring_period_and_never_empties_one", () => {
    // s2 is first in Berkeley: it may join Youth. s4 is last: it may join War. s3 may not move.
    expect(periodChoices(stories, "s2")).toEqual(["Youth", "Berkeley"]);
    expect(periodChoices(stories, "s3")).toEqual(["Berkeley"]);
    expect(periodChoices(stories, "s4")).toEqual(["Berkeley", "War"]);
    // s1 and s5 are alone in their periods: moving them would empty a period.
    expect(periodChoices(stories, "s1")).toEqual(["Youth"]);
    expect(periodChoices(stories, "s5")).toEqual(["War"]);
    const refusal =
      "Choose the story's own period or the period of the story just before or after it. A story that is alone in its period stays there.";
    expect(fieldProblems(story("s3", "period"), "War", { stories })).toEqual([refusal]);
    expect(fieldProblems(story("s1", "period"), "Berkeley", { stories })).toEqual([refusal]);
    expect(fieldProblems(story("s4", "period"), "War", { stories })).toEqual([]);
  });

  it("test_309_ac2_a_period_cannot_take_another_periods_name", () => {
    const second = parseFieldKey("chr.opp.period.2")!;
    expect(fieldProblems(second, "War", { stories })).toEqual([
      'Another period is already called "War".',
    ]);
    expect(fieldProblems(second, "Berkeley", { stories })).toEqual([]);
    expect(fieldProblems(second, "The Berkeley years", { stories })).toEqual([]);
    expect(fieldProblems(parseFieldKey("chr.opp.period.9")!, "Later", { stories })).toEqual([
      "This period is not known.",
    ]);
  });
});
