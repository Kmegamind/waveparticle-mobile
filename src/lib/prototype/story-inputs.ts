import { oppenheimerStories, type OppenheimerStory } from "@/content/oppenheimer";
import { RAW_STORY_INPUTS } from "./story-inputs-data";

/**
 * The generation inputs of every Oppenheimer story on the test path (#254). They come from the
 * stage 0 files in docs/demo/<story-id>.stage0.json (PR #218): AI-drafted, read by nobody (their
 * `_note` says so). Only the fields that the prompts already use are read here: who he is, the
 * place, the goal sentence and the forbidden terms, plus the first "where now" line for the goal
 * dialogue opening. Stored text inside the files (authored cards, example lines, people's lines)
 * is never read, so it cannot reach the page (NO-BACKUP).
 */

export const STORY_IDS: readonly string[] = oppenheimerStories.map((story) => story.id);

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

export function isStoryId(value: unknown): value is string {
  return typeof value === "string" && STORY_IDS.includes(value);
}

/** The input file as stored. For validation and tests only; the page never gets it. */
export function rawStoryInputs(id: string): unknown {
  const raw = RAW_STORY_INPUTS[id];
  if (!raw) throw new Error(`no inputs for story ${id}`);
  return raw;
}

function stageZero(id: string): StageZero {
  return rawStoryInputs(id) as StageZero;
}

function storyRecord(id: string): OppenheimerStory {
  const story = oppenheimerStories.find((item) => item.id === id);
  if (!story) throw new Error(`no story ${id}`);
  return story;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function generationInputs(id: string): GenerationInputs {
  const raw = stageZero(id);
  const listed = Array.isArray(raw.story?.forbidTerms)
    ? raw.story.forbidTerms.filter((term): term is string => typeof term === "string")
    : [];
  return {
    who: text(raw.who),
    place: text(raw.story?.place),
    goalShort: text(raw.story?.goalShort),
    forbidTerms: [...new Set([...storyRecord(id).forbiddenTerms, ...listed])],
  };
}

export function storyProfile(id: string): StoryProfile {
  const raw = stageZero(id);
  return {
    id,
    title: storyRecord(id).title,
    goalShort: text(raw.story?.goalShort),
    who: text(raw.who),
    opening: `${text(raw.whereNow?.s1)} ${OPENING_QUESTION}`,
  };
}

/** Every story's profile, in story order, for the test path's pages. */
export function storyProfiles(): StoryProfile[] {
  return STORY_IDS.map(storyProfile);
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
