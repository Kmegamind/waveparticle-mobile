import {
  FIELD_LIMITS,
  companionFieldKey,
  periodChoices,
  periodFieldKey,
  periodsOf,
  storyFieldKey,
  type StoryField,
} from "./fields";
import type { CompanionRow, StoryFieldsRow } from "./reader";
import { fieldView, type ContentFieldRow, type FieldView } from "./view";

// What the Companion and story field pages show (#309), from the rows the reader returns. Pure.

export type FieldEntry = { label: string; limit: number; view: FieldView; choices?: string[] };

export type CompanionPage = {
  id: string;
  name: string;
  key: string;
  mode: string;
  profile: FieldEntry[];
  /**
   * #442: the line under his name on the Companions screen. Read only here: no content field
   * holds it yet, so it cannot be drafted or published from the admin (owner decision).
   */
  oneLine: { label: string; key: string; text: string };
  periods: { number: number; name: string; field: FieldEntry; stories: StoryFieldsRow[] }[];
};

export function companionPage(
  companion: CompanionRow,
  stories: StoryFieldsRow[],
  fields: ContentFieldRow[],
): CompanionPage {
  const code = companion.key_code;
  const entry = (field: "name" | "tags" | "who", label: string): FieldEntry => {
    const key = companionFieldKey(code, field);
    return { label, limit: FIELD_LIMITS[field], view: fieldView(key, companion[field], fields) };
  };
  const byId = new Map(stories.map((story) => [story.id, story]));
  return {
    id: companion.id,
    name: companion.name,
    key: `chr.${code}`,
    mode: companion.mode,
    profile: [entry("name", "Name"), entry("tags", "Tags"), entry("who", "Who I am")],
    oneLine: { label: "One line (Companions)", key: `chr.${code}.line`, text: companion.line },
    periods: periodsOf(stories).map((period) => {
      const key = periodFieldKey(code, period.number);
      return {
        number: period.number,
        name: period.name,
        field: {
          label: `Period ${period.number}`,
          limit: FIELD_LIMITS.period,
          view: fieldView(key, period.name, fields),
        },
        stories: period.storyIds.map((id) => byId.get(id)!),
      };
    }),
  };
}

const STORY_LABELS: [StoryField, keyof StoryFieldsRow, string][] = [
  ["title", "title", "Title"],
  ["period", "period", "Period"],
  ["goal", "goal_short", "Goal sentence"],
  ["who", "who", "Who I am"],
  ["opening", "opening", "Opening line"],
  ["path", "path", "Life Path description"],
];

export function storyFields(
  code: string,
  story: StoryFieldsRow,
  stories: StoryFieldsRow[],
  fields: ContentFieldRow[],
): FieldEntry[] {
  return STORY_LABELS.map(([field, column, label]) => {
    const key = storyFieldKey(code, story.id, field);
    return {
      label,
      limit: FIELD_LIMITS[field],
      view: fieldView(key, String(story[column]), fields),
      choices: field === "period" ? periodChoices(stories, story.id) : undefined,
    };
  });
}
