import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import { getFullStoryContent } from "@/lib/content/repository";
import { companionPeople, sceneCheckOf, type SceneCheck } from "@/lib/content/scene";
import type { StoryCardRow, StoryPartRow, StoryRow } from "./admin";
import { publishProblems } from "./pool-checks";

const CARD_COLUMNS =
  "key, version, story_id, kind, part, slice, position, body, published, published_at";

/**
 * Each story's stage 0 inputs (the spoiler words per slice), from the server's story content read
 * (#284). Null when the story content cannot be read: the spoiler check then cannot run (#304).
 */
export async function readStageZeros(): Promise<Map<string, Record<string, unknown>> | null> {
  try {
    const content = await getFullStoryContent();
    return new Map(content.stories.map((story) => [story.id, story.inputs.stageZero]));
  } catch {
    return null;
  }
}

/**
 * The scene check of one story (#64): its scene table's names and every person the stories name.
 * Null when the story inputs or the table cannot be read, which blocks its cards.
 */
export function sceneCheckFor(
  zeros: Map<string, Record<string, unknown>> | null,
  storyId: string,
): SceneCheck | null {
  if (!zeros) return null;
  return sceneCheckOf(zeros.get(storyId), companionPeople(zeros.values()));
}

/**
 * The check problems of one stored card version (#304: the server re-runs the checks before
 * Publish; #377: with the whole-Story checks against the Story's published cards), or null when
 * that version cannot be read.
 */
export async function storedCardProblems(
  client: SupabaseClient,
  key: string,
  version: number,
): Promise<string[] | null> {
  try {
    const answer = await client
      .from("story_cards")
      .select(CARD_COLUMNS)
      .eq("key", key)
      .eq("version", version);
    const row =
      !answer.error && Array.isArray(answer.data) ? (answer.data[0] as StoryCardRow) : null;
    if (!row) return null;
    const [story, zeros] = await Promise.all([
      readStoryCardsData(client, row.story_id),
      readStageZeros(),
    ]);
    if (!story.ok) return null;
    return publishProblems(row, story.cards, zeros);
  } catch {
    return null;
  }
}

// Reads the rows behind ADM-06 Stories (#293) through the signed-in editor's own client. The
// policies show story_parts and story_cards to content editors only. Server code only; the phone
// screens never call this (they keep their current card source until a later issue).

/** The Companion a Stories page shows: his id, key code (NAMING) and short name. */
export type StoriesCompanion = { id: string; key_code: string; short_name: string };

export type StoryCardsData = {
  ok: boolean;
  /** The Companion of the stories read, or null when he cannot be read. */
  companion: StoriesCompanion | null;
  stories: StoryRow[];
  parts: StoryPartRow[];
  cards: StoryCardRow[];
};

/** The Companion whose stories the Stories list shows when the address names none. */
export const COMPANION_ID = DEFAULT_COMPANION_ID;

const COMPANION_PATTERN = /^[a-z][a-z0-9-]*$/;

/** #502: the Companion of /admin/stories?companion=<id>; Oppenheimer when none or not an id. */
export function companionOfPage(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === "string" && COMPANION_PATTERN.test(id) ? id : COMPANION_ID;
}

/**
 * One Companion's stories with their parts and cards (#502: any Companion, Oppenheimer by
 * default), or one story whatever its Companion when `storyId` is given. Parts and cards of other
 * Companions' stories are left out, so their drafts never count on this Companion's list.
 */
export async function readStoryCardsData(
  client: SupabaseClient,
  storyId?: string,
  companionId: string = COMPANION_ID,
): Promise<StoryCardsData> {
  try {
    let stories = client.from("stories").select("id, title, sequence, companion_id");
    stories = storyId ? stories.eq("id", storyId) : stories.eq("companion_id", companionId);
    const [storyRows, companionRows] = await Promise.all([
      stories.order("sequence"),
      client.from("companions").select("id, key_code, short_name"),
    ]);
    const rows = <T>(answer: { data: unknown; error: unknown }) =>
      !answer.error && Array.isArray(answer.data) ? (answer.data as T[]) : [];
    const own = rows<StoryRow>(storyRows);
    const ids = own.map((row) => row.id);
    // #514 review: only this Companion's parts and cards, filtered by the database and read page
    // by page, so the API's row limit can never silently cut a list short.
    const [parts, cards] = await Promise.all([
      allRowsIn<StoryPartRow>(ids, (chunk) =>
        client
          .from("story_parts")
          .select("story_id, part, title")
          .in("story_id", chunk)
          .order("story_id")
          .order("part"),
      ),
      allRowsIn<StoryCardRow>(ids, (chunk) =>
        client
          .from("story_cards")
          .select(CARD_COLUMNS)
          .in("story_id", chunk)
          .order("key")
          .order("version"),
      ),
    ]);
    const companionOf = storyId ? (own[0]?.companion_id ?? null) : companionId;
    const companion =
      rows<StoriesCompanion>(companionRows).find((row) => row.id === companionOf) ?? null;
    return {
      ok: !storyRows.error && parts !== null && cards !== null,
      companion: companion
        ? { id: companion.id, key_code: companion.key_code, short_name: companion.short_name }
        : null,
      stories: own,
      parts: parts ?? [],
      cards: cards ?? [],
    };
  } catch {
    return { ok: false, companion: null, stories: [], parts: [], cards: [] };
  }
}

/** The API returns at most this many rows per request (Supabase's default `max_rows`). */
export const PAGE_ROWS = 1000;
/** Story ids per `in` filter, so a long list never makes one request URL too long. */
const ID_CHUNK = 100;

type Page = PromiseLike<{ data: unknown; error: unknown }>;
type RangeQuery = { range(from: number, to: number): Page };

/**
 * Every row of a query filtered by story ids, chunk by chunk and page by page; null when any
 * request fails, so a page never shows a list with rows silently missing.
 */
async function allRowsIn<T>(
  ids: string[],
  query: (chunk: string[]) => RangeQuery,
): Promise<T[] | null> {
  const all: T[] = [];
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const chunk = ids.slice(start, start + ID_CHUNK);
    for (let from = 0; ; from += PAGE_ROWS) {
      const answer = await query(chunk).range(from, from + PAGE_ROWS - 1);
      if (answer.error || !Array.isArray(answer.data)) return null;
      all.push(...(answer.data as T[]));
      if (answer.data.length < PAGE_ROWS) break;
    }
  }
  return all;
}
