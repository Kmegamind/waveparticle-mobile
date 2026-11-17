import { describe, expect, it } from "vitest";
import { readStoryCardsFromSupabase } from "@/lib/content/repository";
import { deckVersions, parseStoryDeck } from "@/lib/content/story-deck";

// #300 AC1: a story's published pre-made cards, read by the server through the content interface.

const row = (key: string, kind: string, part: number | null, position: number, version = 1) => ({
  key,
  version,
  kind,
  part,
  position,
  body: `text of ${key}`,
});

const document = {
  cards: [
    row("crd.opp.x.p2.c1", "part", 2, 1),
    row("crd.opp.x.p1.c2", "part", 1, 2, 3),
    row("crd.opp.x.bg", "background", null, 1),
    row("crd.opp.x.p1.c1", "part", 1, 1),
  ],
};

describe("parseStoryDeck (#300)", () => {
  it("test_300_ac1_groups_the_cards_by_part_in_story_order_after_the_background_card", () => {
    const deck = parseStoryDeck(document)!;
    expect(deck.background).toEqual({
      key: "crd.opp.x.bg",
      version: 1,
      text: "text of crd.opp.x.bg",
    });
    expect(deck.parts.map((part) => part.map((card) => card.key))).toEqual([
      ["crd.opp.x.p1.c1", "crd.opp.x.p1.c2"],
      ["crd.opp.x.p2.c1"],
    ]);
    expect(deckVersions(deck)).toEqual({
      "crd.opp.x.bg": 1,
      "crd.opp.x.p1.c1": 1,
      "crd.opp.x.p1.c2": 3,
      "crd.opp.x.p2.c1": 1,
    });
  });

  it("test_300_ac3_a_story_without_a_background_or_part_card_has_no_deck", () => {
    expect(parseStoryDeck({ cards: [] })).toBeNull();
    expect(parseStoryDeck({ cards: [row("crd.opp.x.bg", "background", null, 1)] })).toBeNull();
    expect(parseStoryDeck({ cards: [row("crd.opp.x.p1.c1", "part", 1, 1)] })).toBeNull();
  });

  it("test_300_malformed_rows_are_refused", () => {
    for (const bad of [
      null,
      { cards: "no" },
      { cards: [{ ...row("crd.opp.x.bg", "background", null, 1), body: "" }] },
      { cards: [{ ...row("crd.opp.x.p1.c1", "part", null, 1) }] },
      { cards: [{ ...row("crd.opp.x.p1.c1", "other", 1, 1) }] },
      { cards: [{ ...row("crd.opp.x.p1.c1", "part", 1, 1), version: "1" }] },
    ]) {
      expect(() => parseStoryDeck(bad), JSON.stringify(bad)).toThrow();
    }
  });
});

describe("readStoryCardsFromSupabase (#300)", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    CONTENT_READ_KEY: "reader-key",
  };
  const answer = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("test_300_ac1_asks_get_story_cards_with_the_reader_key_and_the_pinned_versions", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const deck = await readStoryCardsFromSupabase({
      storyId: "x",
      versions: { "crd.opp.x.bg": 1 },
      env,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return answer(document);
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/rpc/get_story_cards");
    expect(calls[0].body).toEqual({
      reader_key: "reader-key",
      story: "x",
      versions: { "crd.opp.x.bg": 1 },
    });
    expect(deck?.parts).toHaveLength(2);
  });

  it("test_300_ac1_published_cards_are_asked_for_with_no_versions", async () => {
    let body: unknown;
    await readStoryCardsFromSupabase({
      storyId: "x",
      versions: null,
      env,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return answer(document);
      },
    });
    expect(body).toEqual({ reader_key: "reader-key", story: "x", versions: null });
  });

  it("test_300_ac3_a_wrong_key_or_a_failed_read_throws", async () => {
    await expect(
      readStoryCardsFromSupabase({
        storyId: "x",
        versions: null,
        env,
        fetchImpl: async () => answer(null),
      }),
    ).rejects.toThrow();
    await expect(
      readStoryCardsFromSupabase({
        storyId: "x",
        versions: null,
        env: { ...env, CONTENT_READ_KEY: "" },
        fetchImpl: async () => answer(document),
      }),
    ).rejects.toThrow(/CONTENT_READ_KEY/);
  });
});
