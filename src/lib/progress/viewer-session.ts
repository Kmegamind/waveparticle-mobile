import { hasStories } from "@/lib/content/companion-access";
import type { StoryContent } from "@/lib/content/types";
import { isStoryId, storyById } from "@/lib/prototype/story-inputs";
import { storyForNewSession } from "@/lib/summary/life-path";
import type { AccountProgress } from "./account-progress";
import { openFocusSession, type AccountFocusPlan } from "./focus-session";

/**
 * The session /focus and /rest work on, for one viewer (#521). `content` is the story content as
 * this account may play it (`contentForViewer`): every story for an admin or writer, the public
 * Companions' stories for anyone else.
 *
 * - A new session plays the current story of `companionId`'s Life Path. A Companion with no story
 *   in `content` (not public and the account has no content role, or no stories at all) opens
 *   nothing: the page shows no Plan rather than switching to another Companion.
 * - An open session keeps its own Companion and story, but only while its story is in `content`
 *   and belongs to its Companion. A session row a user wrote for a Companion who is not public
 *   (the API lets an account write its own sessions) therefore opens nothing either.
 */
export function openViewerFocusSession(
  content: StoryContent,
  progress: AccountProgress,
  goalId: string | null,
  deps: { companionId: string; newId: () => string; storyOff?: boolean; now?: string },
): ReturnType<typeof openFocusSession> {
  if (!hasStories(content, deps.companionId)) return null;
  const storyId = storyForNewSession(content, progress, deps.companionId);
  if (!storyId) return null;
  const opened = openFocusSession(progress, goalId, {
    storyId,
    companionId: deps.companionId,
    storyOff: deps.storyOff,
    newId: deps.newId,
    now: deps.now,
  });
  if (!opened || !mayPlayPlan(content, opened.plan)) return null;
  return opened;
}

/** True when the plan's story is in this content and is a story of the plan's Companion. */
export function mayPlayPlan(
  content: StoryContent,
  plan: Pick<AccountFocusPlan, "storyId" | "companionId">,
): boolean {
  return (
    isStoryId(content, plan.storyId) &&
    storyById(content, plan.storyId).companionId === plan.companionId
  );
}
