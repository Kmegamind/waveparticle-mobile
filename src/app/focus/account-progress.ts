import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { openFocusSession, type AccountFocusPlan } from "@/lib/progress/focus-session";
import { DEFAULT_STORY_ID } from "@/lib/prototype/story-ids";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { pickStory } from "@/lib/prototype/story-ids";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads the account for /focus and /rest (#257). `create` lets /focus open a session (or replace
 * one for an older Plan); /rest only continues an open session and never writes.
 */
export async function loadFocusPlan(
  client: SupabaseClient,
  userId: string,
  goalId: string | null,
  create: boolean,
): Promise<{ plan: AccountFocusPlan; goalLine: string } | null> {
  const store = createSupabaseProgressStore(client);
  const progress = await store.read(userId, userId);
  const opened = openFocusSession(progress, goalId, {
    storyId: DEFAULT_STORY_ID,
    newId: () => crypto.randomUUID(),
  });
  if (!opened) return null;
  if (opened.writes.length > 0) {
    if (!create) return null;
    // One session per write: the older one is restarted before the new one opens.
    for (const session of opened.writes) {
      await store.write(userId, { userId, goals: [], sessions: [session] });
    }
  }
  const goalLine = pickStory(storyProfiles(), opened.plan.storyId).goalShort;
  return { plan: opened.plan, goalLine };
}
