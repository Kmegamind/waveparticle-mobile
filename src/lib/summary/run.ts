import { isFinished, planKey, type FocusSession } from "@/lib/prototype/session";
import { DEFAULT_STORY_ID } from "@/lib/prototype/story-ids";
import type { PrototypeState, PrototypeStep, PrototypeStorage } from "@/lib/prototype/store";

/**
 * The finished run as the summary (END, #258) reads it from the browser. The focus page keeps the
 * run in the browser only; nothing here changes it.
 */
export type FinishedRun = {
  storyId: string;
  steps: PrototypeStep[];
  /** Real seconds on each Step's clock at Done, overtime included. */
  focusSeconds: number[];
  /** His cards shown in this run, oldest first (for the per-run list of the closing call). */
  earlierLines: string[];
};

export function finishedRun(plan: PrototypeState, session: FocusSession | null): FinishedRun | null {
  if (!session || !plan.goal || plan.steps.length === 0) return null;
  if (!isFinished(session) || session.planKey !== planKey(plan)) return null;
  return {
    storyId: plan.storyId ?? DEFAULT_STORY_ID,
    steps: plan.steps,
    focusSeconds: session.steps.map((step) =>
      step.clock ? Math.round(step.clock.elapsedBeforeRunMs / 1000) : 0,
    ),
    earlierLines: session.steps.flatMap((step) =>
      step.cards ? [step.cards.opening, ...step.cards.story.slice(0, step.shownStory)] : [],
    ),
  };
}

export function planMinutesOf(steps: { minutes: number }[]): number {
  return steps.reduce((total, step) => total + step.minutes, 0);
}

/** Focus time in whole minutes; no verdict (SUMMARY-RECORD). */
export function focusLabel(totalSeconds: number): string {
  if (totalSeconds < 30) return "Under 1 min";
  return `${Math.round(totalSeconds / 60)} min`;
}

/** What END shows once the run is saved: his two lines and the next story, if any. */
export type FinishShown = { closingLine: string; carryLine: string; next: string | null };

export type SummaryRecord = { runId: string; shown?: FinishShown };

export const SUMMARY_KEY = "waveparticle.summary";

type Stored = { planKey: string; record: SummaryRecord };

export function loadSummaryRecord(storage: PrototypeStorage, key: string): SummaryRecord | null {
  try {
    const raw = storage.getItem(SUMMARY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed.planKey !== key || typeof parsed.record?.runId !== "string") return null;
    return parsed.record;
  } catch {
    return null;
  }
}

export function saveSummaryRecord(
  storage: PrototypeStorage,
  key: string,
  record: SummaryRecord,
): void {
  try {
    storage.setItem(SUMMARY_KEY, JSON.stringify({ planKey: key, record } satisfies Stored));
  } catch {
    // Storage is unavailable; the summary still works for this visit.
  }
}

export function clearSummaryRecord(storage: PrototypeStorage): void {
  try {
    storage.removeItem(SUMMARY_KEY);
  } catch {
    // Nothing stored.
  }
}
