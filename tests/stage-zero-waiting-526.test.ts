import { describe, expect, it } from "vitest";
import type { StoryCardRow } from "@/lib/story-cards/admin";
import { isWaitingStageZero, leaksForStory, slicePartsOf } from "@/lib/story-cards/checks";
import { publishProblems } from "@/lib/story-cards/pool-checks";
import { withWaitingStageZeros } from "@/lib/story-cards/reader";

// #526: the admin's card checks read the NEW stage 0 of a story that is not switched over yet
// (story_inputs.stage_zero_next, read with get_story_stage_zero_next), so the owner sees the
// problems before she switches as they will be after. Invented rows only.

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
    // The draft of part 2 names the part 3 word: blocked before the switch-over, as after it.
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
