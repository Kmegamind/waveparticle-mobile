import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import type { OppenheimerStory, Story, StoryContent } from "@/lib/content/types";

/**
 * The stories of a run and their inputs (#254), read from the story content snapshot
 * (`getStoryContent()`, #284). Display texts come from the story's display fields (title, goal
 * sentence, "Who I am", opening); the model inputs come from `story.inputs`, server side only.
 * Stored text inside the stage 0 inputs (authored cards, example lines, people's lines) is never
 * read, so it cannot reach the page (NO-BACKUP for the live parts).
 *
 * #521 (#485): any Companion's stories. A story is playable when it is in `content`; the caller
 * passes the content as the viewer may play it (`contentForViewer`, `getStoryContent()` holds the
 * public Companions only), so a story of a Companion who is not public is never found here for a
 * user. The default Companion (`DEFAULT_COMPANION_ID`) is only the product default where no
 * Companion is named: the test path /try and a Life Path or new session without `?companion=`.
 */

/** One Companion's story ids in story order (the default Companion when none is named). */
export function storyIds(
  content: StoryContent,
  companionId: string = DEFAULT_COMPANION_ID,
): string[] {
  return content.stories
    .filter((story) => story.companionId === companionId)
    .map((story) => story.id);
}

export type StoryProfile = {
  id: string;
  title: string;
  /** The goal sentence ("My goal" on the focus page). */
  goalShort: string;
  /** The "Who I am" text. */
  who: string;
  /** The goal dialogue's first opening: where he is, then the one question. */
  opening: string;
};

export type GenerationInputs = {
  /** The full name of the story's Companion, for the gateway's `name` check (#302). */
  companionName: string;
  who: string;
  place: string;
  goalShort: string;
  forbidTerms: string[];
};

type StageZero = {
  _note?: unknown;
  who?: unknown;
  story?: {
    id?: unknown;
    title?: unknown;
    place?: unknown;
    goalShort?: unknown;
    forbidTerms?: unknown;
  };
  whereNow?: Record<string, unknown>;
  slices?: { id?: unknown; facts?: unknown }[];
  steps?: { n?: unknown; covers?: unknown }[];
};

export const OPENING_QUESTION = "What are you working on?";

/** True for a story of any Companion in this (viewer-scoped) content. */
export function isStoryId(content: StoryContent, value: unknown): value is string {
  return typeof value === "string" && content.stories.some((story) => story.id === value);
}

/** One story of the content; throws for an id that is not one. */
export function storyById(content: StoryContent, id: string): Story {
  const story = content.stories.find((item) => item.id === id);
  if (!story) throw new Error(`no story ${id}`);
  return story;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

type StageZeroStory = { place?: unknown; forbidTerms?: unknown };

export function generationInputs(content: StoryContent, id: string): GenerationInputs {
  const story = storyById(content, id);
  const stage = (story.inputs.stageZero.story ?? {}) as StageZeroStory;
  const listed = Array.isArray(stage.forbidTerms)
    ? stage.forbidTerms.filter((term): term is string => typeof term === "string")
    : [];
  const companion = content.companions.find((item) => item.id === story.companionId);
  if (!companion) throw new Error(`story ${id}: unknown Companion ${story.companionId}`);
  return {
    companionName: companion.name,
    who: story.who.trim(),
    place: text(stage.place),
    goalShort: story.goalShort.trim(),
    forbidTerms: [...new Set([...story.inputs.forbiddenTerms, ...listed])],
  };
}

export function storyProfile(content: StoryContent, id: string): StoryProfile {
  const story = storyById(content, id);
  return {
    id,
    title: story.title,
    goalShort: story.goalShort.trim(),
    who: story.who.trim(),
    opening: story.opening,
  };
}

/** One Companion's story profiles, in story order, for the pages. */
export function storyProfiles(
  content: StoryContent,
  companionId: string = DEFAULT_COMPANION_ID,
): StoryProfile[] {
  return storyIds(content, companionId).map((id) => storyProfile(content, id));
}

/**
 * Problems in one story's input file, each naming the story (#254 AC2): required fields, facts
 * for every step, forbidden terms, and the AI-drafted note.
 */
export function validateStoryInputs(id: string, raw: unknown, story: OppenheimerStory): string[] {
  const problems: string[] = [];
  const add = (problem: string) => problems.push(`${id}: ${problem}`);
  if (typeof raw !== "object" || raw === null) return [`${id}: the file is not an object`];
  const file = raw as StageZero;
  if (text(file._note).length === 0) add("_note (the AI-drafted, unreviewed note) is missing");
  if (text(file.story?.id) !== id) add("story.id does not match the file name");
  for (const field of ["title", "place", "goalShort"] as const) {
    if (text(file.story?.[field]).length === 0) add(`story.${field} is missing`);
  }
  if (!Array.isArray(file.story?.forbidTerms) || file.story.forbidTerms.length === 0) {
    add("story.forbidTerms is empty");
  }
  if (text(file.who).length === 0) add("who is missing");
  if (text(file.whereNow?.s1).length === 0) add("whereNow.s1 (the opening place) is missing");
  const slices = new Map(
    (Array.isArray(file.slices) ? file.slices : []).map((slice) => [slice.id, slice.facts]),
  );
  const steps = Array.isArray(file.steps) ? file.steps : [];
  if (steps.length === 0) add("steps is empty");
  for (const step of steps) {
    const covers = Array.isArray(step.covers) ? step.covers : [];
    const facts = covers.reduce<number>((count, sliceId) => {
      const sliceFacts = slices.get(sliceId);
      return count + (Array.isArray(sliceFacts) ? sliceFacts.length : 0);
    }, 0);
    if (facts === 0) add(`step ${String(step.n)} has no facts`);
  }
  if (story.facts.length === 0) add("stories.json has no facts");
  if (story.forbiddenTerms.length === 0) add("stories.json has no forbidden terms");
  if (story.goal.trim().length === 0) add("stories.json has no goal");
  return problems;
}
