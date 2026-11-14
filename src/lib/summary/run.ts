import { isFinished, type FocusSession } from "@/lib/prototype/session";

/**
 * The browser side of the summary (END, #258). The signed-in focus page (#257) keeps its clocks on
 * this device (decision 0014), so the real focus time is read here; everything else comes from
 * the account.
 */

/** Real seconds on each Step's clock at Done, overtime included; null until the last Done. */
export function focusSecondsOf(session: FocusSession | null): number | null {
  if (!session || !isFinished(session)) return null;
  return session.steps.reduce(
    (total, step) => total + (step.clock ? Math.round(step.clock.elapsedBeforeRunMs / 1000) : 0),
    0,
  );
}

/** Focus time in whole minutes; no verdict (SUMMARY-RECORD). */
export function focusLabel(totalSeconds: number): string {
  if (totalSeconds < 30) return "Under 1 min";
  return `${Math.round(totalSeconds / 60)} min`;
}

/** What END shows once the lines are stored: his two lines and the next story, if any. */
export type FinishShown = { closingLine: string; carryLine: string; next: string | null };
