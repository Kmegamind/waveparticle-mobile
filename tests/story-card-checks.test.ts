import { describe, expect, it } from "vitest";
import { cardProblems, datesProblems, laterPartLeaks } from "@/lib/story-cards/checks";

// #304 AC3: the checks every save of a story card runs in the admin.

const stageZero = {
  slices: [
    { id: "s1", leaks: ["river cam"] },
    { id: "s2", leaks: ["films"] },
    { id: "s3", leaks: ["heisenberg"] },
    { id: "s4", leaks: ["kapitza"] },
  ],
};
/** Slices s1 and s2 sit in part 1, s3 in part 2, s4 in part 3. */
const slicePart = new Map([
  ["s1", 1],
  ["s2", 1],
  ["s3", 2],
  ["s4", 3],
]);

const part = (body: string, partNumber = 1) => ({ kind: "part" as const, part: partNumber, body });

describe("story card checks (#304)", () => {
  it("test_304_ac3_a_year_fails", () => {
    expect(datesProblems("It was 1943 and I was cold.")).toEqual([
      'Mentions a year ("1943"). Years and dates stay in the admin.',
    ]);
    expect(datesProblems("The 1940s were loud.")).toHaveLength(1);
  });

  it("test_304_ac3_a_date_fails", () => {
    expect(datesProblems("On May 3 the train left.")).toEqual([
      'Mentions a date ("May 3"). Years and dates stay in the admin.',
    ]);
    expect(datesProblems("By the 4th of July I had it.")).toHaveLength(1);
  });

  it("test_304_ac3_an_age_fails", () => {
    expect(datesProblems("I am 38 years old today.")).toEqual([
      'Mentions an age ("38 years old"). Ages stay in the admin.',
    ]);
    expect(datesProblems("At the age of 22 I left.")).toHaveLength(1);
  });

  it("test_304_ac3_plain_words_and_small_numbers_pass", () => {
    expect(datesProblems("I count forty steps and three doors. May I sit?")).toEqual([]);
  });

  it("test_304_ac3_leak_words_come_from_the_parts_after_the_cards_part", () => {
    expect(laterPartLeaks(stageZero, slicePart, 1)).toEqual(["heisenberg", "kapitza"]);
    expect(laterPartLeaks(stageZero, slicePart, 3)).toEqual([]);
    // The background card comes before part 1: every part is after it.
    expect(laterPartLeaks(stageZero, slicePart, null)).toEqual([
      "river cam",
      "films",
      "heisenberg",
      "kapitza",
    ]);
  });

  it("test_304_ac3_a_later_parts_word_fails_on_word_boundaries_only", () => {
    const leaks = laterPartLeaks(stageZero, slicePart, 1);
    expect(cardProblems(part("I read Heisenberg at night."), leaks)).toEqual([
      'Mentions "heisenberg", which comes in a later part.',
    ]);
    const background = laterPartLeaks(stageZero, slicePart, null);
    expect(
      cardProblems({ kind: "background", part: null, body: "I keep a filmstrip." }, background),
    ).toEqual([]);
  });

  it("test_304_ac3_smart_quotes_and_line_breaks_do_not_hide_a_later_parts_words", () => {
    const leaks = ["rutherford's office", "can't tell you"];
    expect(cardProblems(part("I sat in Rutherford’s office."), leaks)).toEqual([
      `Mentions "rutherford's office", which comes in a later part.`,
    ]);
    expect(cardProblems(part("He said, I can't\ntell  you."), leaks)).toEqual([
      `Mentions "can't tell you", which comes in a later part.`,
    ]);
  });

  it("test_304_ac3_banned_words_fail", () => {
    expect(cardProblems(part("The vibes in the lab are low."), [])).toEqual([
      'Uses a banned word ("vibes").',
    ]);
  });

  it("test_304_ac3_length_problems_are_listed", () => {
    const long = Array.from({ length: 46 }, () => "word").join(" ") + ".";
    expect(cardProblems(part(long), [])).toEqual(["46 words; the limit is 45."]);
  });

  it("test_304_unreadable_story_inputs_block_the_card", () => {
    expect(cardProblems(part("I sit at the bench."), null)).toEqual([
      "The spoiler check could not run: the story inputs could not be read.",
    ]);
  });

  it("test_304_a_passing_card_has_no_problems", () => {
    expect(cardProblems(part("I sit at the bench and wait."), ["heisenberg"])).toEqual([]);
  });
});
