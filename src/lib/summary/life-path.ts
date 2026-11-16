import type { StoryContent } from "@/lib/content/types";
import type { AccountProgress } from "@/lib/progress/account-progress";
import { storyById, storyIds, storyProfile } from "@/lib/prototype/story-inputs";
import { COMPANION_ID } from "./finish-run";

/**
 * Oppenheimer's Life Path for one account (#258, #50, #51, CPAGE). A story is finished when the
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
};

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
): LifePathView {
  const STORY_IDS = storyIds(content);
  const start = Math.max(0, STORY_IDS.indexOf(startId ?? STORY_IDS[0]));
  const firstLine = new Map<string, string>();
  for (const session of progress.sessions) {
    if (session.state !== "completed" || session.companionId !== COMPANION_ID) continue;
    if (!firstLine.has(session.storyId)) firstLine.set(session.storyId, session.closingLine ?? "");
  }
  const currentId = STORY_IDS.slice(start).find((id) => !firstLine.has(id)) ?? null;
  const row = (id: string): LifePathRow => {
    const profile = storyProfile(content, id);
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
  const periods: LifePathView["periods"] = [];
  for (const id of STORY_IDS) {
    const name = storyById(content, id).period;
    const last = periods.at(-1);
    if (last && last.name === name) last.rows.push(row(id));
    else periods.push({ name, rows: [row(id)] });
  }
  return { periods, currentId };
}

/** The story a new signed-in session plays (#258 AC10): the current one, or the last story. */
export function storyForNewSession(content: StoryContent, progress: AccountProgress): string {
  return lifePath(content, progress).currentId ?? storyIds(content).at(-1) ?? "";
}
