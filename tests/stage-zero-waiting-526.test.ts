import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { storyDetail, type StoryCardRow } from "@/lib/story-cards/admin";
import { isWaitingStageZero, leaksForStory, slicePartsOf } from "@/lib/story-cards/checks";
import { publishProblems } from "@/lib/story-cards/pool-checks";
import {
  readWaitingStageZeros,
  sceneCheckFor,
  storedCardProblems,
  withWaitingStageZeros,
} from "@/lib/story-cards/reader";

// #526: the admin's story page shows what the NEW stage 0 of a story not switched over yet
// (story_inputs.stage_zero_next, read with get_story_stage_zero_next) finds, so the owner sees the
// problems before she switches as they will be after. Publish (the server's re-check) keeps
// checking the LIVE stage 0, which phones read (#533 review I1). Invented rows only.

// The server's story content read and the waiting read, as the reader key would answer them.
const content = vi.hoisted(() => ({ stageZero: {} as Record<string, unknown>, next: {} }));
vi.mock("@/lib/content/repository", () => ({
  getFullStoryContent: async () => ({
    companions: [],
    stories: [{ id: "inv-story", inputs: { stageZero: content.stageZero } }],
  }),
  readStageZeroNextFromSupabase: async () => content.next,
}));

const STORY = "inv-story";
const card = (fields: Partial<StoryCardRow>): StoryCardRow => ({
  key: `crd.opp.${STORY}.p1.c1`,
  version: 1,
  story_id: STORY,
  kind: "part",
  part: 1,
  slice: "s1",
  position: 1,
  body: "Invented card text.",
  published: true,
  published_at: "2026-11-12T00:00:00Z",
  ...fields,
});

// The placeholder cards (published, version 1) put slice s3 in part 2; the new cards (drafts on
// top, and a new key) put it in part 3, as the new stage 0 has one slice per part.
const rows: StoryCardRow[] = [
  card({ key: `crd.opp.${STORY}.p1.c1`, part: 1, slice: "s1" }),
  card({
    key: `crd.opp.${STORY}.p1.c1`,
    version: 2,
    part: 1,
    slice: "s1",
    body: "Invented fix naming Inventaoldleak too early.",
    published: false,
    published_at: null,
  }),
  card({ key: `crd.opp.${STORY}.p2.c1`, part: 2, slice: "s3" }),
  card({
    key: `crd.opp.${STORY}.p2.c1`,
    version: 2,
    part: 2,
    slice: "s2",
    body: "Invented new card naming Inventaleakthree too early.",
    published: false,
    published_at: null,
  }),
  card({
    key: `crd.opp.${STORY}.p3.c1`,
    part: 3,
    slice: "s3",
    published: false,
    published_at: null,
  }),
];

const oldStage = {
  people: {},
  slices: [
    { id: "s1", leaks: [] },
    { id: "s2", leaks: [] },
    { id: "s3", leaks: ["Inventaoldleak"] },
  ],
  steps: [],
  scene: { present: [], allowedWords: ["Invented"], props: [], pauseProp: "x", laterWords: [] },
  voice: "Invented voice.",
};
const newStage = {
  slices: [
    { id: "s1", leaks: [] },
    { id: "s2", leaks: [] },
    { id: "s3", leaks: ["Inventaleakthree"] },
  ],
  steps: [1, 2, 3].map((n) => ({ n, title: `Invented aim ${n}`, covers: [`s${n}`] })),
  scene: { present: [], allowedWords: ["Invented"], props: [], pauseProp: "y", laterWords: [] },
};

describe("#526 the admin checks read the waiting stage 0", () => {
  it("test_526_ac3_a_waiting_stage_0_replaces_slices_steps_and_scene_and_is_marked", () => {
    const zeros = withWaitingStageZeros(new Map([[STORY, oldStage]]), { [STORY]: newStage });
    const merged = zeros.get(STORY)!;
    expect(merged.slices).toEqual(newStage.slices);
    expect(merged.steps).toEqual(newStage.steps);
    expect(merged.scene).toEqual(newStage.scene);
    expect(merged.voice).toBe(oldStage.voice);
    expect(isWaitingStageZero(merged)).toBe(true);
    expect(isWaitingStageZero(oldStage)).toBe(false);
  });

  it("test_526_ac2_a_story_with_no_waiting_stage_0_keeps_its_own", () => {
    const zeros = withWaitingStageZeros(new Map([[STORY, oldStage]]), {});
    expect(zeros.get(STORY)).toBe(oldStage);
    expect(withWaitingStageZeros(new Map([[STORY, oldStage]]), null).get(STORY)).toBe(oldStage);
  });

  it("test_526_ac3_the_waiting_stage_0_reads_its_slices_with_the_new_cards", () => {
    expect(slicePartsOf(rows).get("s3")).toBe(2);
    expect(slicePartsOf(rows, { newSet: true }).get("s3")).toBe(3);
    const zeros = withWaitingStageZeros(new Map([[STORY, oldStage]]), { [STORY]: newStage });
    expect(leaksForStory(rows, zeros.get(STORY)!)(2)).toEqual(["Inventaleakthree"]);
    // The draft of part 2 names the part 3 word: the waiting stage 0 finds it.
    const problems = publishProblems(rows[3], rows, zeros);
    expect(problems).toContain('Mentions "Inventaleakthree", which comes in a later part.');
  });

  it("test_526_ac2_the_live_stage_0_reads_its_slices_with_the_published_cards", () => {
    const zeros = new Map([[STORY, oldStage as Record<string, unknown>]]);
    // The placeholders put s3 in part 2, so its word is not later than part 2.
    expect(leaksForStory(rows, oldStage)(2)).toEqual([]);
    expect(leaksForStory(rows, oldStage)(1)).toEqual(["Inventaoldleak"]);
    expect(publishProblems(rows[3], rows, zeros)).not.toContain(
      'Mentions "Inventaleakthree", which comes in a later part.',
    );
  });
});

/** A stand-in for the editor's client: the card tables with eq and in filters. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>): SupabaseClient {
  return {
    from(table: string) {
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      const answer = () =>
        Promise.resolve({
          data: (tables[table] ?? []).filter((row) => filters.every((keep) => keep(row))),
          error: null,
        });
      const query = {
        select: () => query,
        order: () => query,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return query;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        range: answer,
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          answer().then(resolve, reject),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("#533 review I1 Publish checks the live stage 0 while a new one waits", () => {
  content.stageZero = oldStage;
  content.next = { [STORY]: newStage };
  const client = fakeClient({
    story_cards: rows as unknown as Record<string, unknown>[],
    stories: [{ id: STORY, title: "Invented", sequence: 1, companion_id: "oppenheimer" }],
    story_parts: [],
    companions: [{ id: "oppenheimer", key_code: "opp", short_name: "Invented" }],
  });

  it("test_533_i1_a_fix_to_a_live_card_naming_a_live_later_word_is_refused", async () => {
    // Under the live stage 0 (placeholder s3 in part 2) the part 1 fix names a later word; the
    // waiting stage 0 would not see it.
    const problems = await storedCardProblems(client, `crd.opp.${STORY}.p1.c1`, 2);
    expect(problems).toContain('Mentions "Inventaoldleak", which comes in a later part.');
  });

  it("test_533_i1_a_problem_only_the_waiting_stage_0_finds_does_not_block_publish", async () => {
    const problems = await storedCardProblems(client, `crd.opp.${STORY}.p2.c1`, 2);
    expect(problems).not.toContain('Mentions "Inventaleakthree", which comes in a later part.');
  });

  it("test_533_i1_the_story_page_shows_the_waiting_stage_0_problems_as_after_the_switch_warnings", async () => {
    const live = new Map([[STORY, oldStage as Record<string, unknown>]]);
    const after = await readWaitingStageZeros(live, async () => ({ [STORY]: newStage }));
    expect(after.waiting).toEqual(new Set([STORY]));
    const detail = storyDetail(
      { id: STORY, title: "Invented", sequence: 1 },
      [],
      rows,
      leaksForStory(rows, oldStage),
      sceneCheckFor(live, STORY),
      "opp",
      {
        leaksFor: leaksForStory(rows, after.zeros!.get(STORY)!),
        scene: sceneCheckFor(after.zeros, STORY),
      },
    )!;
    const part2 = detail.parts.find((part) => part.part === 2)!.cards[0];
    expect(part2.draft?.problems).not.toContain(
      'Mentions "Inventaleakthree", which comes in a later part.',
    );
    expect(part2.draft?.afterSwitch).toContain(
      'Mentions "Inventaleakthree", which comes in a later part.',
    );
    const part1 = detail.parts.find((part) => part.part === 1)!.cards[0];
    expect(part1.draft?.problems).toContain(
      'Mentions "Inventaoldleak", which comes in a later part.',
    );
    // Without a waiting stage 0 nothing is shown for after the switch-over.
    const plain = storyDetail(
      { id: STORY, title: "Invented", sequence: 1 },
      [],
      rows,
      leaksForStory(rows, oldStage),
    )!;
    expect(plain.parts[0].cards[0].afterSwitch).toBeUndefined();
  });

  it("test_533_m2_a_failed_waiting_read_is_logged_and_reported", async () => {
    const log = vi.fn();
    const after = await readWaitingStageZeros(
      new Map([[STORY, oldStage as Record<string, unknown>]]),
      async () => {
        throw new Error("no such function");
      },
      log,
    );
    expect(log).toHaveBeenCalledTimes(1);
    expect(after).toEqual({ zeros: null, waiting: new Set(), failed: true });
  });
});
