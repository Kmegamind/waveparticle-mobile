import { describe, expect, it } from "vitest";
import {
  cardLengthProblems,
  storyDetail,
  storyList,
  type StoryCardRow,
  type StoryPartRow,
  type StoryRow,
} from "@/lib/story-cards/admin";

// #293 AC3, AC6: what ADM-06 Stories lists and shows, and CARD-LENGTH marked as failing.

const words = (count: number) => Array.from({ length: count }, () => "word").join(" ") + ".";

const card = (overrides: Partial<StoryCardRow>): StoryCardRow => ({
  key: "crd.opp.a.p1.c1",
  version: 1,
  story_id: "a",
  kind: "part",
  part: 1,
  slice: "s1",
  position: 1,
  body: "I sit.",
  published: true,
  ...overrides,
});

const stories: StoryRow[] = [
  { id: "b", title: "Second", sequence: 2 },
  { id: "a", title: "First", sequence: 1 },
  { id: "c", title: "Third, no cards yet", sequence: 3 },
];
const parts: StoryPartRow[] = [
  { story_id: "a", part: 2, title: "Then this." },
  { story_id: "a", part: 1, title: "Do this." },
];
const cards: StoryCardRow[] = [
  card({ key: "crd.opp.a.bg", kind: "background", part: null, slice: null, body: "I am here." }),
  card({ key: "crd.opp.a.p2.c1", part: 2, slice: "s3", body: "Later." }),
  card({ key: "crd.opp.a.p1.c2", position: 2, slice: "s2", body: "Second card." }),
  card({ key: "crd.opp.a.p1.c1", body: words(46) }),
  // A newer draft of a published card: the published version is the one shown.
  card({ key: "crd.opp.a.p1.c2", version: 2, position: 2, slice: "s2", published: false }),
  card({ key: "crd.opp.b.p1.c1", story_id: "b", published: false, version: 3 }),
  card({ key: "crd.opp.b.p1.c1", story_id: "b", published: false, version: 1 }),
];

describe("CARD-LENGTH (#293 AC6)", () => {
  it("test_293_ac6_a_part_card_over_45_words_fails", () => {
    expect(cardLengthProblems("part", words(45))).toEqual([]);
    expect(cardLengthProblems("part", words(46))).toEqual(["46 words; the limit is 45."]);
  });

  it("test_293_ac6_a_background_card_over_70_words_fails", () => {
    expect(cardLengthProblems("background", words(70))).toEqual([]);
    expect(cardLengthProblems("background", words(71))).toEqual(["71 words; the limit is 70."]);
  });

  it("test_293_ac6_a_part_card_of_more_than_3_sentences_fails", () => {
    expect(cardLengthProblems("part", "One. Two! Three?")).toEqual([]);
    expect(cardLengthProblems("part", "One. Two. Three. Four.")).toEqual([
      "4 sentences; the limit is 3.",
    ]);
    // Honorifics and quoted endings do not end or add a sentence.
    expect(
      cardLengthProblems("part", "Go and see Mrs. Kennedy. I said, “This is too strong.” I wait."),
    ).toEqual([]);
    // Text without a final full stop is still one sentence.
    expect(cardLengthProblems("part", "Go and see Mrs. Kennedy")).toEqual([]);
  });

  it("test_293_ac6_both_limits_are_reported_together", () => {
    expect(cardLengthProblems("part", `${words(44)} Two. Three. Four.`)).toEqual([
      "47 words; the limit is 45.",
      "4 sentences; the limit is 3.",
    ]);
  });
});

describe("ADM-06 Stories list (#293 AC3)", () => {
  it("test_293_ac3_lists_every_story_in_story_order_with_parts_and_cards", () => {
    expect(storyList(stories, parts, cards)).toEqual([
      { id: "a", key: "opp.a", title: "First", sequence: 1, parts: 2, cards: 3, failing: 1 },
      { id: "b", key: "opp.b", title: "Second", sequence: 2, parts: 1, cards: 1, failing: 0 },
      {
        id: "c",
        key: "opp.c",
        title: "Third, no cards yet",
        sequence: 3,
        parts: 0,
        cards: 0,
        failing: 0,
      },
    ]);
  });
});

describe("ADM-06 one story (#293 AC3)", () => {
  it("test_293_ac3_shows_the_background_card_and_cards_grouped_by_part_with_titles_and_versions", () => {
    const detail = storyDetail(stories[1], parts, cards)!;
    expect(detail.title).toBe("First");
    expect(detail.background).toMatchObject({
      key: "crd.opp.a.bg",
      version: 1,
      published: true,
      body: "I am here.",
      problems: [],
    });
    expect(detail.parts.map((part) => [part.part, part.title])).toEqual([
      [1, "Do this."],
      [2, "Then this."],
    ]);
    expect(
      detail.parts[0].cards.map((entry) => [entry.key, entry.slice, entry.version, entry.words]),
    ).toEqual([
      ["crd.opp.a.p1.c1", "s1", 1, 46],
      ["crd.opp.a.p1.c2", "s2", 1, 2],
    ]);
    expect(detail.parts[0].cards[0].problems).toEqual(["46 words; the limit is 45."]);
  });

  it("test_293_ac3_a_card_with_no_published_version_shows_its_newest_version", () => {
    const detail = storyDetail(stories[0], parts, cards)!;
    expect(detail.background).toBeNull();
    expect(detail.parts).toEqual([
      {
        part: 1,
        title: null,
        cards: [expect.objectContaining({ key: "crd.opp.b.p1.c1", version: 3, published: false })],
      },
    ]);
  });

  it("test_293_ac3_a_story_without_cards_has_no_parts", () => {
    expect(storyDetail(stories[2], parts, cards)).toEqual({
      id: "c",
      key: "opp.c",
      title: "Third, no cards yet",
      sequence: 3,
      background: null,
      parts: [],
    });
  });
});
