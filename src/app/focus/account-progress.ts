import { getStoryContentForViewer } from "@/lib/content/repository";
import { companionById } from "@/lib/content/companions";
import { createSupabaseProgressStore } from "@/lib/progress/supabase-progress";
import type { AccountFocusPlan } from "@/lib/progress/focus-session";
import { openViewerFocusSession } from "@/lib/progress/viewer-session";
import { storyProfile } from "@/lib/prototype/story-inputs";
import { storyIsOff } from "@/lib/research/condition";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The session's Companion as the session screens show him (#521). */
export type SessionCompanion = { id: string; name: string; portrait: string };

/** "My goal" and "Who I am" when the story has none published yet (#521). */
export const NOT_WRITTEN_YET = "Not written yet";

/**
 * Reads the account for /focus and /rest (#257). `create` lets /focus open a session (or replace
 * one for an older Plan, or turn an open Story session Story-off for the research flag, #114);
 * /rest only continues an open session and never writes. `companionId` is the Companion of a new
 * session (#521, `?companion=` from his Life Path; the default Companion otherwise). The story
 * content is the viewer's: a Companion who is not public is playable for an admin or writer only.
 */
export async function loadFocusPlan(
  client: SupabaseClient,
  userId: string,
  goalId: string | null,
  create: boolean,
  companionId: string = DEFAULT_COMPANION_ID,
): Promise<{
  plan: AccountFocusPlan;
  goalLine: string;
  who: string;
  companion: SessionCompanion;
} | null> {
  const store = createSupabaseProgressStore(client);
  // #114: a failed read of the research flag throws, so the page does not open with the Story.
  const [progress, storyOff, content] = await Promise.all([
    store.read(userId, userId),
    storyIsOff(client),
    getStoryContentForViewer(client),
  ]);
  // A new session plays the Life Path's current story (#258) of this Companion: storyForNewSession
  // in openViewerFocusSession. An open one keeps its own. With the Story off (#114) it is the story
  // where the Life Path froze.
  const opened = openViewerFocusSession(content, progress, goalId, {
    companionId,
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
  const own = companionById(content.companions, opened.plan.companionId);
  const companion = { id: own.id, name: own.shortName, portrait: own.portrait };
  if (opened.plan.storyOff) return { plan: opened.plan, goalLine: "", who: "", companion };
  const story = storyProfile(content, opened.plan.storyId);
  // "My goal" and the "Who I am" sheet (#72) show the session's own story; #521: a line that is
  // not published yet says so instead of inventing one.
  return {
    plan: opened.plan,
    goalLine: story.goalShort || NOT_WRITTEN_YET,
    who: story.who || NOT_WRITTEN_YET,
    companion,
  };
}
