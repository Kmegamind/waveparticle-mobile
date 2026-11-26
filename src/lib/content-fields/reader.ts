import type { SupabaseClient } from "@supabase/supabase-js";
import { fieldProblems, parseFieldKey, type FieldKey, type StoryPeriodRow } from "./fields";
import type { ContentFieldRow } from "./view";

// Reads the rows behind the Companions pages (#309) through the signed-in editor's own client:
// the Companions and stories are readable by signed-in accounts, the field versions by content
// editors only (the policies of 20261119000000 and 20261124000000). Server code only.

export type CompanionRow = {
  id: string;
  position: number;
  name: string;
  short_name: string;
  tags: string;
  /** The one line under his name on the Companions screen (#442 shows it, read only). */
  line: string;
  who: string;
  key_code: string;
  mode: string;
};

export type StoryFieldsRow = {
  id: string;
  companion_id: string;
  sequence: number;
  title: string;
  period: string;
  goal_short: string;
  who: string;
  opening: string;
  path: string;
};

const COMPANION_COLUMNS = "id, position, name, short_name, tags, line, who, key_code, mode";
const STORY_COLUMNS = "id, companion_id, sequence, title, period, goal_short, who, opening, path";
const FIELD_COLUMNS = "key, version, body, published, published_at";

type Answer = { data: unknown; error: unknown };
const rows = <T>(answer: Answer) =>
  !answer.error && Array.isArray(answer.data) ? (answer.data as T[]) : [];

export type CompanionsData = {
  ok: boolean;
  companions: CompanionRow[];
  stories: StoryFieldsRow[];
  fields: ContentFieldRow[];
};

/** Every Companion with its stories and field versions; or one Companion's when `companionId`. */
export async function readCompanionsData(
  client: SupabaseClient,
  companionId?: string,
): Promise<CompanionsData> {
  try {
    let companions = client.from("companions").select(COMPANION_COLUMNS);
    let stories = client.from("stories").select(STORY_COLUMNS);
    let fields = client.from("content_fields").select(FIELD_COLUMNS);
    if (companionId) {
      companions = companions.eq("id", companionId);
      stories = stories.eq("companion_id", companionId);
      fields = fields.eq("companion_id", companionId);
    }
    const [companionRows, storyRows, fieldRows] = await Promise.all([
      companions.order("position"),
      stories.order("sequence"),
      fields.order("version"),
    ]);
    return {
      ok: !companionRows.error && !storyRows.error && !fieldRows.error,
      companions: rows<CompanionRow>(companionRows),
      stories: rows<StoryFieldsRow>(storyRows),
      fields: rows<ContentFieldRow>(fieldRows),
    };
  } catch {
    return { ok: false, companions: [], stories: [], fields: [] };
  }
}

/**
 * The stories of the Companion a key belongs to, for the period checks; "unknown-item" when the
 * key names no Companion or none of his stories (#317), null when unreadable.
 */
async function periodRowsFor(
  client: SupabaseClient,
  key: FieldKey,
): Promise<StoryPeriodRow[] | "unknown-item" | null> {
  const companion = await client.from("companions").select("id").eq("key_code", key.code);
  if (companion.error) return null;
  const id = rows<{ id: string }>(companion)[0]?.id;
  if (!id) return "unknown-item";
  const stories = await client
    .from("stories")
    .select("id, sequence, period")
    .eq("companion_id", id)
    .order("sequence");
  if (stories.error) return null;
  const found = rows<StoryPeriodRow>(stories);
  // A story key must name one of this Companion's stories.
  if (key.item === "story" && !found.some((story) => story.id === key.storyId)) {
    return "unknown-item";
  }
  return found;
}

/**
 * The problems of a text for one field (#309); "unknown-item" when the key's Companion or story
 * does not exist (#317), null when the checks cannot run.
 */
export async function contentFieldProblems(
  client: SupabaseClient,
  key: FieldKey,
  body: string,
): Promise<string[] | "unknown-item" | null> {
  try {
    const stories = await periodRowsFor(client, key);
    if (stories === null || stories === "unknown-item") return stories;
    return fieldProblems(key, body, { stories });
  } catch {
    return null;
  }
}

/** One stored version's text, or null when it does not exist or cannot be read. */
export async function storedFieldBody(
  client: SupabaseClient,
  key: string,
  version: number,
): Promise<string | null> {
  if (!parseFieldKey(key)) return null;
  try {
    const answer = await client
      .from("content_fields")
      .select("body")
      .eq("key", key)
      .eq("version", version);
    const row = rows<{ body: string }>(answer)[0];
    return answer.error || !row ? null : row.body;
  } catch {
    return null;
  }
}
