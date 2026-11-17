import { BANNED } from "@/lib/model-gateway/checks";
import { cardLengthProblems, type LeaksFor, type StoryCardRow } from "./admin";

// The checks the admin runs on every save of a story card (#304), each failure in plain words:
// CARD-LENGTH (LEN-CARD), no year, date or age (DATES-ADMIN-ONLY), the spoiler check against the
// parts after the card's own part (LEAK-BY-PART) and the banned words already in code. A card with
// any problem cannot be published. Server code only.

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const YEAR = /\b(?:1[5-9]\d\d|20\d\d)s?\b/;
// "May 3", "3 May", "the 4th of July", "3/5" or "3/5/1943". "May" alone is a word, not a date.
const DATE = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b`,
  "i",
);
const AGE =
  /\b(?:\d{1,3}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)[- ]years?[- ]old\b|\b(?:aged|at the age of)\s+\d{1,3}\b/i;

/** A year, a date or an age in the text (DATES-ADMIN-ONLY). */
export function datesProblems(text: string): string[] {
  const problems: string[] = [];
  const year = text.match(YEAR);
  if (year) problems.push(`Mentions a year ("${year[0]}"). Years and dates stay in the admin.`);
  const date = text.match(DATE);
  if (date) problems.push(`Mentions a date ("${date[0]}"). Years and dates stay in the admin.`);
  const age = text.match(AGE);
  if (age) problems.push(`Mentions an age ("${age[0]}"). Ages stay in the admin.`);
  return problems;
}

type Slice = { id?: unknown; leaks?: unknown };

/**
 * LEAK-BY-PART: the spoiler words (`leaks`) of the story-input slices whose cards sit in a part
 * after `part`, in slice order. The background card (`part` null) comes before part 1. A slice
 * with no card is in no part and adds nothing.
 */
export function laterPartLeaks(
  stageZero: Record<string, unknown>,
  slicePart: Map<string, number>,
  part: number | null,
): string[] {
  const slices = Array.isArray(stageZero.slices) ? (stageZero.slices as Slice[]) : [];
  const after = part ?? 0;
  const words: string[] = [];
  for (const slice of slices) {
    if (typeof slice?.id !== "string") continue;
    const at = slicePart.get(slice.id);
    if (at === undefined || at <= after || !Array.isArray(slice.leaks)) continue;
    for (const word of slice.leaks) {
      if (typeof word === "string" && word.trim() && !words.includes(word)) words.push(word);
    }
  }
  return words;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, word: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(word.trim())}(?![\\p{L}\\p{N}])`, "iu").test(text);

export const LEAKS_UNREADABLE =
  "The spoiler check could not run: the story inputs could not be read.";

/**
 * Every problem of one card's text, in plain words; empty when it may be published. `laterLeaks`
 * is null when the story inputs could not be read, which blocks the card.
 */
export function cardProblems(
  card: { kind: "background" | "part"; part: number | null; body: string },
  laterLeaks: string[] | null,
): string[] {
  const problems = [...cardLengthProblems(card.kind, card.body), ...datesProblems(card.body)];
  if (laterLeaks === null) problems.push(LEAKS_UNREADABLE);
  else {
    for (const word of laterLeaks) {
      if (mentions(card.body, word))
        problems.push(`Mentions "${word}", which comes in a later part.`);
    }
  }
  const banned = card.body.match(BANNED);
  if (banned) problems.push(`Uses a banned word ("${banned[0]}").`);
  return problems;
}

/** Which part each slice's cards sit in, from a story's card rows (every version). */
export function slicePartsOf(cards: StoryCardRow[]): Map<string, number> {
  const parts = new Map<string, number>();
  for (const row of cards) {
    if (row.kind === "part" && row.slice && row.part !== null && !parts.has(row.slice)) {
      parts.set(row.slice, row.part);
    }
  }
  return parts;
}

/** The spoiler words of one story by part; every part answers null without its story inputs. */
export function leaksForStory(
  cards: StoryCardRow[],
  stageZero: Record<string, unknown> | null,
): LeaksFor {
  if (!stageZero) return () => null;
  const slicePart = slicePartsOf(cards);
  return (part) => laterPartLeaks(stageZero, slicePart, part);
}
