import { getStoryContent } from "@/lib/content/repository";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import { NO_STORY, openFocusSession, type AccountFocusPlan } from "@/lib/progress/focus-session";
import { storyProfiles } from "@/lib/prototype/story-inputs";
import { pickStory } from "@/lib/prototype/story-ids";
import { storyIsOff } from "@/lib/research/condition";
import { storyForNewSession } from "@/lib/summary/life-path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads the account for /focus and /rest (#257). `create` lets /focus open a session (or replace
 * one for an older Plan, or turn an open Story session Story-off for the research flag, #114);
 * /rest only continues an open session and never writes.
 */
export async function loadFocusPlan(
  client: SupabaseClient,
  userId: string,
  goalId: string | null,
  create: boolean,
): Promise<{ plan: AccountFocusPlan; goalLine: string; who: string } | null> {
  const store = createSupabaseProgressStore(client);
  // #114: a failed read of the research flag throws, so the page does not open with the Story.
  const [progress, storyOff] = await Promise.all([store.read(userId, userId), storyIsOff(client)]);
  // The study condition needs no story content: no Companion, no cards (F1-STUDY).
  const content = storyOff ? null : await getStoryContent();
  // A new session plays the Life Path's current story (#258); an open one keeps its own.
  const storyId = content ? storyForNewSession(content, progress) : NO_STORY;
  if (!storyId) return null;
  const opened = openFocusSession(progress, goalId, {
    storyId,
    storyOff,
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
  if (opened.plan.storyOff || !content) return { plan: opened.plan, goalLine: "", who: "" };
  const story = pickStory(storyProfiles(content), opened.plan.storyId);
  // "My goal" and the "Who I am" sheet (#72) show the session's own story.
  return { plan: opened.plan, goalLine: story.goalShort, who: story.who };
}
