import type { Companion, KeySlice, Story, StoryContent, StoryFact } from "./types";

/**
 * Turns the document `get_story_content` returns (supabase/migrations/20261119000000_story_content.sql)
 * into the app's snapshot. Anything that is not story content throws: the read then counts as
 * failed, and no partial content is used. The one exception is a story whose inputs row does not
 * exist yet (`inputs` null): it is left out, so one unfinished row does not stop every page.
 */

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function text(row: Row, field: string, where: string): string {
  const value = row[field];
  if (typeof value !== "string") throw new Error(`${where}: ${field} is not text`);
  return value;
}

function list<T>(value: unknown, where: string, check: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value) || !value.every(check)) throw new Error(`${where} is not a valid list`);
  return value;
}

const isString = (value: unknown): value is string => typeof value === "string";

const isFact = (value: unknown): value is StoryFact =>
  isRow(value) && isString(value.id) && isString(value.taskId) && isString(value.text);

const isKeySlice = (value: unknown): value is KeySlice =>
  isRow(value) &&
  isString(value.id) &&
  Array.isArray(value.factIds) &&
  value.factIds.every(isString) &&
  isString(value.keyLine) &&
  typeof value.confirmed === "boolean";

function companionOf(value: unknown): Companion {
  if (!isRow(value)) throw new Error("a Companion is not a row");
  const where = `Companion ${String(value.id)}`;
  const enterHref = value.enter_href;
  if (enterHref !== null && typeof enterHref !== "string") throw new Error(`${where}: enter_href`);
  return {
    id: text(value, "id", where),
    name: text(value, "name", where),
    shortName: text(value, "short_name", where),
    tags: text(value, "tags", where),
    line: text(value, "line", where),
    portrait: text(value, "portrait", where),
    enterHref,
  };
}

function storyOf(value: unknown): Story {
  if (!isRow(value)) throw new Error("a story is not a row");
  const where = `story ${String(value.id)}`;
  const inputs = value.inputs;
  if (!isRow(inputs)) throw new Error(`${where} has no inputs`);
  if (typeof value.sequence !== "number") throw new Error(`${where}: sequence`);
  if (!isRow(inputs.stage_zero)) throw new Error(`${where}: stage_zero`);
  return {
    id: text(value, "id", where),
    companionId: text(value, "companion_id", where),
    sequence: value.sequence,
    title: text(value, "title", where),
    period: text(value, "period", where),
    goalShort: text(value, "goal_short", where),
    who: text(value, "who", where),
    opening: text(value, "opening", where),
    inputs: {
      goal: text(inputs, "goal", where),
      facts: list(inputs.facts, `${where} facts`, isFact),
      forbiddenTerms: list(inputs.forbidden_terms, `${where} forbidden_terms`, isString),
      keySlices: list(inputs.key_moments, `${where} key_moments`, isKeySlice),
      stageZero: inputs.stage_zero,
    },
  };
}

export function parseStoryContent(document: unknown): StoryContent {
  if (!isRow(document)) throw new Error("story content is not a document");
  if (!Array.isArray(document.companions) || document.companions.length === 0) {
    throw new Error("story content has no Companions");
  }
  if (!Array.isArray(document.stories)) throw new Error("story content has no story list");
  const companions = document.companions.map(companionOf);
  const known = new Set(companions.map((companion) => companion.id));
  const stories = document.stories
    .filter((story) => !(isRow(story) && story.inputs === null))
    .map(storyOf);
  for (const story of stories) {
    if (!known.has(story.companionId)) throw new Error(`story ${story.id}: unknown Companion`);
  }
  return { companions, stories };
}
