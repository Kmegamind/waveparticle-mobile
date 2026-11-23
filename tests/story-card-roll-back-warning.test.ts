import { describe, expect, it, vi } from "vitest";
import { readStoryDecks, storyCardRows } from "../scripts/story-cards/import.mjs";
import type { StoryCardRow } from "@/lib/story-cards/admin";
import { publishProblems, type PoolCard } from "@/lib/story-cards/pool-checks";
import {
  ROLL_BACK_CHECKS_UNAVAILABLE,
  rollBackWarningText,
  rollBackWarnings,
  startRollBack,
} from "@/lib/story-cards/roll-back-warning";
import { writeStoryCard } from "@/lib/story-cards/write";
import { seedContent } from "./support/seed-content";

// #377, owner decision 2026-11-23 (decision 0028): a story card roll back shows a warning, never a
// block. Before rolling back, the admin's two buttons run the Publish checks (the whole-Story
// checks included) on the version that would become live; with problems the admin confirms, and
// without, the roll back runs at once. The server never refuses a roll back for a check.

const KEY = "crd.opp.eagle-hill-garden.p1.c1";
const STORY = "eagle-hill-garden";

describe("#377 the warning before a story card roll back", () => {
  it("test_377_rollback_problems_ask_for_a_confirm_and_do_not_roll_back_yet", async () => {
    const rollBack = vi.fn(async () => ({ ok: true }));
    const start = await startRollBack(async () => ['Mentions a year ("1943").'], rollBack);
    expect(start).toEqual({ kind: "warn", problems: ['Mentions a year ("1943").'] });
    expect(rollBack).not.toHaveBeenCalled();
  });

  it("test_377_rollback_without_problems_rolls_back_at_once", async () => {
    const rollBack = vi.fn(async () => ({ ok: true }));
    const start = await startRollBack(async () => [], rollBack);
    expect(start).toEqual({ kind: "done", result: { ok: true } });
    expect(rollBack).toHaveBeenCalledTimes(1);
  });

  it("test_377_rollback_a_check_that_fails_to_answer_is_a_warning_not_a_silent_roll_back", async () => {
    const rollBack = vi.fn(async () => ({ ok: true }));
    const start = await startRollBack(async () => {
      throw new Error("network");
    }, rollBack);
    expect(start).toEqual({ kind: "warn", problems: [ROLL_BACK_CHECKS_UNAVAILABLE] });
    expect(rollBack).not.toHaveBeenCalled();
  });

  it("test_377_rollback_confirm_runs_the_roll_back_and_the_server_accepts_it", async () => {
    // Confirm runs the unchanged roll back write: with failing checks it is still not refused.
    const rpc = vi.fn(async () => ({ data: null as unknown, error: null as unknown }));
    const checkCard = vi.fn(async () => ["Repeats part 1, card 2."]);
    const deps = { userId: "u1", role: "admin" as const, rpc, checkCard };
    expect(await rollBackWarnings({ key: KEY, version: 1 }, deps)).toEqual([
      "Repeats part 1, card 2.",
    ]);
    expect(await writeStoryCard({ kind: "roll_back", key: KEY, version: 1 }, deps)).toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith("roll_back_story_card", { card_key: KEY, card_version: 1 });
  });

  it("test_377_rollback_warnings_name_an_unreadable_version_and_only_answer_admins", async () => {
    const checkCard = vi.fn(async () => null);
    expect(
      await rollBackWarnings({ key: KEY, version: 9 }, { userId: "u1", role: "admin", checkCard }),
    ).toEqual([ROLL_BACK_CHECKS_UNAVAILABLE]);
    expect(
      await rollBackWarnings({ key: KEY, version: 1 }, { userId: "u1", role: "writer", checkCard }),
    ).toEqual([]);
    expect(
      await rollBackWarnings({ key: KEY, version: 1 }, { userId: null, role: null, checkCard }),
    ).toEqual([]);
    expect(checkCard).toHaveBeenCalledTimes(1);
  });

  it("test_377_rollback_checks_the_earlier_version_in_place_of_the_live_one_with_the_whole_story", () => {
    // v1 was published, then v2 replaced it; meanwhile card 2 was published with v1's text.
    const rows = (storyCardRows(readStoryDecks()) as { cards: PoolCard[] }).cards
      .filter((card) => card.story_id === STORY)
      .map((card): StoryCardRow => ({
        ...card,
        version: 1,
        published: true,
        published_at: "2026-11-16T00:00:00Z",
      }));
    const v1 = rows.find((row) => row.key === KEY)!;
    v1.published = false;
    const v2: StoryCardRow = {
      ...v1,
      version: 2,
      body: "Haakon waited by the stove.",
      published: true,
    };
    const c2 = rows.find((row) => row.key === "crd.opp.eagle-hill-garden.p1.c2")!;
    c2.body = v1.body;
    const zeros = new Map(seedContent().stories.map((story) => [story.id, story.inputs.stageZero]));
    expect(publishProblems(v1, [...rows, v2], zeros)).toContain(
      "Part 1, card 2 (crd.opp.eagle-hill-garden.p1.c2), a later card of this story, repeats this card.",
    );
  });

  it("test_377_rollback_warning_says_the_version_goes_live_anyway", () => {
    expect(rollBackWarningText(1, 2)).toBe(
      "v1 fails 2 checks. Rolling back puts it live on phones anyway. Roll back anyway?",
    );
    expect(rollBackWarningText(3, 1)).toMatch(/^v3 fails 1 check\./);
  });
});
