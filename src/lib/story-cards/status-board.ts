import { parseFieldKey } from "@/lib/content-fields/fields";
import type { StoryCardRow, StoryListRow } from "./admin";
import { companionRow } from "@/lib/admin/companion-rows";

// ADM-01 Status board (#440): the admin's first page, as the prototype's Status board, built only
// from data the admin already has: the Companions and their stories, the story cards with their
// checks and publish state, the Companion and story fields and the prompts. Pure.
//
// The prototype's story table has seven stages (Source, Notebook, Card inputs, Cards made, Checks,
// Read, Published). Only three have a source today, so only those three are shown; the others are
// owner decisions in the #440 pull request, never drawn as sample dots.

/** A versioned row: story cards, Companion and story fields. */
export type VersionFact = {
  key: string;
  version: number;
  published: boolean;
  published_at: string | null;
};

/**
 * Keys with a draft: a version newer than the published one that was never published. As the
 * editors (#288, #304, #309): a version published before and rolled back past is not a draft.
 */
export function draftKeys(rows: VersionFact[]): Set<string> {
  const byKey = new Map<string, VersionFact[]>();
  for (const row of rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), row]);
  const found = new Set<string>();
  for (const [key, versions] of byKey) {
    const current = versions.find((row) => row.published) ?? null;
    const draft = versions.some(
      (row) =>
        !row.published && row.published_at === null && (!current || row.version > current.version),
    );
    if (draft) found.add(key);
  }
  return found;
}

/** The stages with a data source today, in the prototype's order. */
export const BOARD_STAGES = ["Cards made", "Checks", "Published"] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];

/** The prototype's legend states that have data today: done, checks passed, a check failed. */
export type DotState = "done" | "passed" | "failed" | "none";

export const DOT_LEGEND: { state: DotState; label: string }[] = [
  { state: "done", label: "done" },
  { state: "passed", label: "checks passed" },
  { state: "failed", label: "a check failed" },
  { state: "none", label: "not done yet" },
];

export type BoardDot = { stage: BoardStage; state: DotState; words: string };

export type BoardRow = {
  id: string;
  key: string;
  title: string;
  sequence: number;
  dots: BoardDot[];
  /**
   * Every card of the story has a published version, so users see all of it. A draft waiting
   * above a published version does not change that; it is said in the dot's words and counted
   * with the drafts.
   */
  published: boolean;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * "Cards made" is done when the story has its background card and every part has its cards:
 * one background card per story (docs/DECISIONS.md SHARED-STORY, T4) and story cards made for
 * each part (CARDS-PER-PART). The parts are the story's part titles and card parts, as on the
 * Stories page (`StoryListRow.parts`).
 */
function cardsMade(story: StoryListRow, own: StoryCardRow[]): BoardDot {
  const partsWithCards = new Set(
    own.filter((card) => card.kind === "part" && card.part !== null).map((card) => card.part),
  ).size;
  if (partsWithCards === 0 && !story.background) {
    return { stage: "Cards made", state: "none", words: "no cards yet" };
  }
  const words =
    `${partsWithCards} of ${plural(story.parts, "part has", "parts have")} cards, ` +
    (story.background ? "background card made" : "no background card");
  const done = story.background && story.parts > 0 && partsWithCards >= story.parts;
  return { stage: "Cards made", state: done ? "done" : "none", words };
}

/** One story's row: its three stages from its cards, their checks and their publish state. */
export function boardRow(story: StoryListRow, cards: StoryCardRow[]): BoardRow {
  const own = cards.filter((card) => card.story_id === story.id);
  const keys = new Set(own.map((card) => card.key));
  const total = keys.size;
  const published = new Set(own.filter((card) => card.published).map((card) => card.key)).size;
  const drafts = draftKeys(own).size;
  const allPublished = total > 0 && published === total;

  const made = cardsMade(story, own);
  const checks: BoardDot =
    total === 0
      ? { stage: "Checks", state: "none", words: "no cards to check" }
      : story.failing > 0
        ? {
            stage: "Checks",
            state: "failed",
            words: `${plural(story.failing, "card fails", "cards fail")} a check`,
          }
        : { stage: "Checks", state: "passed", words: "every card passes" };
  const shown: BoardDot = {
    stage: "Published",
    state: allPublished ? "done" : "none",
    words:
      total === 0
        ? "nothing to publish"
        : `${published} of ${plural(total, "card", "cards")} published` +
          (drafts > 0 ? `, ${plural(drafts, "draft", "drafts")} waiting` : ""),
  };
  return {
    id: story.id,
    key: story.key,
    title: story.title,
    sequence: story.sequence,
    dots: [made, checks, shown],
    published: allPublished,
  };
}

export type BoardCompanion = {
  id: string;
  name: string;
  short_name: string;
  key_code: string;
  mode: string;
  /** #521: null while he is not public (only admins and writers can enter him). */
  enter_href?: string | null;
};

export type BoardInput = {
  companions: BoardCompanion[];
  /** Every story of every Companion. */
  stories: { id: string; companion_id: string }[];
  /** Every Companion and story field version; null when they could not be read. */
  fields: VersionFact[] | null;
  /** The Companion whose stories have cards (the Stories page reads his). */
  cardCompanionId: string;
  /** His stories as the Stories page lists them, with their failing cards; null when unread. */
  storyRows: StoryListRow[] | null;
  cards: StoryCardRow[];
  /** Prompts with a draft; null when the prompts could not be read. */
  promptDrafts: number | null;
};

export type BoardTile = { label: string; value: number | null };
export type BoardPanel = { id: string; name: string; code: string; note: string };

export type StatusBoard = {
  tiles: BoardTile[];
  panels: BoardPanel[];
  /** The Companion of the story table, or null when he is not in the list. */
  boardName: string | null;
  rows: BoardRow[];
};

export function statusBoard(input: BoardInput): StatusBoard {
  const rows = (input.storyRows ?? []).map((story) => boardRow(story, input.cards));
  const cardDrafts = input.storyRows === null ? null : draftKeys(input.cards);
  const fieldDrafts = input.fields === null ? null : draftKeys(input.fields);
  const shown = input.companions.map((companion) => companionRow(companion, input.stories, []));
  const live = shown.filter((row) => row.shown === "Published").length;
  const drafts =
    cardDrafts === null || fieldDrafts === null || input.promptDrafts === null
      ? null
      : cardDrafts.size + fieldDrafts.size + input.promptDrafts;

  const tiles: BoardTile[] = [
    {
      value: input.companions.length,
      label: `${input.companions.length === 1 ? "Companion" : "Companions"} (${live} shown to users, ${input.companions.length - live} not ready)`,
    },
    {
      value:
        input.storyRows === null ? null : rows.filter((row) => row.dots[0].state === "done").length,
      label: `stories with all their cards made, of ${input.stories.length}`,
    },
    { value: drafts, label: "drafts waiting for an admin to publish" },
    {
      value: input.storyRows === null ? null : rows.filter((row) => row.published).length,
      label: "stories with every card published",
    },
  ];

  const panels = input.companions.map((companion, index) => {
    const own = input.stories.filter((story) => story.companion_id === companion.id).length;
    const parts = [
      companion.mode === "fictional" ? "Fictional" : "Historical",
      own === 0 ? "no stories yet" : plural(own, "story", "stories"),
      shown[index].shown === "Published"
        ? "shown to users"
        : shown[index].shown === "Preview"
          ? "preview for admins and writers, not shown to users"
          : "not ready",
    ];
    if (companion.id === input.cardCompanionId && input.storyRows !== null) {
      const cards = new Set(input.cards.map((card) => card.key)).size;
      const failing = input.storyRows.reduce((sum, story) => sum + story.failing, 0);
      if (cards > 0) {
        parts.push(
          `${plural(cards, "card", "cards")}, ${failing === 0 ? "all pass the checks" : `${failing} fail a check`}`,
        );
      }
    }
    const ownFieldDrafts =
      fieldDrafts === null
        ? 0
        : [...fieldDrafts].filter((key) => parseFieldKey(key)?.code === companion.key_code).length;
    const ownCardDrafts =
      companion.id === input.cardCompanionId && cardDrafts !== null ? cardDrafts.size : 0;
    const ownDrafts = ownFieldDrafts + ownCardDrafts;
    if (ownDrafts > 0) parts.push(`${plural(ownDrafts, "draft", "drafts")} waiting`);
    return {
      id: companion.id,
      name: companion.short_name || companion.name,
      code: `chr.${companion.key_code}`,
      note: parts.join(" · "),
    };
  });

  const boardCompanion = input.companions.find((row) => row.id === input.cardCompanionId);
  return {
    tiles,
    panels,
    boardName: boardCompanion ? boardCompanion.short_name || boardCompanion.name : null,
    rows,
  };
}
