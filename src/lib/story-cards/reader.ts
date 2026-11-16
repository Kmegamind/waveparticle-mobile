import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoryCardRow, StoryPartRow, StoryRow } from "./admin";

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
    let cards = client
      .from("story_cards")
      .select("key, version, story_id, kind, part, slice, position, body, published");
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
