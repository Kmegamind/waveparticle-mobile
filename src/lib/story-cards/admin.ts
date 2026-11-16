// The Stories admin page (ADM-06, #293): the story list with its part and card counts, one story's
// background card and cards grouped by part, and the CARD-LENGTH check that marks a card as
// failing. Read-only; server code only. The rows come from `public.stories`, `public.story_parts`
// and `public.story_cards` through the signed-in editor's own client.

/** One row of `public.stories`, as the page reads it. */
export type StoryRow = { id: string; title: string; sequence: number };

/** One row of `public.story_parts`. */
export type StoryPartRow = { story_id: string; part: number; title: string };

/** One version row of `public.story_cards`. */
export type StoryCardRow = {
  key: string;
  version: number;
  story_id: string;
  kind: "background" | "part";
  part: number | null;
  slice: string | null;
  position: number;
  body: string;
  published: boolean;
};

export type StoryCardView = {
  key: string;
  version: number;
  published: boolean;
  slice: string | null;
  position: number;
  body: string;
  words: number;
  /** CARD-LENGTH problems; empty when the card passes. */
  problems: string[];
};

export type StoryListRow = {
  id: string;
  /** The story's NAMING key (<short>.<slug>). */
  key: string;
  title: string;
  sequence: number;
  parts: number;
  /** Part cards, without the background card. */
  cards: number;
  /** Cards (background included) that fail CARD-LENGTH. */
  failing: number;
};

export type StoryDetail = {
  id: string;
  key: string;
  title: string;
  sequence: number;
  background: StoryCardView | null;
  parts: { part: number; title: string | null; cards: StoryCardView[] }[];
};

/** CARD-LENGTH (LEN-CARD): a part card is 1 to 3 sentences and at most 45 words. */
export const PART_CARD_MAX_WORDS = 45;
export const PART_CARD_MAX_SENTENCES = 3;
/** The background card is at most 70 words. */
export const BACKGROUND_CARD_MAX_WORDS = 70;

/** The Companion's short name in keys (NAMING). Oppenheimer is the only Companion with stories. */
const COMPANION_SHORT = "opp";

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** A full stop after these words does not end a sentence. */
const HONORIFICS = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Gen|Col|Lt|Sgt|Capt)\.$/;

/** Sentences: text up to . ! or ? (with any closing quotes) and a space or the end. */
export function sentenceCount(text: string): number {
  let count = 0;
  let current = "";
  const pieces = text.trim().split(/(?<=[.!?]["”’)]*)\s+/);
  for (const piece of pieces) {
    current = current ? `${current} ${piece}` : piece;
    if (HONORIFICS.test(current)) continue;
    if (current.trim()) count += 1;
    current = "";
  }
  return count;
}

/** The ways one card breaks CARD-LENGTH, in words the admin shows. */
export function cardLengthProblems(kind: StoryCardRow["kind"], text: string): string[] {
  const problems: string[] = [];
  const words = wordCount(text);
  const maxWords = kind === "background" ? BACKGROUND_CARD_MAX_WORDS : PART_CARD_MAX_WORDS;
  if (words > maxWords) problems.push(`${words} words; the limit is ${maxWords}.`);
  if (kind === "part") {
    const sentences = sentenceCount(text);
    if (sentences > PART_CARD_MAX_SENTENCES) {
      problems.push(`${sentences} sentences; the limit is ${PART_CARD_MAX_SENTENCES}.`);
    }
  }
  return problems;
}

/** Each card's shown version: the published one, otherwise the newest. */
function shownVersions(cards: StoryCardRow[]): StoryCardRow[] {
  const byKey = new Map<string, StoryCardRow>();
  for (const row of cards) {
    const held = byKey.get(row.key);
    if (
      !held ||
      (row.published && !held.published) ||
      (row.published === held.published && row.version > held.version)
    ) {
      byKey.set(row.key, row);
    }
  }
  return [...byKey.values()];
}

const view = (row: StoryCardRow): StoryCardView => ({
  key: row.key,
  version: row.version,
  published: row.published,
  slice: row.slice,
  position: row.position,
  body: row.body,
  words: wordCount(row.body),
  problems: cardLengthProblems(row.kind, row.body),
});

/** One story's background card and parts, from all rows. */
export function storyDetail(
  story: StoryRow,
  parts: StoryPartRow[],
  cards: StoryCardRow[],
): StoryDetail | null {
  if (!story) return null;
  const shown = shownVersions(cards.filter((row) => row.story_id === story.id));
  const background = shown.find((row) => row.kind === "background");
  const titles = new Map(
    parts.filter((row) => row.story_id === story.id).map((row) => [row.part, row.title]),
  );
  const partCards = shown.filter((row) => row.kind === "part" && row.part !== null);
  const numbers = [...new Set([...titles.keys(), ...partCards.map((row) => row.part!)])].sort(
    (left, right) => left - right,
  );
  return {
    id: story.id,
    key: `${COMPANION_SHORT}.${story.id}`,
    title: story.title,
    sequence: story.sequence,
    background: background ? view(background) : null,
    parts: numbers.map((part) => ({
      part,
      title: titles.get(part) ?? null,
      cards: partCards
        .filter((row) => row.part === part)
        .sort((left, right) => left.position - right.position)
        .map(view),
    })),
  };
}

/** Every story in story order, with its number of parts and cards. */
export function storyList(
  stories: StoryRow[],
  parts: StoryPartRow[],
  cards: StoryCardRow[],
): StoryListRow[] {
  return [...stories]
    .sort((left, right) => left.sequence - right.sequence)
    .map((story) => {
      const detail = storyDetail(story, parts, cards)!;
      const all = [
        ...(detail.background ? [detail.background] : []),
        ...detail.parts.flatMap((part) => part.cards),
      ];
      return {
        id: detail.id,
        key: detail.key,
        title: detail.title,
        sequence: detail.sequence,
        parts: detail.parts.length,
        cards: detail.parts.reduce((sum, part) => sum + part.cards.length, 0),
        failing: all.filter((entry) => entry.problems.length > 0).length,
      };
    });
}
