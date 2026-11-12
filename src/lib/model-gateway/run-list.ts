/**
 * Per-run checks for one-way lines (US-AI-8; docs/ai/AI_03_stuck-story-layer.md section B).
 *
 * A run is one story played across a Goal's Steps. The caller passes the one-way lines already
 * shown in the run, oldest first. The server stores them (for example in `session_lines`); the
 * gateway itself keeps no state between calls.
 *
 * Rules:
 * - `repeat`: the line equals an earlier line, ignoring case, punctuation and spacing.
 * - `opening`: the line starts with the same three words as one of the last four lines.
 * - `similar`: content-word Jaccard similarity with any earlier line is 0.5 or more.
 *
 * Similarity is the Jaccard index of the two lines' sets of content words: lower-case words with
 * punctuation removed and the stop words below dropped, |A ∩ B| / |A ∪ B|. Two lines with no
 * content words have similarity 0. This is stricter than the word 3-gram Jaccard named in the
 * AI spec and matches the row rule RW6 ("no two cards overlap by half their words").
 */

const STOP_WORDS = new Set(
  (
    "a an the and or but so because which that this these those then than " +
    "i me my mine we us our you your he him his she her it its they them their " +
    "am is are was were be been being do does did have has had will would can could " +
    "shall should may might must not no of in on at to from by for with as into onto " +
    "over under up down out off about across along around beside near past through"
  ).split(" "),
);

const DETERMINERS = new Set(
  "the a an my his her its our their your this that these those".split(" "),
);

const RECENT_OPENINGS = 4;
const OPENING_WORDS = 3;
export const SIMILARITY_LIMIT = 0.5;

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

function contentWords(text: string): Set<string> {
  return new Set(wordsOf(text).filter((word) => !STOP_WORDS.has(word)));
}

/** Content-word Jaccard similarity between two lines, from 0 to 1. */
export function similarity(a: string, b: string): number {
  const left = contentWords(a);
  const right = contentWords(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / union.size;
}

function opening(text: string): string | null {
  const words = wordsOf(text);
  return words.length >= OPENING_WORDS ? words.slice(0, OPENING_WORDS).join(" ") : null;
}

/** Rule ids the line breaks against the lines already shown in this run (oldest first). */
export function checkRunList(text: string, earlierLines: string[]): string[] {
  const rejected: string[] = [];
  const normal = wordsOf(text).join(" ");
  if (earlierLines.some((line) => wordsOf(line).join(" ") === normal)) rejected.push("repeat");

  const start = opening(text);
  const recent = earlierLines.slice(-RECENT_OPENINGS);
  if (start !== null && recent.some((line) => opening(line) === start)) rejected.push("opening");

  if (earlierLines.some((line) => similarity(text, line) >= SIMILARITY_LIMIT)) {
    rejected.push("similar");
  }
  return rejected;
}

function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/**
 * Nouns of a card, by a simple heuristic with no part-of-speech tagger: the one or two words
 * that follow a determiner or possessive ("the", "a", "my", "his", "this" and so on), stopping at
 * a stop word or the end of a phrase, with a plural "s" removed. It over-collects (an adjective
 * after "the" counts), which only makes the rule stricter.
 */
export function cardNouns(text: string): string[] {
  const nouns: string[] = [];
  for (const phrase of text.toLowerCase().split(/[.,;:!?"()]+/)) {
    const words = wordsOf(phrase);
    words.forEach((word, index) => {
      if (!DETERMINERS.has(word)) return;
      for (const next of words.slice(index + 1, index + 3)) {
        if (STOP_WORDS.has(next)) break;
        nouns.push(stem(next));
      }
    });
  }
  return [...new Set(nouns)];
}

/** True when a rest moment reuses a noun of the last card in the same Step. */
export function reusesCardNouns(text: string, lastCard: string): boolean {
  const nouns = new Set(cardNouns(lastCard));
  return wordsOf(text).some((word) => nouns.has(stem(word)));
}
