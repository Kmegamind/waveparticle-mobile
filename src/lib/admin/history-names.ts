import { PUBLISH_HISTORY_KINDS } from "@/lib/publish-history/admin";
import { countryName, isCountryCode } from "@/lib/safety/help-lines";

// ADM-12 (#313, row 48): a readable name for every Publish history row, shown before its key.
// Pure: the page passes the Companions, stories and prompt purposes it already reads. A key the
// lookup does not know falls back to the kind label, so a row is never blank.

export type NameLookup = {
  companions: { id: string; key_code: string; name: string }[];
  stories: { id: string; companion_id: string; title: string }[];
  promptPurpose: Record<string, string>;
};

const COMPANION_FIELDS: Record<string, string> = { name: "Name", tags: "Tags", who: "Who I am" };
const STORY_FIELDS: Record<string, string> = {
  title: "Title",
  period: "Period",
  goal: "Goal sentence",
  who: "Who I am",
  opening: "Opening",
  path: "Life Path description",
};

const kindLabel = (kind: string) =>
  Object.hasOwn(PUBLISH_HISTORY_KINDS, kind)
    ? PUBLISH_HISTORY_KINDS[kind as keyof typeof PUBLISH_HISTORY_KINDS]
    : kind;

function storyName(lookup: NameLookup, code: string, storyId: string): string | null {
  const companion = lookup.companions.find((c) => c.key_code === code);
  const story = lookup.stories.find(
    (s) => s.id === storyId && (!companion || s.companion_id === companion.id),
  );
  return story?.title ?? null;
}

function name(kind: string, key: string, lookup: NameLookup): string | null {
  if (kind === "app_text") {
    const screen = key.match(/^ui\.([^.]+)\./)?.[1];
    return screen ? `App text · screen ${screen}` : null;
  }
  if (kind === "prompt") return lookup.promptPurpose[key] ?? null;
  if (kind === "hotline") return isCountryCode(key) ? `Hotline · ${countryName(key)}` : null;
  if (kind === "story_card") {
    const card = key.match(/^crd\.([^.]+)\.([^.]+)\.(?:bg|p(\d+)\.c(\d+))$/);
    if (!card) return null;
    const title = storyName(lookup, card[1], card[2]);
    if (!title) return null;
    return card[3] ? `${title} · part ${card[3]}, card ${card[4]}` : `${title} · background card`;
  }
  if (kind === "story_switch") {
    // #516: the item key is the story id.
    const story = lookup.stories.find((s) => s.id === key);
    return story ? `${story.title} · switch-over to the new cards` : null;
  }
  if (kind === "companion_field") {
    const field = key.match(/^chr\.([^.]+)\.(?:period\.(\d+)|([^.]+))$/);
    const companion = field && lookup.companions.find((c) => c.key_code === field[1]);
    if (!field || !companion) return null;
    if (field[2]) return `${companion.name} · period ${field[2]} name`;
    const label = COMPANION_FIELDS[field[3]];
    return label ? `${companion.name} · ${label}` : null;
  }
  if (kind === "story_field") {
    const field = key.match(/^([^.]+)\.([^.]+)\.([^.]+)$/);
    const label = field && STORY_FIELDS[field[3]];
    const title = field && label ? storyName(lookup, field[1], field[2]) : null;
    return title ? `${title} · ${label}` : null;
  }
  return null;
}

/** "J. Robert Oppenheimer · Who I am", or the kind label when the key is not known. */
export function historyItemName(kind: string, key: string, lookup: NameLookup): string {
  return name(kind, key, lookup) ?? kindLabel(kind);
}
