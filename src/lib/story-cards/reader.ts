import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoryContent } from "@/lib/content/repository";
import type { StoryCardRow, StoryPartRow, StoryRow } from "./admin";
import { cardProblems, leaksForStory } from "./checks";

const CARD_COLUMNS =
  "key, version, story_id, kind, part, slice, position, body, published, published_at";

/**
 * Each story's stage 0 inputs (the spoiler words per slice), from the server's story content read
 * (#284). Null when the story content cannot be read: the spoiler check then cannot run (#304).
 */
export async function readStageZeros(): Promise<Map<string, Record<string, unknown>> | null> {
  try {
    const content = await getStoryContent();
    return new Map(content.stories.map((story) => [story.id, story.inputs.stageZero]));
  } catch {
    return null;
  }
}

/**
 * The check problems of one stored card version (#304: the server re-runs the checks before
 * Publish), or null when that version cannot be read.
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
    const leaks = leaksForStory(story.cards, zeros?.get(row.story_id) ?? null);
    return cardProblems(row, leaks(row.part));
  } catch {
    return null;
  }
}

// Reads the rows behind ADM-06 Stories (#293) through the signed-in editor's own client. The
// policies show story_parts and story_cards to content editors only. Server code only; the phone
// screens never call this (they keep their current card source until a later issue).

export type StoryCardsData = {
  ok: boolean;
  stories: StoryRow[];
  parts: StoryPartRow[];
  cards: StoryCardRow[];
};

/** The Companion whose stories have cards. */
const COMPANION_ID = "oppenheimer";

export async function readStoryCardsData(
  client: SupabaseClient,
  storyId?: string,
): Promise<StoryCardsData> {
  try {
    let stories = client
      .from("stories")
      .select("id, title, sequence")
      .eq("companion_id", COMPANION_ID);
    let parts = client.from("story_parts").select("story_id, part, title");
    let cards = client.from("story_cards").select(CARD_COLUMNS);
    if (storyId) {
      stories = stories.eq("id", storyId);
      parts = parts.eq("story_id", storyId);
      cards = cards.eq("story_id", storyId);
    }
    const [storyRows, partRows, cardRows] = await Promise.all([
      stories.order("sequence"),
      parts.order("part"),
      cards.order("key"),
    ]);
    const ok = !storyRows.error && !partRows.error && !cardRows.error;
    const rows = <T>(answer: { data: unknown; error: unknown }) =>
      !answer.error && Array.isArray(answer.data) ? (answer.data as T[]) : [];
    return {
      ok,
      stories: rows<StoryRow>(storyRows),
      parts: rows<StoryPartRow>(partRows),
      cards: rows<StoryCardRow>(cardRows),
    };
  } catch {
    return { ok: false, stories: [], parts: [], cards: [] };
  }
}
