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
  state: "finished" | "current" | "later";
  /** Finished: his closing line from that run. Current: the story's goal sentence. Later: none. */
  line: string | null;
};

export type LifePathView = {
  periods: { name: string; rows: LifePathRow[] }[];
  currentId: string | null;
};

export function lifePath(progress: AccountProgress): LifePathView {
  const firstLine = new Map<string, string>();
  for (const session of progress.sessions) {
    if (session.state !== "completed" || session.companionId !== COMPANION_ID) continue;
    if (!firstLine.has(session.storyId)) firstLine.set(session.storyId, session.closingLine ?? "");
  }
  const currentId = STORY_IDS.find((id) => !firstLine.has(id)) ?? null;
  const row = (id: string): LifePathRow => {
    const profile = storyProfile(id);
    if (firstLine.has(id)) {
      return { id, title: profile.title, state: "finished", line: firstLine.get(id) || null };
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
