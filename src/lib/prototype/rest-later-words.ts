import type { StoryContent } from "@/lib/content/types";
import { spreadCards } from "@/lib/story/start";
import { storyById } from "./story-inputs";

/**
 * The words of what happens later in a Story, for the check on a rest reply (#60,
 * CHAT-SPOILER-CHECK, LEAK-BY-PART). Read from the Story's stage 0 inputs as they are on main:
 *
 * - `laterFacts`: the spoiler words (`leaks`) of the slices in the parts the person has not
 *   reached. A part is a stage 0 step (`steps[].covers`). Which parts a Step reaches follows the
 *   card spread (CARDS-SPREAD, `spreadCards`), with one card per slice standing in for the cards.
 *   Only entries with a capital letter or of several words are used (`isChatLaterFact`): a single
 *   lower-case word ("anyway", "angry") would fail ordinary replies. The data is not changed, and
 *   the card checks still use every entry. Matched in any case, as whole words.
 * - `laterWords`: the scene table's later words (`story.inputs.scene`, #374), matched with their
 *   exact capitals, as whole words.
 *
 * Without a valid position only the first part counts as reached, so nothing later can slip out.
 */

export type StepPosition = { stepIndex: number; stepCount: number };
export type LaterStoryWords = { laterFacts: string[]; laterWords: string[] };

type Slice = { id?: unknown; leaks?: unknown };
type Part = { n?: unknown; covers?: unknown };

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

/** A spoiler entry used in the rest reply check: it has a capital letter or several words. */
export function isChatLaterFact(entry: string): boolean {
  return /\p{Lu}/u.test(entry) || /\s/.test(entry.trim());
}

export function laterStoryWords(
  content: StoryContent,
  storyId: string,
  position: StepPosition | undefined,
): LaterStoryWords {
  const story = storyById(content, storyId);
  const stage = story.inputs.stageZero;
  const laterWords = [...new Set(story.inputs.scene?.laterWords ?? [])];

  const slices = Array.isArray(stage.slices) ? (stage.slices as Slice[]) : [];
  const leaksOf = new Map(
    slices
      .filter((slice) => typeof slice?.id === "string")
      .map((slice) => [slice.id as string, strings(slice.leaks).filter(isChatLaterFact)]),
  );
  const parts = (Array.isArray(stage.steps) ? (stage.steps as Part[]) : [])
    .map((part) => strings(part?.covers).filter((id) => leaksOf.has(id)))
    .filter((covers) => covers.length > 0);
  if (parts.length === 0) return { laterFacts: [], laterWords };

  const { stepIndex, stepCount } = position ?? { stepIndex: 0, stepCount: parts.length };
  const spread = spreadCards<string | null>({ background: null, parts }, stepCount);
  const reachedSlices = new Set(
    spread
      .slice(0, stepIndex + 1)
      .flatMap((step) => [step.opening, ...step.story])
      .filter((id): id is string => id !== null),
  );
  const laterFacts: string[] = [];
  for (const covers of parts) {
    if (covers.some((id) => reachedSlices.has(id))) continue;
    for (const id of covers) {
      for (const word of leaksOf.get(id) ?? []) {
        if (!laterFacts.includes(word)) laterFacts.push(word);
      }
    }
  }
  return { laterFacts, laterWords };
}
