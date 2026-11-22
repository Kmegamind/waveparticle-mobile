import type { SceneCheck } from "@/lib/content/scene";
import { cardProblems } from "./checks";

// The Stories admin page (ADM-06, #293): the story list with its part and card counts, one story's
// background card and cards grouped by part, each card's versions and newer draft (#304), and the
// card checks that mark a version as failing (src/lib/story-cards/checks.ts). Server code only. The rows come from `public.stories`, `public.story_parts`
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
  /** The last time this version became the published one; null for a draft never published. */
  published_at: string | null;
};

export type StoryCardVersionState = "published" | "draft" | "earlier";

/**
 * For one story: the spoiler words after a part (null part: the background card), or null when
 * the story inputs could not be read (#304, LEAK-BY-PART).
 */
export type LeaksFor = (part: number | null) => string[] | null;

export type StoryCardView = {
  key: string;
  version: number;
  published: boolean;
  slice: string | null;
  position: number;
  body: string;
  words: number;
  /** The shown version's problems (the #304 checks); empty when it passes. */
  problems: string[];
  kind: StoryCardRow["kind"];
  part: number | null;
  /** The newest version above the published one that was never published, with its problems. */
  draft: { version: number; body: string; problems: string[] } | null;
  /** Newest first. Roll back is offered on every version that was published before. */
  versions: {
    version: number;
    body: string;
    state: StoryCardVersionState;
    canRollBack: boolean;
  }[];
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
  /** Whether the story has a background card. */
  background: boolean;
  /** Cards (background included) whose shown version fails a check (#304). */
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

const noLeaks: LeaksFor = () => [];

/** One card: its shown version, a newer draft and every version (#304). */
function view(
  row: StoryCardRow,
  all: StoryCardRow[],
  leaksFor: LeaksFor,
  scene: SceneCheck | null | undefined,
): StoryCardView {
  const problemsOf = (body: string) =>
    cardProblems({ kind: row.kind, part: row.part, body }, leaksFor(row.part), scene);
  const versions = all
    .filter((entry) => entry.key === row.key)
    .sort((left, right) => right.version - left.version);
  const current = versions.find((entry) => entry.published) ?? null;
  // As app text (#288, #289): a version published before and rolled back past is an earlier
  // version, not a draft.
  const draft =
    versions.find(
      (entry) =>
        !entry.published &&
        entry.published_at === null &&
        (!current || entry.version > current.version),
    ) ?? null;
  return {
    key: row.key,
    version: row.version,
    published: row.published,
    slice: row.slice,
    position: row.position,
    body: row.body,
    words: wordCount(row.body),
    problems: problemsOf(row.body),
    kind: row.kind,
    part: row.part,
    draft: draft
      ? { version: draft.version, body: draft.body, problems: problemsOf(draft.body) }
      : null,
    versions: versions.map((entry) => {
      const state: StoryCardVersionState = entry.published
        ? "published"
        : entry.published_at !== null
          ? "earlier"
          : "draft";
      return {
        version: entry.version,
        body: entry.body,
        state,
        canRollBack: state === "earlier" && current !== null,
      };
    }),
  };
}

/** One story's background card and parts, from all rows. */
export function storyDetail(
  story: StoryRow,
  parts: StoryPartRow[],
  cards: StoryCardRow[],
  leaksFor: LeaksFor = noLeaks,
  /** The Story's scene check (#64); left out, it does not run; null blocks every card. */
  scene?: SceneCheck | null,
): StoryDetail | null {
  if (!story) return null;
  const own = cards.filter((row) => row.story_id === story.id);
  const shown = shownVersions(own);
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
    background: background ? view(background, own, leaksFor, scene) : null,
    parts: numbers.map((part) => ({
      part,
      title: titles.get(part) ?? null,
      cards: partCards
        .filter((row) => row.part === part)
        .sort((left, right) => left.position - right.position)
        .map((row) => view(row, own, leaksFor, scene)),
    })),
  };
}

/** Every story in story order, with its number of parts and cards. */
export function storyList(
  stories: StoryRow[],
  parts: StoryPartRow[],
  cards: StoryCardRow[],
  leaksOf: (storyId: string) => LeaksFor = () => noLeaks,
  sceneOf?: (storyId: string) => SceneCheck | null,
): StoryListRow[] {
  return [...stories]
    .sort((left, right) => left.sequence - right.sequence)
    .map((story) => {
      const detail = storyDetail(story, parts, cards, leaksOf(story.id), sceneOf?.(story.id))!;
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
        background: detail.background !== null,
        failing: all.filter((entry) => entry.problems.length > 0).length,
      };
    });
}
