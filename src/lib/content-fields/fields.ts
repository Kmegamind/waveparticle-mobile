import { datesProblems } from "@/lib/content/dates";

// The Companion and story fields the admin edits (#309, ADM-03 to ADM-05, docs/decisions/0024):
// their keys (NAMING), their limits and the checks every save and every publish runs. These
// fields appear on the Life Path and the goal dialogue, so none may carry a year, a date or an age
// (PERIODS, DATES-ADMIN-ONLY). Pure: no database, no React.

export const COMPANION_FIELDS = ["name", "tags", "who", "period"] as const;
export const STORY_FIELDS = ["title", "period", "goal", "who", "opening", "path"] as const;
export type CompanionField = (typeof COMPANION_FIELDS)[number];
export type StoryField = (typeof STORY_FIELDS)[number];

export type FieldKey =
  | { item: "companion"; code: string; field: Exclude<CompanionField, "period"> }
  | { item: "companion"; code: string; field: "period"; period: number }
  | { item: "story"; code: string; storyId: string; field: StoryField };

/** The longest text each field takes (the database allows 1000 for every field). */
export const FIELD_LIMITS = {
  name: 120,
  tags: 200,
  who: 600,
  period: 80,
  title: 120,
  goal: 400,
  opening: 600,
  path: 400,
} as const;

/** The goal dialogue's question that every opening ends with (scripts/content/content-files.mjs). */
export const OPENING_QUESTION = "What are you working on?";

const COMPANION_KEY = /^chr\.([a-z]{2,8})\.(name|tags|who|period\.([1-9][0-9]{0,2}))$/;
const STORY_KEY = /^([a-z]{2,8})\.([a-z0-9][a-z0-9-]*)\.(title|period|goal|who|opening|path)$/;

export function parseFieldKey(key: string): FieldKey | null {
  if (typeof key !== "string") return null;
  const companion = key.match(COMPANION_KEY);
  if (companion) {
    const [, code, field, period] = companion;
    if (period) return { item: "companion", code, field: "period", period: Number(period) };
    return { item: "companion", code, field: field as "name" | "tags" | "who" };
  }
  const story = key.match(STORY_KEY);
  if (story && story[1] !== "chr") {
    return { item: "story", code: story[1], storyId: story[2], field: story[3] as StoryField };
  }
  return null;
}

export const companionFieldKey = (code: string, field: Exclude<CompanionField, "period">) =>
  `chr.${code}.${field}`;
export const periodFieldKey = (code: string, period: number) => `chr.${code}.period.${period}`;
export const storyFieldKey = (code: string, storyId: string, field: StoryField) =>
  `${code}.${storyId}.${field}`;

/** What the period checks need of each of the Companion's stories. */
export type StoryPeriodRow = { id: string; sequence: number; period: string };

export type Period = { number: number; name: string; storyIds: string[] };

/** The Life Path periods: each run of neighbouring stories with one name, in story order. */
export function periodsOf(stories: StoryPeriodRow[]): Period[] {
  const periods: Period[] = [];
  for (const story of [...stories].sort((left, right) => left.sequence - right.sequence)) {
    const last = periods.at(-1);
    if (last && last.name === story.period) last.storyIds.push(story.id);
    else periods.push({ number: periods.length + 1, name: story.period, storyIds: [story.id] });
  }
  return periods;
}

/**
 * The periods a story may be in: its own; the one before when it is the first story of its
 * period; the one after when it is the last. A story alone in its period stays, so no period ever
 * disappears and the period numbers keep their meaning.
 */
export function periodChoices(stories: StoryPeriodRow[], storyId: string): string[] {
  const periods = periodsOf(stories);
  const index = periods.findIndex((period) => period.storyIds.includes(storyId));
  if (index === -1) return [];
  const own = periods[index];
  if (own.storyIds.length === 1) return [own.name];
  const choices: string[] = [];
  if (index > 0 && own.storyIds[0] === storyId) choices.push(periods[index - 1].name);
  choices.push(own.name);
  if (index < periods.length - 1 && own.storyIds.at(-1) === storyId) {
    choices.push(periods[index + 1].name);
  }
  return choices;
}

const PERIOD_REFUSED =
  "Choose the story's own period or the period of the story just before or after it. A story that is alone in its period stays there.";

/**
 * Every problem of a field's text, in plain words; empty when it may be saved and published.
 * `stories` are the Companion's stories (for the two period checks).
 */
export function fieldProblems(
  key: FieldKey,
  text: string,
  context: { stories: StoryPeriodRow[] },
): string[] {
  if (typeof text !== "string" || text.trim() === "") {
    return ["Write a text first. An empty field is not saved."];
  }
  // Spaces around the text are not part of it (#317): "After the war " is "After the war".
  text = text.trim();
  const limit = FIELD_LIMITS[key.field];
  if (text.length > limit) return [`Keep it to ${limit} characters or fewer.`];
  const problems = datesProblems(text);
  if (/\{age\}/i.test(text)) problems.push("Mentions an age ({age}). Ages stay in the admin.");
  if (
    key.item === "story" &&
    key.field === "opening" &&
    !text.trimEnd().endsWith(OPENING_QUESTION)
  ) {
    problems.push(`End the opening with "${OPENING_QUESTION}"`);
  }
  if (key.item === "story" && key.field === "period") {
    if (!periodChoices(context.stories, key.storyId).includes(text)) problems.push(PERIOD_REFUSED);
  }
  if (key.item === "companion" && key.field === "period") {
    const periods = periodsOf(context.stories);
    const own = periods.find((period) => period.number === key.period);
    if (!own) problems.push("This period is not known.");
    else if (periods.some((period) => period.number !== key.period && period.name === text)) {
      problems.push(`Another period is already called "${text}".`);
    }
  }
  return problems;
}
