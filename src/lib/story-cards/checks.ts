import { BANNED } from "@/lib/model-gateway/checks";
import { cardLengthProblems, type LeaksFor, type StoryCardRow } from "./admin";

// The checks the admin runs on every save of a story card (#304), each failure in plain words:
// CARD-LENGTH (LEN-CARD), no year, date or age (DATES-ADMIN-ONLY), the spoiler check against the
// parts after the card's own part (LEAK-BY-PART) and the banned words already in code. A card with
// any problem cannot be published. Server code only.

import { datesProblems } from "@/lib/content/dates";

// A year, a date or an age in the text (DATES-ADMIN-ONLY): shared with the Companion and story
// fields (#309) and re-exported here for the card checks.
export { datesProblems };

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
/** Curly quotes as straight ones, so text pasted from a word processor or a phone still matches. */
const plainQuotes = (text: string) => text.replace(/[‘’ʼ′]/g, "'").replace(/[“”″]/g, '"');
/** A spoiler word or phrase on word boundaries; any run of spaces or line breaks between words. */
const mentions = (text: string, word: string) => {
  const phrase = plainQuotes(word.trim()).split(/\s+/).map(escape).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "iu").test(plainQuotes(text));
};

// US-FMT-4 (#16, D2): a card is reread alone, so it may not lean on the card before it.
const POINTER_OPENER = /^[\s"'“‘(]*(he|she|it|this)(?![\p{L}\p{N}'’])/iu;
const POINTER_WORDS =
  /(?<![\p{L}\p{N}])(again|another|as\s+I\s+said|the\s+same|that\s+one)(?![\p{L}\p{N}])/iu;

/** A card that opens with He, She, It or This, or points at another card (#16). */
function selfContainedProblems(body: string): string[] {
  const problems: string[] = [];
  const opener = body.match(POINTER_OPENER);
  if (opener) {
    problems.push(
      `Opens with "${opener[1]}". Name who or what you mean, so the card reads on its own.`,
    );
  }
  const pointer = body.match(POINTER_WORDS);
  if (pointer) {
    const phrase = pointer[1].replace(/\s+/g, " ");
    problems.push(`Uses "${phrase}", which points at another card. The card must read on its own.`);
  }
  return problems;
}

// US-FMT-11 (#13, M2): only the background card introduces the people who are present. A short,
// explicit list of introduction phrases; a part card that carries one fails.
const INTRODUCTION_PHRASES = [
  "my name is",
  "I am J. Robert Oppenheimer",
  "I'm J. Robert Oppenheimer",
  "I am Robert Oppenheimer",
  "I'm Robert Oppenheimer",
  "let me introduce",
  "allow me to introduce",
];

const isLetter = (character: string | undefined) =>
  character !== undefined && /[\p{L}\p{N}]/u.test(character);

/**
 * The text with every quoted line blanked out (#365): a line in quotation marks is dialogue, not
 * the character introducing himself. Straight and curly, double and single quotes; an apostrophe
 * inside a word (don't, Oppenheimer's) is not a quote, and a quote that is never closed hides
 * nothing.
 */
export function withoutQuotedSpeech(text: string): string {
  const chars = Array.from(text);
  let double: { at: number; curly: boolean } | null = null;
  let single: number | null = null;
  const blank = (from: number, to: number) => {
    for (let i = from; i <= to; i++) chars[i] = " ";
  };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "“" || (c === '"' && double === null)) double = { at: i, curly: c === "“" };
    else if ((c === "”" && double?.curly) || (c === '"' && double && !double.curly)) {
      blank(double.at, i);
      double = null;
      single = null;
    } else if (c === "'" || c === "‘" || c === "’") {
      const previous = chars[i - 1];
      const next = chars[i + 1];
      if (isLetter(previous) && isLetter(next)) continue; // inside a word
      const opens =
        c === "‘" || (c !== "’" && !isLetter(previous) && next !== undefined && !/\s/.test(next));
      if (single === null && opens) single = i;
      else if (single !== null && !opens) {
        // A quote that closes: it ends a word and is not a possessive (boys' lab). After a letter
        // it counts only at the end of the text or before punctuation; otherwise a stray opener
        // could pair with a later possessive and hide a real introduction.
        const afterLetterOk = next === undefined || /[,.;:!?)\]]/.test(next);
        if (!isLetter(next) && (!isLetter(previous) || afterLetterOk)) {
          blank(single, i);
          single = null;
        }
      }
    }
  }
  return chars.join("");
}

/** An introduction phrase in a part card; the background card is exempt (M2). */
function introductionProblems(card: { kind: "background" | "part"; body: string }): string[] {
  if (card.kind === "background") return [];
  const spoken = withoutQuotedSpeech(card.body);
  const phrase = INTRODUCTION_PHRASES.find((candidate) => mentions(spoken, candidate));
  return phrase ? [`Introduces someone ("${phrase}"). Only the background card does that.`] : [];
}

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
  const problems = [
    ...cardLengthProblems(card.kind, card.body),
    ...datesProblems(card.body),
    ...selfContainedProblems(card.body),
    ...introductionProblems(card),
  ];
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
