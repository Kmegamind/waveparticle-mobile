import type { StoryContent } from "@/lib/content/types";
import type { AccountProgress } from "@/lib/progress/account-progress";
import { storyById, storyIds, storyProfile } from "@/lib/prototype/story-inputs";
import { isStoryOff } from "@/lib/progress/focus-session";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";

/**
 * One Companion's Life Path for one account (#521: any Companion, the default one when none is
 * named; it was Oppenheimer's only) (#258, #50, #51, CPAGE). A story is finished when the
 * account has a completed session for it; the current story is the first one in order that is not
 * finished (play is in order; new users start at chapter 1, M1). No dates, ages or counts. The
 * periods are the stories' `period` names, in story order (#284).
 */
/**
 * The status of the period names (PERIODS, 2026-11-12). The names are each story's `period`; they
 * are the drafts of prototype v4 and not approved yet (docs/DECISIONS.md, open item PERIOD-NAMES).
 */
export const PERIOD_STATUS = "draft, not approved (PERIOD-NAMES)";

export type LifePathRow = {
  id: string;
  title: string;
  state: "finished" | "memory" | "current" | "later";
  /**
   * Finished: his closing line from that run. Memory and current: the story's goal sentence (an
   * input, not a stored line of his). Later: none.
   */
  line: string | null;
  /**
   * Finished: the record of that run, the one whose closing line the row shows (#94 AC1). Null for
   * every other row: a story he lived before the account's start has no record (#94 AC4).
   */
  recordHref: string | null;
};

/** The Story record of one finished run, opened from the Life Path (#94). */
export function storyRecordHref(sessionId: string): string {
  return `/me/history/${encodeURIComponent(sessionId)}/chapter?from=life-path`;
}

export type LifePathView = {
  periods: { name: string; rows: LifePathRow[] }[];
  currentId: string | null;
};

/**
 * `startId` is the account's starting story (#97 AC2): the stories before it are "his memory" rows
 * and are never played. Under M1 every account starts at chapter 1, so there are none yet.
 */
export function lifePath(
  content: StoryContent,
  progress: AccountProgress,
  startId?: string,
  companionId: string = DEFAULT_COMPANION_ID,
): LifePathView {
  const STORY_IDS = storyIds(content, companionId);
  const start = Math.max(0, STORY_IDS.indexOf(startId ?? STORY_IDS[0]));
  const firstLine = new Map<string, string>();
  const firstRun = new Map<string, string>();
  for (const session of progress.sessions) {
    // #114: a session with the Story turned off never finishes a story.
    if (session.state !== "completed" || session.companionId !== companionId) continue;
    if (isStoryOff(session)) continue;
    if (firstLine.has(session.storyId)) continue;
    firstLine.set(session.storyId, session.closingLine ?? "");
    firstRun.set(session.storyId, session.id);
  }
  const currentId = STORY_IDS.slice(start).find((id) => !firstLine.has(id)) ?? null;
  const row = (id: string): LifePathRow => {
    const profile = storyProfile(content, id);
    if (firstLine.has(id)) {
      return {
        id,
        title: profile.title,
        state: "finished",
        line: firstLine.get(id) || null,
        recordHref: storyRecordHref(firstRun.get(id)!),
      };
    }
    if (STORY_IDS.indexOf(id) < start) {
      return {
        id,
        title: profile.title,
        state: "memory",
        line: profile.goalShort,
        recordHref: null,
      };
    }
    if (id === currentId) {
      return {
        id,
        title: profile.title,
        state: "current",
        line: profile.goalShort,
        recordHref: null,
      };
    }
    return { id, title: profile.title, state: "later", line: null, recordHref: null };
  };
  const periods: LifePathView["periods"] = [];
  for (const id of STORY_IDS) {
    const name = storyById(content, id).period;
    const last = periods.at(-1);
    if (last && last.name === name) last.rows.push(row(id));
    else periods.push({ name, rows: [row(id)] });
  }
  return { periods, currentId };
}

/**
 * The story a new signed-in session plays (#258 AC10): the current one, or the last story. Null
 * when the run has no stories at all; then no session is opened.
 */
export function storyForNewSession(
  content: StoryContent,
  progress: AccountProgress,
  companionId: string = DEFAULT_COMPANION_ID,
): string | null {
  return (
    lifePath(content, progress, undefined, companionId).currentId ??
    storyIds(content, companionId).at(-1) ??
    null
  );
}
