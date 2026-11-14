import { PERIOD_DRAFTS } from "@/content/oppenheimer/periods";
import type { AccountProgress } from "@/lib/progress/account-progress";
import { STORY_IDS, storyProfile } from "@/lib/prototype/story-inputs";
import { COMPANION_ID } from "./finish-run";

/**
 * Oppenheimer's Life Path for one account (#258, #50, #51, CPAGE). A story is finished when the
 * account has a completed session for it; the current story is the first one in order that is not
 * finished (play is in order; new users start at chapter 1, M1). No dates, ages or counts.
 */
export type LifePathRow = {
  id: string;
  title: string;
  state: "finished" | "memory" | "current" | "later";
  /**
   * Finished: his closing line from that run. Memory and current: the story's goal sentence (an
   * input, not a stored line of his). Later: none.
   */
  line: string | null;
};

export type LifePathView = {
  periods: { name: string; rows: LifePathRow[] }[];
  currentId: string | null;
};

/**
 * `startId` is the account's starting story (#97 AC2): the stories before it are "his memory" rows
 * and are never played. Under M1 every account starts at chapter 1, so there are none yet.
 */
export function lifePath(progress: AccountProgress, startId: string = STORY_IDS[0]): LifePathView {
  const start = Math.max(0, STORY_IDS.indexOf(startId));
  const firstLine = new Map<string, string>();
  for (const session of progress.sessions) {
    if (session.state !== "completed" || session.companionId !== COMPANION_ID) continue;
    if (!firstLine.has(session.storyId)) firstLine.set(session.storyId, session.closingLine ?? "");
  }
  const currentId = STORY_IDS.slice(start).find((id) => !firstLine.has(id)) ?? null;
  const row = (id: string): LifePathRow => {
    const profile = storyProfile(id);
    if (firstLine.has(id)) {
      return { id, title: profile.title, state: "finished", line: firstLine.get(id) || null };
    }
    if (STORY_IDS.indexOf(id) < start) {
      return { id, title: profile.title, state: "memory", line: profile.goalShort };
    }
    if (id === currentId)
      return { id, title: profile.title, state: "current", line: profile.goalShort };
    return { id, title: profile.title, state: "later", line: null };
  };
  return {
    periods: PERIOD_DRAFTS.map((period) => ({ name: period.name, rows: period.storyIds.map(row) })),
    currentId,
  };
}

/** The story a new signed-in session plays (#258 AC10): the current one, or the last story. */
export function storyForNewSession(progress: AccountProgress): string {
  return lifePath(progress).currentId ?? STORY_IDS[STORY_IDS.length - 1];
}
