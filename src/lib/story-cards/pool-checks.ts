import { checkRunList } from "@/lib/model-gateway/run-list";
import { cardProblems, leaksForStory } from "./checks";
import type { StoryCardRow } from "./admin";

// #46 (US-CON-12): the card checks on a whole pool of cards, one story at a time, as the pull
// request checks run them on the seed (`npm run check:cards`). Each card passes the checks the
// admin runs on every save (#304), and, read in story order, does not repeat an earlier card of
// its story (the per-run list rules of #44). There is no human review gate (PUBLISH-FIRST).

/** A card as the import writes it (`scripts/story-cards/import.mjs`). */
export type PoolCard = Pick<
  StoryCardRow,
  "key" | "story_id" | "kind" | "part" | "slice" | "position" | "body"
>;

const REPEATS: Record<string, string> = {
  repeat: "Repeats an earlier card of this story.",
  opening: "Opens with the same three words as one of the four cards before it.",
  similar: "Is close to an earlier card of this story.",
};

/** Background card first, then the parts in order, each part's cards by position. */
const storyOrder = (left: PoolCard, right: PoolCard) =>
  (left.part ?? 0) - (right.part ?? 0) || left.position - right.position;

/**
 * Every problem of a pool, as "<card key>: <problem>"; empty when every card passes. A story
 * whose stage 0 inputs are missing cannot run the spoiler check, so its cards fail.
 */
export function storyPoolProblems(
  cards: PoolCard[],
  stageZeros: Map<string, Record<string, unknown>>,
): string[] {
  const problems: string[] = [];
  const stories = [...new Set(cards.map((card) => card.story_id))];
  for (const storyId of stories) {
    const own = cards.filter((card) => card.story_id === storyId).sort(storyOrder);
    const rows = own.map((card) => ({ ...card, version: 1, published: true, published_at: null }));
    const leaks = leaksForStory(rows, stageZeros.get(storyId) ?? null);
    const earlier: string[] = [];
    for (const card of own) {
      for (const problem of cardProblems(card, leaks(card.part))) {
        problems.push(`${card.key}: ${problem}`);
      }
      for (const rule of checkRunList(card.body, earlier)) {
        problems.push(`${card.key}: ${REPEATS[rule] ?? rule}`);
      }
      earlier.push(card.body);
    }
  }
  return problems;
}
