import { describe, expect, it } from "vitest";
import decks from "@/content/oppenheimer/story-decks.json";
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
    expect(cardProblems(part("I said, I can't\ntell  you."), leaks)).toEqual([
      `Mentions "can't tell you", which comes in a later part.`,
    ]);
  });

  it("test_304_ac3_banned_words_fail", () => {
    expect(cardProblems(part("The vibes in the lab are low."), [])).toEqual([
      'Uses a banned word ("vibes").',
    ]);
  });

  it("test_304_ac3_length_problems_are_listed", () => {
    const long = Array.from({ length: 61 }, () => "word").join(" ") + ".";
    expect(cardProblems(part(long), [])).toEqual(["61 words; the limit is 60."]);
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

// #16 (US-FMT-4, D2): every card can be read on its own. The same rule runs on every admin save and
// in the server's check before Publish, because both call cardProblems.
describe("a card reads on its own (#16)", () => {
  it.each(["He", "She", "It", "This"])("test_16_ac1_a_card_opening_with_%s_fails", (word) => {
    expect(cardProblems(part(`${word} was cold in the lab.`), [])).toEqual([
      `Opens with "${word}". Name who or what you mean, so the card reads on its own.`,
    ]);
  });

  it("test_16_ac1_the_opener_is_found_after_quotes_and_in_any_case", () => {
    expect(cardProblems(part("“this was the wrong door,” I say."), [])).toEqual([
      'Opens with "this". Name who or what you mean, so the card reads on its own.',
    ]);
  });

  it.each(["again", "another", "as I said", "the same", "that one"])(
    "test_16_ac1_a_card_using_%s_fails",
    (phrase) => {
      expect(cardProblems(part(`I try ${phrase} door in the hall.`), [])).toEqual([
        `Uses "${phrase}", which points at another card. The card must read on its own.`,
      ]);
    },
  );

  it("test_16_ac1_those_words_match_whole_words_only", () => {
    // "Heat", "Items", "Thistle", "gain" and "sameness" are not the listed words.
    expect(cardProblems(part("Heat rises. Items, thistle and a gain of sameness."), [])).toEqual(
      [],
    );
    expect(cardProblems(part("Items sit on the bench."), [])).toEqual([]);
  });

  it("test_16_ac2_a_card_that_repeats_the_noun_passes", () => {
    expect(cardProblems(part("The lab was cold. I keep the lab door shut."), [])).toEqual([]);
  });

  it("test_16_ac1_the_admin_save_and_the_publish_check_share_the_rule", () => {
    // The background card goes through the same checks.
    expect(
      cardProblems({ kind: "background", part: null, body: "It rains again." }, []),
    ).toHaveLength(2);
  });
});

// #13 (US-FMT-11, M2): only the background card introduces people; no later card carries an
// introduction phrase. The same rule runs on every admin save and before Publish via cardProblems.
describe("no introduction phrase after the background card (#13)", () => {
  const phrases = [
    "my name is",
    "I am J. Robert Oppenheimer",
    "I'm J. Robert Oppenheimer",
    "let me introduce",
    "allow me to introduce",
  ];

  it.each(phrases)("test_13_ac1_a_part_card_with_%s_fails", (phrase) => {
    const found = cardProblems(part(`The door is shut. ${phrase} to the room.`), []);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(
      /^Introduces someone \(".+"\)\. Only the background card does that\.$/,
    );
  });

  it("test_13_ac1_the_phrase_is_found_in_any_case_and_with_curly_quotes", () => {
    expect(cardProblems(part("MY NAME IS Rabi, and I wait."), [])).toHaveLength(1);
    expect(cardProblems(part("I’m J. Robert Oppenheimer, and I wait."), [])).toHaveLength(1);
  });

  it("test_13_ac1_the_background_card_may_introduce_people", () => {
    const background = {
      kind: "background" as const,
      part: null,
      body: "My name is Robert. Let me introduce Rabi, who works beside me.",
    };
    expect(cardProblems(background, [])).toEqual([]);
  });

  it("test_13_ac1_ordinary_story_text_passes", () => {
    expect(cardProblems(part("Rabi says his name is on the door, and I nod."), [])).toEqual([]);
    expect(cardProblems(part("I name the problem and write it down."), [])).toEqual([]);
  });
});

// #365: a line inside quotation marks is dialogue, not him introducing himself (product owner,
// 2026-11-21). The check ignores quoted text; his own voice outside quotes still fails.
describe("the introduction check ignores quoted dialogue (#365)", () => {
  const introduces = (body: string) =>
    cardProblems(part(body), []).filter((p) => /^Introduces/.test(p));

  it("test_365_ac1_shelter_island_part_4_card_2_passes", () => {
    // Real text: src/content/oppenheimer/story-decks.json, "shelter-island", part 4, second card.
    const shelter = (
      decks as Record<string, { parts: { n: number; cards: { text: string }[] }[] }>
    )["shelter-island"];
    const body = shelter.parts.find((p) => p.n === 4)!.cards[1].text;
    expect(body).toContain("My name is Oppenheimer.");
    expect(introduces(body)).toEqual([]);
  });

  it("test_365_ac2_an_introduction_outside_quotes_still_fails", () => {
    expect(introduces("I stepped off the plane. My name is Oppenheimer.")).toHaveLength(1);
    expect(introduces("I am J. Robert Oppenheimer, a physicist.")).toHaveLength(1);
    expect(introduces("I am Robert Oppenheimer, a physicist.")).toHaveLength(1);
    expect(introduces('I said "Hello." My name is Oppenheimer.')).toHaveLength(1);
  });

  it("test_365_ac3_an_apostrophe_inside_a_word_is_not_a_quote", () => {
    expect(introduces("I don't know them. My name is Oppenheimer.")).toHaveLength(1);
    expect(introduces("Oppenheimer's captain waited. My name is Oppenheimer.")).toHaveLength(1);
    expect(introduces("Don\u2019t ask. I am Robert Oppenheimer, a physicist.")).toHaveLength(1);
  });

  it("test_365_ac3_quoted_dialogue_passes_in_every_quote_style", () => {
    expect(introduces('He said "My name is Oppenheimer." and left.')).toEqual([]);
    expect(introduces("He said \u201cMy name is Oppenheimer.\u201d and left.")).toEqual([]);
    expect(introduces("He said \u2018My name is Oppenheimer.\u2019 and left.")).toEqual([]);
    expect(introduces("He said 'My name is Oppenheimer.' and left.")).toEqual([]);
    expect(introduces("He said \u201cI don\u2019t care. My name is Oppenheimer.\u201d")).toEqual(
      [],
    );
    expect(
      introduces("He said \u201cMy name is Oppenheimer\u201d, and I am J. Robert Oppenheimer."),
    ).toHaveLength(1);
  });

  it("test_365_fix1_a_stray_single_quote_does_not_hide_an_introduction", () => {
    expect(introduces("He said 'go. My name is Oppenheimer. The boys' lab.")).toHaveLength(1);
    expect(introduces("'Twas night. My name is Oppenheimer. The boys' lab.")).toHaveLength(1);
    expect(
      introduces("The boys' lab was cold. I don't know. My name is Oppenheimer."),
    ).toHaveLength(1);
    expect(
      introduces("He said \u2018go. My name is Oppenheimer. The boys\u2019 lab."),
    ).toHaveLength(1);
  });

  it("test_365_fix1_a_single_quoted_line_that_ends_in_a_letter_before_punctuation_passes", () => {
    expect(introduces("He said 'My name is Oppenheimer', and left.")).toEqual([]);
    expect(introduces("He said \u2018My name is Oppenheimer\u2019, and left.")).toEqual([]);
  });
});
