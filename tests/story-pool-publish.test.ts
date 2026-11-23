import { describe, expect, it } from "vitest";
import { readStoryDecks, storyCardRows } from "../scripts/story-cards/import.mjs";
import { companionPeople, sceneCheckOf, unseenPeople } from "@/lib/content/scene";
import { storyDetail, storyList, type StoryCardRow } from "@/lib/story-cards/admin";
import { leaksForStory } from "@/lib/story-cards/checks";
import { publishProblems, storyRepeatProblems, type PoolCard } from "@/lib/story-cards/pool-checks";
import { writeStoryCard } from "@/lib/story-cards/write";
import { seedContent } from "./support/seed-content";

// #377: the whole-Story checks (repeated lines in story order, #46) run on admin Publish and on
// every saved draft, against the Story's published cards with the new version in its place. The
// per-card checks (#304, the scene person check #374) still run with them.

const STORY = "eagle-hill-garden";
const C1 = `crd.opp.${STORY}.p1.c1`;
const C2 = `crd.opp.${STORY}.p1.c2`;

const zeros = new Map(seedContent().stories.map((story) => [story.id, story.inputs.stageZero]));
const publishSceneOf = (id: string) => sceneCheckOf(zeros.get(id), companionPeople(zeros.values()));

/** The seed pool as the database holds it after the import: every card as v1, published. */
function seedRows(): StoryCardRow[] {
  return (storyCardRows(readStoryDecks()) as { cards: PoolCard[] }).cards.map((card) => ({
    ...card,
    version: 1,
    published: true,
    published_at: "2026-11-16T00:00:00Z",
  }));
}

const storyRows = (rows = seedRows()) => rows.filter((row) => row.story_id === STORY);
const bodyOf = (rows: StoryCardRow[], key: string) => rows.find((row) => row.key === key)!.body;

/** A new draft version of `key` with `body`, added to the story's rows. */
function withDraft(rows: StoryCardRow[], key: string, body: string) {
  const current = rows.find((row) => row.key === key)!;
  const draft: StoryCardRow = {
    ...current,
    version: 2,
    body,
    published: false,
    published_at: null,
  };
  return { rows: [...rows, draft], draft };
}

describe("#377 AC1 the whole-Story checks on Publish", () => {
  it("test_377_ac1_a_version_that_repeats_an_earlier_card_cannot_be_published", () => {
    const rows = storyRows();
    const { rows: all, draft } = withDraft(rows, C2, bodyOf(rows, C1));
    expect(publishProblems(draft, all, zeros)).toContain(
      `Repeats part 1, card 1 (${C1}), an earlier card of this story.`,
    );
  });

  it("test_377_ac1_a_version_that_opens_like_one_of_the_four_cards_before_cannot_be_published", () => {
    const rows = storyRows();
    // Part 2, card 1 opens "I said we should step outside" ...; part 2, card 2 is three cards on.
    const key = `crd.opp.${STORY}.p2.c2`;
    const { rows: all, draft } = withDraft(rows, key, "I said we should wait by the gate.");
    expect(publishProblems(draft, all, zeros)).toContain(
      `Opens with the same three words as part 2, card 1 (crd.opp.${STORY}.p2.c1), one of the four cards before it.`,
    );
  });

  it("test_377_ac1_the_same_opening_further_back_than_four_cards_is_allowed", () => {
    const rows = storyRows();
    // Part 4, card 1 sits six cards after part 2, card 1.
    const key = `crd.opp.${STORY}.p4.c1`;
    const { rows: all, draft } = withDraft(rows, key, "I said we should wait by the gate.");
    expect(publishProblems(draft, all, zeros).join("\n")).not.toMatch(/same three words/);
  });

  it("test_377_ac1_a_near_repeat_of_an_earlier_card_cannot_be_published", () => {
    const rows = storyRows();
    const near = bodyOf(rows, C1).replace("old friends", "older friends");
    const { rows: all, draft } = withDraft(rows, C2, near);
    expect(publishProblems(draft, all, zeros)).toContain(
      `Is close to part 1, card 1 (${C1}), an earlier card of this story.`,
    );
  });

  it("test_377_ac1_a_version_that_a_later_card_would_repeat_cannot_be_published", () => {
    const rows = storyRows();
    const { rows: all, draft } = withDraft(rows, C1, bodyOf(rows, C2));
    expect(publishProblems(draft, all, zeros)).toContain(
      `Part 1, card 2 (${C2}), a later card of this story, repeats this card.`,
    );
  });

  it("test_377_ac1_the_cards_own_published_text_is_replaced_not_compared", () => {
    const rows = storyRows();
    const edited = bodyOf(rows, C1).replace("old friends", "older friends");
    const { rows: all, draft } = withDraft(rows, C1, edited);
    expect(publishProblems(draft, all, zeros)).toEqual([]);
  });

  it("test_377_ac1_drafts_and_earlier_versions_of_other_cards_are_not_in_the_pool", () => {
    const rows = storyRows();
    const text = "Haakon stood by the kitchen door with his hat in his hands.";
    const first = withDraft(rows, C1, text); // a draft of card 1, never published
    const second = withDraft(first.rows, C2, text);
    expect(publishProblems(second.draft, second.rows, zeros)).toEqual([]);
  });

  it("test_377_ac1_a_problem_between_two_other_cards_does_not_block_this_card", () => {
    const rows = storyRows();
    const c3 = `crd.opp.${STORY}.p2.c1`;
    // Card 2 already repeats card 1 (as a card published before the checks could); card 3 is fine.
    const broken = rows.map((row) => (row.key === C2 ? { ...row, body: bodyOf(rows, C1) } : row));
    const { rows: all, draft } = withDraft(broken, c3, "I led Haakon past the roses.");
    expect(publishProblems(draft, all, zeros)).toEqual([]);
  });

  it("test_377_ac1_the_per_card_checks_still_run_with_the_whole_story_checks", () => {
    const rows = storyRows();
    const { rows: all, draft } = withDraft(rows, C2, "In 1943 Haakon came to the kitchen door.");
    expect(publishProblems(draft, all, zeros)).toEqual([
      'Mentions a year ("1943"). Years and dates stay in the admin.',
    ]);
  });

  it("test_377_ac1_the_scene_person_check_runs_on_publish", () => {
    const rows = storyRows();
    const scene = publishSceneOf(STORY)!;
    const absent = scene.people.find((name) => unseenPeople(name, scene).length > 0)!;
    const { rows: all, draft } = withDraft(rows, C2, `${absent} waited by the kitchen door.`);
    expect(publishProblems(draft, all, zeros)).toContain(
      `Names "${absent}", who is not in this story's scene table.`,
    );
  });

  it("test_377_ac1_without_story_inputs_the_card_is_blocked", () => {
    const rows = storyRows();
    const { rows: all, draft } = withDraft(rows, C2, "Haakon waited by the stove.");
    expect(publishProblems(draft, all, null).length).toBeGreaterThan(0);
  });

  it("test_377_ac1_the_server_refuses_publish_and_names_the_card_and_the_rule", async () => {
    const rows = storyRows();
    const { rows: all, draft } = withDraft(rows, C2, bodyOf(rows, C1));
    let called = false;
    const result = await writeStoryCard(
      { kind: "publish", key: C2, version: 2 },
      {
        userId: "u1",
        role: "admin",
        rpc: async () => {
          called = true;
          return { data: null, error: null };
        },
        checkCard: async () => publishProblems(draft, all, zeros),
      },
    );
    expect(called).toBe(false);
    expect(result).toMatchObject({ ok: false, error: "checks-failed" });
    expect(result.ok ? [] : result.problems).toContain(
      `Repeats part 1, card 1 (${C1}), an earlier card of this story.`,
    );
  });

  it("test_377_ac1_the_repeat_messages_name_the_background_card", () => {
    const background: PoolCard = {
      key: "crd.opp.a.bg",
      story_id: "a",
      kind: "background",
      part: null,
      slice: null,
      position: 1,
      body: "I am at the lab and the night is long.",
    };
    const card: PoolCard = {
      ...background,
      key: "crd.opp.a.p1.c1",
      kind: "part",
      part: 1,
      slice: "s1",
    };
    expect(storyRepeatProblems(card, [background])).toEqual([
      "Repeats the background card (crd.opp.a.bg), an earlier card of this story.",
    ]);
    expect(storyRepeatProblems(background, [card])).toEqual([
      "Part 1, card 1 (crd.opp.a.p1.c1), a later card of this story, repeats this card.",
    ]);
  });
});

describe("#377 AC2 the same problems on a saved draft", () => {
  it("test_377_ac2_the_editor_shows_the_whole_story_problems_on_the_draft", () => {
    const rows = storyRows();
    const { rows: all } = withDraft(rows, C2, bodyOf(rows, C1));
    const story = { id: STORY, title: "The Garden at Eagle Hill", sequence: 1 };
    const detail = storyDetail(story, [], all, leaksForStory(all, zeros.get(STORY)!))!;
    const shown = detail.parts[0].cards.find((card) => card.key === C2)!;
    expect(shown.problems).toEqual([]);
    expect(shown.draft?.problems).toContain(
      `Repeats part 1, card 1 (${C1}), an earlier card of this story.`,
    );
  });

  it("test_377_ac2_a_published_card_that_repeats_an_earlier_one_shows_as_failing", () => {
    const rows = storyRows().map((row) =>
      row.key === C2 ? { ...row, body: bodyOf(storyRows(), C1) } : row,
    );
    const story = { id: STORY, title: "The Garden at Eagle Hill", sequence: 1 };
    const detail = storyDetail(story, [], rows, leaksForStory(rows, zeros.get(STORY)!))!;
    const [first, second] = detail.parts[0].cards;
    expect(second.problems).toContain(
      `Repeats part 1, card 1 (${C1}), an earlier card of this story.`,
    );
    expect(first.problems).toContain(
      `Part 1, card 2 (${C2}), a later card of this story, repeats this card.`,
    );
  });
});

describe("#377 AC4 ADM-06 after the seed text is published", () => {
  it("test_377_ac4_no_published_card_of_the_seed_pool_is_marked_as_failing", () => {
    const rows = seedRows();
    const stories = [...new Set(rows.map((row) => row.story_id))].map((id, index) => ({
      id,
      title: id,
      sequence: index + 1,
    }));
    const list = storyList(
      stories,
      [],
      rows,
      (id) =>
        leaksForStory(
          rows.filter((row) => row.story_id === id),
          zeros.get(id) ?? null,
        ),
      (id) => publishSceneOf(id),
    );
    expect(list).toHaveLength(26);
    expect(list.filter((row) => row.failing > 0)).toEqual([]);
  });
});
