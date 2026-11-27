import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PublishFirstNotice } from "@/app/admin/stories/publish-first-notice";
import { storyDetail, storyList, type StoryCardRow } from "@/lib/story-cards/admin";
import { companionOfPage, readStoryCardsData } from "@/lib/story-cards/reader";

// #502 AC2: the admin's Stories pages list any Companion's stories (?companion=<id>), and his
// imported cards show as drafts (version 1, never published) that are edited and published with
// the existing flow. All text here is invented.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

type Call = { table: string; filters: [string, string, unknown][] };

/** A Supabase client stand-in that records each query's filters and answers from the rows. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          call.filters.push(["eq", column, value]);
          return builder;
        },
        order: () => builder,
        then: (resolve: (answer: { data: unknown; error: null }) => void) =>
          resolve({
            data: (tables[table] ?? []).filter((row) =>
              call.filters.every(([, column, value]) => row[column] === value),
            ),
            error: null,
          }),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const card = (over: Partial<StoryCardRow>): StoryCardRow => ({
  key: "crd.snp.inv-door.p1.c1",
  version: 1,
  story_id: "inv-door",
  kind: "part",
  part: 1,
  slice: "s1",
  position: 1,
  body: "Invented card text.",
  published: false,
  published_at: null,
  ...over,
});

const tables = {
  companions: [
    { id: "oppenheimer", key_code: "opp", short_name: "Oppenheimer" },
    { id: "snape", key_code: "snp", short_name: "Snape" },
  ],
  stories: [
    { id: "opp-one", title: "Invented Opp", sequence: 1, companion_id: "oppenheimer" },
    { id: "inv-door", title: "Invented door", sequence: 1, companion_id: "snape" },
  ],
  story_parts: [
    { story_id: "opp-one", part: 1, title: "Invented part" },
    { story_id: "inv-door", part: 1, title: "Invented aim" },
  ],
  story_cards: [
    card({ key: "crd.opp.opp-one.p1.c1", story_id: "opp-one", published: true, published_at: "x" }),
    card({}),
    card({ key: "crd.snp.inv-door.bg", kind: "background", part: null, slice: null }),
  ],
};

describe("#502 AC2 the Stories pages read any Companion", () => {
  it("test_502_ac2_the_list_reads_one_companions_stories_and_only_their_parts_and_cards", async () => {
    const { client } = fakeClient(tables);
    const opp = await readStoryCardsData(client);
    expect(opp.stories.map((row) => row.id)).toEqual(["opp-one"]);
    // Another Companion's draft cards are not counted on Oppenheimer's list or the status board.
    expect(opp.cards.map((row) => row.key)).toEqual(["crd.opp.opp-one.p1.c1"]);
    expect(opp.parts.map((row) => row.story_id)).toEqual(["opp-one"]);
    expect(opp.companion).toEqual({
      id: "oppenheimer",
      key_code: "opp",
      short_name: "Oppenheimer",
    });

    const snape = await readStoryCardsData(client, undefined, "snape");
    expect(snape.stories.map((row) => row.id)).toEqual(["inv-door"]);
    expect(snape.cards).toHaveLength(2);
    expect(snape.companion?.key_code).toBe("snp");
  });

  it("test_502_ac2_one_story_is_read_whatever_its_companion", async () => {
    const { client, calls } = fakeClient(tables);
    const data = await readStoryCardsData(client, "inv-door");
    expect(data.stories.map((row) => row.id)).toEqual(["inv-door"]);
    expect(data.companion?.id).toBe("snape");
    const stories = calls.find((call) => call.table === "stories")!;
    expect(stories.filters).toEqual([["eq", "id", "inv-door"]]);
  });

  it("test_502_ac2_the_companion_comes_from_the_address_and_defaults_to_oppenheimer", () => {
    expect(companionOfPage(undefined)).toBe("oppenheimer");
    expect(companionOfPage("snape")).toBe("snape");
    expect(companionOfPage(["snape", "x"])).toBe("snape");
    expect(companionOfPage("Not An Id")).toBe("oppenheimer");
  });

  it("test_502_ac2_imported_cards_show_as_drafts_with_his_key_code", () => {
    const story = { id: "inv-door", title: "Invented door", sequence: 1 };
    const detail = storyDetail(
      story,
      tables.story_parts,
      tables.story_cards,
      undefined,
      undefined,
      "snp",
    )!;
    expect(detail.key).toBe("snp.inv-door");
    expect(detail.background?.published).toBe(false);
    expect(detail.background?.draft?.version).toBe(1);
    const first = detail.parts[0].cards[0];
    expect(first.published).toBe(false);
    expect(first.draft).toMatchObject({ version: 1, body: "Invented card text." });
    expect(first.versions).toEqual([
      { version: 1, body: "Invented card text.", state: "draft", canRollBack: false },
    ]);
    const [row] = storyList(
      [story],
      tables.story_parts,
      tables.story_cards,
      undefined,
      undefined,
      "snp",
    );
    expect(row).toMatchObject({ key: "snp.inv-door", parts: 1, cards: 1, background: true });
    // Oppenheimer's keys are unchanged.
    expect(
      storyDetail({ id: "opp-one", title: "x", sequence: 1 }, [], tables.story_cards)!.key,
    ).toBe("opp.opp-one");
  });

  it("test_502_ac2_the_pages_use_the_companion_and_say_when_nothing_is_published", () => {
    const list = read("src/app/admin/stories/page.tsx");
    expect(list).toContain("searchParams");
    expect(list).toContain("companionOfPage(");
    expect(list).not.toMatch(/import \{[^}]*COMPANION_ID/);
    const story = read("src/app/admin/stories/[id]/page.tsx");
    expect(story).toContain("/admin/stories?companion=");
    const drafts = renderToStaticMarkup(createElement(PublishFirstNotice, { drafts: true }));
    expect(drafts).toContain("Imported as drafts.");
    expect(drafts).toContain("Phones show none of these cards until an admin publishes them.");
    expect(drafts).not.toContain("Published first");
    const published = renderToStaticMarkup(createElement(PublishFirstNotice));
    expect(published).toContain("Published first, read afterwards.");
  });
});

describe("#502 AC2 missing inputs say Not written yet", () => {
  it("test_502_ac2_the_story_fields_page_marks_the_inputs_that_do_not_exist", () => {
    const page = read("src/app/admin/companions/[id]/stories/[story]/page.tsx");
    // People, later words, the scene table (pause and rest-chat inputs) and the closing line.
    expect(page).toContain("NOT_WRITTEN");
    expect(page).toMatch(/Scene table \(pause and rest-chat inputs\)/);
    expect(page).toMatch(/Closing line and carried line/);
    expect(read("src/app/admin/companions/field-editor.tsx")).toContain('"Not written yet."');
  });
});
