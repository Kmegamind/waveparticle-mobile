import { describe, expect, it, vi } from "vitest";
import type { ContentRole } from "@/lib/admin/roles";
import { leaksForStory } from "@/lib/story-cards/checks";
import { storyDetail, type StoryCardRow } from "@/lib/story-cards/admin";
import { writeStoryCard, type StoryCardWrite } from "@/lib/story-cards/write";

// #304 AC1, AC2, AC4, AC5, AC6: the writes behind ADM-06's buttons, and what the editor shows.

const KEY = "crd.opp.a.p1.c1";

function deps(role: ContentRole | null, problems: string[] | null = []) {
  const rpc = vi.fn(async () => ({ data: 2 as unknown, error: null as unknown }));
  const checkCard = vi.fn(async () => problems);
  return { userId: role ? "u1" : null, role, rpc, checkCard };
}

describe("story card writes (#304)", () => {
  it("test_304_ac1_a_writer_saves_a_draft_version", async () => {
    const d = deps("writer");
    const result = await writeStoryCard({ kind: "save", key: KEY, body: "I sit down." }, d);
    expect(result).toEqual({ ok: true, version: 2 });
    expect(d.rpc).toHaveBeenCalledWith("save_story_card_draft", {
      card_key: KEY,
      card_body: "I sit down.",
    });
  });

  it("test_304_ac1_without_a_role_nothing_is_written", async () => {
    const d = deps(null);
    expect(await writeStoryCard({ kind: "save", key: KEY, body: "I sit." }, d)).toEqual({
      ok: false,
      error: "not-allowed",
    });
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_304_ac1_blank_too_long_and_unknown_keys_are_refused_before_any_call", async () => {
    const d = deps("admin");
    const refuse = async (write: StoryCardWrite) => (await writeStoryCard(write, d)).ok;
    expect(await refuse({ kind: "save", key: KEY, body: "  " })).toBe(false);
    expect(await refuse({ kind: "save", key: KEY, body: "a".repeat(2001) })).toBe(false);
    expect(await refuse({ kind: "save", key: "ui.F3.fail.body", body: "I sit." })).toBe(false);
    expect(await refuse({ kind: "publish", key: KEY, version: 0 })).toBe(false);
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_304_ac2_a_writer_sets_a_part_title", async () => {
    const d = deps("writer");
    const write = { kind: "title", storyId: "a", part: 2, title: "Find the mesa." } as const;
    expect(await writeStoryCard(write, d)).toEqual({ ok: true });
    expect(d.rpc).toHaveBeenCalledWith("save_story_part_title", {
      story: "a",
      part_number: 2,
      part_title: "Find the mesa.",
    });
    expect((await writeStoryCard({ ...write, title: " " }, d)).ok).toBe(false);
    expect((await writeStoryCard({ ...write, part: 6 }, d)).ok).toBe(false);
  });

  it("test_304_ac5_a_writer_cannot_publish_or_roll_back", async () => {
    const d = deps("writer");
    for (const kind of ["publish", "roll_back"] as const) {
      expect(await writeStoryCard({ kind, key: KEY, version: 2 }, d)).toEqual({
        ok: false,
        error: "not-allowed",
      });
    }
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_304_ac4_the_server_reruns_the_checks_and_refuses_a_failing_draft", async () => {
    const d = deps("admin", ['Mentions a year ("1943"). Years and dates stay in the admin.']);
    expect(await writeStoryCard({ kind: "publish", key: KEY, version: 2 }, d)).toEqual({
      ok: false,
      error: "checks-failed",
      problems: ['Mentions a year ("1943"). Years and dates stay in the admin.'],
    });
    expect(d.checkCard).toHaveBeenCalledWith(KEY, 2);
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_304_ac6_an_admin_publishes_a_passing_draft", async () => {
    const d = deps("admin");
    expect(await writeStoryCard({ kind: "publish", key: KEY, version: 2 }, d)).toEqual({
      ok: true,
    });
    expect(d.rpc).toHaveBeenCalledWith("publish_story_card", { card_key: KEY, card_version: 2 });
  });

  it("test_304_ac6_a_version_that_cannot_be_read_is_not_published", async () => {
    const d = deps("admin", null);
    expect(await writeStoryCard({ kind: "publish", key: KEY, version: 9 }, d)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(d.rpc).not.toHaveBeenCalled();
  });

  it("test_304_ac7_an_admin_rolls_back_without_the_checks", async () => {
    const d = deps("admin", ["anything"]);
    expect(await writeStoryCard({ kind: "roll_back", key: KEY, version: 1 }, d)).toEqual({
      ok: true,
    });
    expect(d.checkCard).not.toHaveBeenCalled();
    expect(d.rpc).toHaveBeenCalledWith("roll_back_story_card", { card_key: KEY, card_version: 1 });
  });

  it("test_304_a_database_error_reads_as_failed", async () => {
    const d = deps("admin");
    d.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await writeStoryCard({ kind: "roll_back", key: KEY, version: 1 }, d)).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

const row = (overrides: Partial<StoryCardRow>): StoryCardRow => ({
  key: KEY,
  version: 1,
  story_id: "a",
  kind: "part",
  part: 1,
  slice: "s1",
  position: 1,
  body: "I sit.",
  published: true,
  published_at: "2026-11-16T00:00:00Z",
  ...overrides,
});
const story = { id: "a", title: "First", sequence: 1 };
const stageZero = {
  slices: [
    { id: "s1", leaks: [] },
    { id: "s3", leaks: ["mesa"] },
  ],
};

describe("ADM-06 editor view (#304)", () => {
  it("test_304_ac1_the_published_version_stays_shown_next_to_a_newer_draft", () => {
    const rows = [
      row({}),
      row({ key: "crd.opp.a.p2.c1", part: 2, slice: "s3", body: "The mesa is high." }),
      row({ version: 2, published: false, published_at: null, body: "I see the mesa." }),
    ];
    const detail = storyDetail(story, [], rows, leaksForStory(rows, stageZero))!;
    const shown = detail.parts[0].cards[0];
    expect(shown).toMatchObject({ version: 1, published: true, body: "I sit.", problems: [] });
    expect(shown.draft).toEqual({
      version: 2,
      body: "I see the mesa.",
      problems: ['Mentions "mesa", which comes in a later part.'],
      warnings: [],
    });
    expect(shown.versions.map((entry) => [entry.version, entry.state])).toEqual([
      [2, "draft"],
      [1, "published"],
    ]);
  });

  it("test_304_ac7_a_version_rolled_back_past_reads_as_earlier_not_draft", () => {
    const rows = [
      row({ published: true }),
      row({ version: 2, published: false, published_at: "2026-11-17T00:00:00Z", body: "I go." }),
    ];
    const shown = storyDetail(story, [], rows, leaksForStory(rows, stageZero))!.parts[0].cards[0];
    expect(shown.draft).toBeNull();
    expect(shown.versions).toEqual([
      { version: 2, body: "I go.", state: "earlier", canRollBack: true },
      { version: 1, body: "I sit.", state: "published", canRollBack: false },
    ]);
  });

  it("test_304_ac3_a_published_card_with_a_year_shows_as_failing", () => {
    const rows = [row({ body: "The winter was 1943 and I was cold." })];
    const shown = storyDetail(story, [], rows, leaksForStory(rows, stageZero))!.parts[0].cards[0];
    expect(shown.problems).toEqual([
      'Mentions a year ("1943"). Years and dates stay in the admin.',
    ]);
  });

  it("test_304_unreadable_story_inputs_block_every_draft", () => {
    const rows = [row({}), row({ version: 2, published: false, published_at: null })];
    const shown = storyDetail(story, [], rows, leaksForStory(rows, null))!.parts[0].cards[0];
    expect(shown.draft?.problems).toEqual([
      "The spoiler check could not run: the story inputs could not be read.",
    ]);
  });
});
