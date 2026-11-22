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

type Slice = { id?: unknown; leaks?: unknown; facts?: unknown };
type Part = { n?: unknown; covers?: unknown };

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

/** A spoiler entry used in the rest reply check: it has a capital letter or several words. */
export function isChatLaterFact(entry: string): boolean {
  return /\p{Lu}/u.test(entry) || /\s/.test(entry.trim());
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The capitalised form of a single lower-case spoiler entry ("heisenberg" -> "Heisenberg") when the
 * Story treats it as a name: it is in the scene's people present or the Story's `people`, or it is
 * written with a capital in mid-sentence (after a lower-case letter or a comma) in the Story's own
 * facts. `allowedWords` alone is not a source (it holds sentence starters such as "It" or "Now").
 * Null when it is an ordinary word.
 */
function nameForm(entry: string, names: Set<string>, storyText: string): string | null {
  const word = entry.trim();
  if (isChatLaterFact(word) || word.length === 0) return null;
  const capital = word[0].toUpperCase() + word.slice(1);
  if (names.has(capital)) return capital;
  const midSentence = new RegExp(`[\\p{Ll},]\\s+${escape(capital)}(?![\\p{L}\\p{N}])`, "u");
  return midSentence.test(storyText) ? capital : null;
}

export function laterStoryWords(
  content: StoryContent,
  storyId: string,
  position: StepPosition | undefined,
): LaterStoryWords {
  const story = storyById(content, storyId);
  const stage = story.inputs.stageZero;
  const laterWords: string[] = [...new Set(story.inputs.scene?.laterWords ?? [])];

  const slices = Array.isArray(stage.slices) ? (stage.slices as Slice[]) : [];
  // The names of the Story: people present, its people, and names written mid-sentence in its facts.
  const people = stage.people;
  const names = new Set([
    ...(story.inputs.scene?.present ?? []),
    ...(Array.isArray(people) ? strings(people) : Object.keys(people ?? {})),
  ]);
  const storyText = [
    ...story.inputs.facts.map((fact) => fact.text),
    ...slices.flatMap((slice) => strings(slice?.facts)),
  ].join(" ");
  const leaksOf = new Map(
    slices
      .filter((slice) => typeof slice?.id === "string")
      .map((slice) => [slice.id as string, strings(slice.leaks)]),
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
        if (isChatLaterFact(word)) {
          if (!laterFacts.includes(word)) laterFacts.push(word);
          continue;
        }
        // A dropped single lower-case entry comes back as a name, with its capitals.
        const name = nameForm(word, names, storyText);
        if (name && !laterWords.includes(name)) laterWords.push(name);
      }
    }
  }
  return { laterFacts, laterWords };
}
