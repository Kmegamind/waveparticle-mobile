import { getStoryContent } from "@/lib/content/repository";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { openFocusSession, type AccountFocusPlan } from "@/lib/progress/focus-session";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { pickStory } from "@/lib/prototype/story-ids";
import { storyForNewSession } from "@/lib/summary/life-path";
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
  const [progress, content] = await Promise.all([store.read(userId, userId), getStoryContent()]);
  const opened = openFocusSession(progress, goalId, {
    // A new session plays the Life Path's current story (#258); an open one keeps its own.
    storyId: storyForNewSession(content, progress),
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
  const goalLine = pickStory(storyProfiles(content), opened.plan.storyId).goalShort;
  return { plan: opened.plan, goalLine };
}
