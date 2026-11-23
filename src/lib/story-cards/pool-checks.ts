import { checkRunList } from "@/lib/model-gateway/run-list";
import { companionPeople, sceneCheckOf } from "@/lib/content/scene";
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
const storyOrder = (
  left: Pick<PoolCard, "part" | "position">,
  right: Pick<PoolCard, "part" | "position">,
) => (left.part ?? 0) - (right.part ?? 0) || left.position - right.position;

/**
 * Every problem of a pool, as "<card key>: <problem>"; empty when every card passes. A story
 * whose stage 0 inputs are missing cannot run the spoiler check or the scene person check (#381:
 * people named who are not in its scene table), so its cards fail.
 */
export function storyPoolProblems(
  cards: PoolCard[],
  stageZeros: Map<string, Record<string, unknown>>,
): string[] {
  const problems: string[] = [];
  const people = companionPeople(stageZeros.values());
  const stories = [...new Set(cards.map((card) => card.story_id))];
  for (const storyId of stories) {
    const own = cards.filter((card) => card.story_id === storyId).sort(storyOrder);
    const rows = own.map((card) => ({ ...card, version: 1, published: true, published_at: null }));
    const leaks = leaksForStory(rows, stageZeros.get(storyId) ?? null);
    const scene = sceneCheckOf(stageZeros.get(storyId), people);
    const earlier: string[] = [];
    for (const card of own) {
      for (const problem of cardProblems(card, leaks(card.part), scene)) {
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

// #377: the same repeated-lines rules on admin Publish and on every saved draft. A version is read
// in its Story's published cards, in story order, in the place of the card's own published
// version. It fails when it repeats an earlier card (the same text, the same first three words as
// one of the four cards before it, or a near repeat), and when a later card would repeat it.
// Problems between two other cards of the Story do not block this card: they are shown on those
// cards.

/** A card version as the whole-Story check reads it. */
export type StoryPoolCard = Pick<StoryCardRow, "key" | "kind" | "part" | "position" | "body">;

/** "the background card (key)" or "part 2, card 1 (key)". */
function cardName(card: StoryPoolCard): string {
  const name =
    card.kind === "background" ? "the background card" : `part ${card.part}, card ${card.position}`;
  return `${name} (${card.key})`;
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** How many cards before another the "same first three words" rule looks (the run-list rule). */
const OPENING_WINDOW = 4;

/** The rules `later` breaks against `earlier`, `distance` cards before it; a repeat is only that. */
function pairRules(later: string, earlier: string, distance: number): string[] {
  const rules = checkRunList(later, [earlier]).filter(
    (rule) => rule !== "opening" || distance <= OPENING_WINDOW,
  );
  return rules.includes("repeat") ? ["repeat"] : rules;
}

/**
 * The whole-Story problems of one card version against the Story's published cards (#377), in
 * plain words that name the other card and the rule. `published` may hold the card's own
 * published version; it is replaced by `card`.
 */
export function storyRepeatProblems(card: StoryPoolCard, published: StoryPoolCard[]): string[] {
  const pool = [...published.filter((other) => other.key !== card.key), card].sort(storyOrder);
  const at = pool.indexOf(card);
  const problems: string[] = [];
  for (let index = 0; index < at; index++) {
    const earlier = pool[index];
    for (const rule of pairRules(card.body, earlier.body, at - index)) {
      const name = cardName(earlier);
      problems.push(
        rule === "repeat"
          ? `Repeats ${name}, an earlier card of this story.`
          : rule === "opening"
            ? `Opens with the same three words as ${name}, one of the four cards before it.`
            : `Is close to ${name}, an earlier card of this story.`,
      );
    }
  }
  for (let index = at + 1; index < pool.length; index++) {
    const later = pool[index];
    for (const rule of pairRules(later.body, card.body, index - at)) {
      const name = `${capitalised(cardName(later))}, a later card of this story,`;
      problems.push(
        rule === "repeat"
          ? `${name} repeats this card.`
          : rule === "opening"
            ? `${name} opens with the same three words as this card.`
            : `${name} is close to this card.`,
      );
    }
  }
  return problems;
}

/**
 * Every problem that stops one stored card version from being published (#377): the card checks
 * of #304 (with the scene person check, #374) and the whole-Story checks against the published
 * cards of its Story. `storyCards` are the Story's rows, every version; `stageZeros` null when the
 * story inputs could not be read, which blocks the card.
 */
export function publishProblems(
  row: StoryCardRow,
  storyCards: StoryCardRow[],
  stageZeros: Map<string, Record<string, unknown>> | null,
): string[] {
  const own = storyCards.filter((card) => card.story_id === row.story_id);
  const leaks = leaksForStory(own, stageZeros?.get(row.story_id) ?? null);
  const scene = stageZeros
    ? sceneCheckOf(stageZeros.get(row.story_id), companionPeople(stageZeros.values()))
    : null;
  return [
    ...cardProblems(row, leaks(row.part), scene),
    ...storyRepeatProblems(
      row,
      own.filter((card) => card.published),
    ),
  ];
}
