import { describe, expect, it } from "vitest";
import {
  cardKey,
  readStoryDecks,
  storyCardRows,
  storyCardsImportSql,
} from "../scripts/story-cards/import.mjs";

// #293 AC2: the import loads story-decks.json as version 1, published, and is safe to run twice.

const rows = () => storyCardRows(readStoryDecks());

describe("story cards import (#293)", () => {
  it("test_293_ac1_keys_use_the_frozen_naming", () => {
    expect(cardKey("site-search")).toBe("crd.opp.site-search.bg");
    expect(cardKey("site-search", 3, 2)).toBe("crd.opp.site-search.p3.c2");
  });

  it("test_293_ac2_loads_26_stories_26_backgrounds_and_their_part_cards_skipping_story1", () => {
    const { parts, cards } = rows();
    const stories = new Set(cards.map((card) => card.story_id));
    expect(stories.size).toBe(26);
    expect(stories.has("story1")).toBe(false);
    expect(cards.filter((card) => card.kind === "background")).toHaveLength(26);
    // The deck has 251 part cards for the 26 real stories (the issue's "about 262" counted story1).
    expect(cards.filter((card) => card.kind === "part")).toHaveLength(251);
    expect(parts).toHaveLength(26 * 4);
    expect(new Set(cards.map((card) => card.key)).size).toBe(cards.length);
  });

  it("test_293_ac2_rows_keep_the_part_slice_order_and_text_of_the_deck", () => {
    const { parts, cards } = rows();
    const background = cards.find((card) => card.key === "crd.opp.bohr-difficulties.bg");
    expect(background).toMatchObject({
      story_id: "bohr-difficulties",
      kind: "background",
      part: null,
      slice: null,
      position: 1,
    });
    expect(background?.body).toMatch(/^I'm in Cambridge, in the spring/);
    const first = cards.find((card) => card.key === "crd.opp.bohr-difficulties.p1.c1");
    expect(first).toMatchObject({ kind: "part", part: 1, slice: "s1", position: 1 });
    expect(first?.body).toMatch(/^I am tired, and the bench has stopped interesting me\./);
    expect(parts[0]).toEqual({
      story_id: "bohr-difficulties",
      part: 1,
      title: "Leave the laboratory bench and set out to learn theory.",
    });
  });

  it("test_293_ac2_slots_count_cards_within_a_part_even_when_a_slice_repeats", () => {
    const decks = {
      x: {
        id: "x",
        background: "Here I am.",
        parts: [
          {
            n: 1,
            title: "Do it.",
            slices: ["s1"],
            cards: [
              { at: "s1", text: "One." },
              { at: "s1", text: "Two." },
            ],
          },
        ],
      },
    };
    const { cards } = storyCardRows(decks, ["x"]);
    expect(cards.map((card) => [card.key, card.slice, card.position])).toEqual([
      ["crd.opp.x.bg", null, 1],
      ["crd.opp.x.p1.c1", "s1", 1],
      ["crd.opp.x.p1.c2", "s1", 2],
    ]);
  });

  it("test_293_ac2_refuses_a_deck_story_that_is_not_in_the_stories_list", () => {
    const decks = { x: { id: "x", background: "Here.", parts: [] } };
    expect(() => storyCardRows(decks, ["y"])).toThrow(/x/);
  });

  it("test_293_ac2_sql_inserts_version_1_published_only_for_keys_without_rows", () => {
    const sql = storyCardsImportSql(rows());
    expect(sql.startsWith("-- Story cards")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql).toContain("set local standard_conforming_strings = on;");
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    const inserts = sql.match(/insert into public\.story_cards/g) ?? [];
    expect(inserts).toHaveLength(26 + 251);
    // Running it again, or after a later version exists, adds nothing for that key.
    expect(sql).toContain(
      "where not exists (select 1 from public.story_cards where key = 'crd.opp.site-search.bg');",
    );
    expect(sql).toMatch(/, 1, true, now\(\)/);
    expect(sql.match(/insert into public\.story_parts/g)).toHaveLength(104);
    expect(sql).toContain("on conflict (story_id, part) do nothing;");
    expect(sql).not.toMatch(/do update/);
  });

  it("test_293_ac2_text_is_stored_literally", () => {
    const decks = {
      x: {
        id: "x",
        background: "It's a \\ back'slash'); drop table x; --",
        parts: [],
      },
    };
    const sql = storyCardsImportSql(storyCardRows(decks, ["x"]));
    expect(sql).toContain("'It''s a \\ back''slash''); drop table x; --'");
    expect(() =>
      storyCardsImportSql(storyCardRows({ x: { ...decks.x, background: "a\0b" } }, ["x"])),
    ).toThrow(/NUL/);
  });
});
