import { companionById } from "@/content/companions";
import { homeView } from "@/lib/home/home-view";
import type { AccountProgress, ProgressSession } from "@/lib/progress/account-progress";

/**
 * The Me page (#81) and its history (#82) from the account only. A session is in the history once
 * at least one of its Steps was marked done (FLOW 4.6); its day is the first Done, and its
 * duration is the Plan minutes of its done Steps (Yue, 2026-11-14: focus time is not on the
 * account). No counts or totals come out of here.
 */

export type HistoryEntry = {
  sessionId: string;
  goalTitle: string;
  companion: string;
  firstDoneAt: string;
  minutes: number;
};

export type MeView = {
  current: { goalId: string; title: string; companion: string } | null;
  onHold: { goalId: string; title: string }[];
  history: HistoryEntry[];
};

/** The done Steps of a session, in Step order, with their Plan minutes; empty when none. */
export function doneSteps(progress: AccountProgress, session: ProgressSession) {
  const goal = progress.goals.find((item) => item.id === session.goalId);
  if (!goal) return [];
  return [...session.steps]
    .filter((step) => step.doneAt !== null)
    .sort((left, right) => left.position - right.position)
    .flatMap((sessionStep) => {
      const step = goal.steps.find((item) => item.id === sessionStep.stepId);
      return step
        ? [{ title: step.title, minutes: step.minutes, doneAt: sessionStep.doneAt! }]
        : [];
    });
}

export function historyEntry(
  progress: AccountProgress,
  session: ProgressSession,
): HistoryEntry | null {
  const goal = progress.goals.find((item) => item.id === session.goalId);
  const done = doneSteps(progress, session);
  if (!goal || done.length === 0) return null;
  return {
    sessionId: session.id,
    goalTitle: goal.title,
    companion: companionById(session.companionId).shortName,
    firstDoneAt: done.map((step) => step.doneAt).sort()[0],
    minutes: done.reduce((sum, step) => sum + step.minutes, 0),
  };
}

export function meView(progress: AccountProgress): MeView {
  const home = homeView(progress);
  const current =
    home.kind === "goal"
      ? { goalId: home.card.goalId, title: home.card.title, companion: home.card.companion }
      : null;
  const onHold = progress.goals
    .filter((goal) => goal.status === "on_hold")
    .map((goal) => ({ goalId: goal.id, title: goal.title }));
  const history = progress.sessions
    .map((session) => historyEntry(progress, session))
    .filter((entry): entry is HistoryEntry => entry !== null)
    .sort((left, right) => right.firstDoneAt.localeCompare(left.firstDoneAt));
  return { current, onHold, history };
}
