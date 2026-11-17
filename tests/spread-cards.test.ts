import { describe, expect, it } from "vitest";
import { spreadCards } from "@/lib/story/start";

// #300 AC2, CARDS-PER-PART and CARDS-SPREAD: a story's cards spread across the user's Steps.

const deck = {
  background: "BG",
  parts: [
    ["a1", "a2"],
    ["b1", "b2", "b3"],
    ["c1", "c2"],
    ["d1", "d2"],
  ],
};
const all = deck.parts.flat();
/** Each Step's new cards, in order: Step 1's opening is the background card. */
const newCards = (steps: { opening: string; story: string[] }[]) =>
  steps.map((step, index) => (index === 0 ? step.story : [step.opening, ...step.story]));

describe("spreadCards (#300)", () => {
  it("test_300_ac2_the_background_card_opens_step_1", () => {
    for (const count of [1, 2, 5, 9]) {
      expect(spreadCards(deck, count)[0].opening).toBe("BG");
    }
  });

  it("test_300_ac2_one_step_gets_every_card", () => {
    expect(spreadCards(deck, 1)).toEqual([{ opening: "BG", story: all }]);
  });

  it("test_300_ac2_fewer_steps_than_parts_keeps_whole_parts_together", () => {
    // The decision's example: 4 parts and 2 Steps give parts 1 and 2, then parts 3 and 4.
    expect(newCards(spreadCards(deck, 2))).toEqual([
      ["a1", "a2", "b1", "b2", "b3"],
      ["c1", "c2", "d1", "d2"],
    ]);
    // An extra part goes to an earlier Step.
    expect(newCards(spreadCards(deck, 3))).toEqual([
      ["a1", "a2", "b1", "b2", "b3"],
      ["c1", "c2"],
      ["d1", "d2"],
    ]);
    expect(newCards(spreadCards(deck, 4))).toEqual(deck.parts);
  });

  it("test_300_ac2_more_steps_than_parts_splits_a_part_across_neighbouring_steps", () => {
    expect(newCards(spreadCards(deck, 5))).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
      ["b3"],
      ["c1", "c2"],
      ["d1", "d2"],
    ]);
    expect(newCards(spreadCards(deck, 6))).toEqual([
      ["a1"],
      ["a2"],
      ["b1", "b2"],
      ["b3"],
      ["c1", "c2"],
      ["d1", "d2"],
    ]);
  });

  it("test_300_ac2_a_step_after_the_first_opens_with_the_storys_next_card", () => {
    const steps = spreadCards(deck, 2);
    expect(steps[1]).toEqual({ opening: "c1", story: ["c2", "d1", "d2"] });
  });

  it("test_300_ac2_no_card_is_dropped_or_repeated_and_every_step_gets_a_new_card", () => {
    const big = {
      background: "BG",
      parts: [
        Array.from({ length: 7 }, (_, i) => `p1-${i}`),
        Array.from({ length: 2 }, (_, i) => `p2-${i}`),
        Array.from({ length: 4 }, (_, i) => `p3-${i}`),
      ],
    };
    const cards = big.parts.flat();
    for (let count = 1; count <= cards.length; count += 1) {
      const fresh = newCards(spreadCards(big, count));
      expect(fresh, `${count} Steps`).toHaveLength(count);
      expect(fresh.flat(), `${count} Steps`).toEqual(cards);
      for (const step of fresh) expect(step.length, `${count} Steps`).toBeGreaterThan(0);
      // T7's limit of 5 story cards no longer cuts pre-made cards.
    }
    expect(spreadCards(big, 1)[0].story).toHaveLength(13);
  });

  it("test_300_ac2_more_steps_than_cards_shows_each_card_once_then_stays_on_the_last", () => {
    const small = { background: "BG", parts: [["x1"], ["y1"]] };
    expect(spreadCards(small, 4)).toEqual([
      { opening: "BG", story: ["x1"] },
      { opening: "y1", story: [] },
      { opening: "y1", story: [] },
      { opening: "y1", story: [] },
    ]);
  });

  it("test_300_ac2_refuses_an_empty_plan_or_a_story_without_part_cards", () => {
    expect(() => spreadCards(deck, 0)).toThrow(RangeError);
    expect(() => spreadCards({ background: "BG", parts: [[]] }, 2)).toThrow(RangeError);
  });
});
