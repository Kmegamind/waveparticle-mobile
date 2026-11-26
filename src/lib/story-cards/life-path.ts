import { periodFieldKey, periodsOf, storyFieldKey } from "@/lib/content-fields/fields";
import type { StoryFieldsRow } from "@/lib/content-fields/reader";
import { fieldView, type ContentFieldRow } from "@/lib/content-fields/view";
import type { StoryListRow } from "./admin";

// The Stories page as the prototype's Life path table (#443, ADM-05 / ADM-06): a Companion's
// stories grouped by Life Path period (each run of neighbouring stories with one period name,
// as on the Companion's page), each with its Life path description (stories.path) and the state
// of that text from its field versions (#309). Pure.

/** The state of a story's Life path description, in the words its pill shows. */
export type DescriptionState = { pill: "published" | "draft"; label: string };

export type LifePathStory = {
  id: string;
  key: string;
  title: string;
  sequence: number;
  /** The published description, or a note when there is none. */
  description: { text: string | null; note: string | null };
  state: DescriptionState;
  /** The story's parts and cards (#293), or null when its cards could not be read. */
  counts: { parts: string; cards: string; failing: string | null } | null;
};

export type LifePathPeriod = {
  number: number;
  name: string;
  /** The period name's field key, `chr.<code>.period.<n>`. */
  key: string;
  stories: LifePathStory[];
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function countsOf(row: StoryListRow | undefined): LifePathStory["counts"] {
  if (!row) return null;
  return {
    parts: plural(row.parts, "part", "parts"),
    cards:
      plural(row.cards, "part card", "part cards") +
      (row.background ? " and a background card" : ", no background card"),
    failing: row.failing > 0 ? plural(row.failing, "card fails", "cards fail") + " a check" : null,
  };
}

export function lifePath(
  code: string,
  stories: StoryFieldsRow[],
  cardCounts: StoryListRow[],
  fields: ContentFieldRow[],
): LifePathPeriod[] {
  const byId = new Map(stories.map((story) => [story.id, story]));
  const countsById = new Map(cardCounts.map((row) => [row.id, row]));
  return periodsOf(stories).map((period) => ({
    number: period.number,
    name: period.name,
    key: periodFieldKey(code, period.number),
    stories: period.storyIds.map((id) => {
      const story = byId.get(id)!;
      const view = fieldView(storyFieldKey(code, id, "path"), story.path, fields);
      const shown = story.path.trim() !== "";
      const state: DescriptionState = view.draft
        ? { pill: "draft", label: `${shown ? "Newer draft" : "Draft"} v${view.draft.version}` }
        : shown
          ? { pill: "published", label: "Published" }
          : { pill: "draft", label: "Empty" };
      return {
        id,
        key: `${code}.${id}`,
        title: story.title,
        sequence: story.sequence,
        description: shown
          ? { text: story.path, note: null }
          : { text: null, note: view.draft ? "Nothing published yet" : "Not written yet" },
        state,
        counts: countsOf(countsById.get(id)),
      };
    }),
  }));
}
