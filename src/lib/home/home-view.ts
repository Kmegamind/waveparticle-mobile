import { companionById, type CompanionId } from "@/lib/content/companions";
import type { Companion } from "@/lib/content/types";
import type {
  AccountProgress,
  ProgressGoal,
  ProgressSession,
} from "@/lib/progress/account-progress";

/**
 * Which Home the signed-in account sees (#268: #90, #86, #89, #91, #92). Read only from the
 * account, so a new device shows the same Home. No counts, dates or sample data come out of here.
 */

export type HomeGoalCard = {
  goalId: string;
  title: string;
  /** The Companion's short name for the overline ("Goal · with Oppenheimer"). */
  companion: string;
  /** "Step 2: Draft", or the Step title alone for a one-Step Plan. */
  stepLabel: string;
  /** His newest shown card in this Goal's open session; null before any card was shown. */
  line: string | null;
  status: "in_progress";
};

export type HomeView =
  | { kind: "first" }
  | {
      kind: "goal";
      card: HomeGoalCard;
      companions: CompanionId[];
      inProgress: { goalId: string; title: string; companion: string }[];
    }
  | {
      kind: "none";
      carriedLine: string | null;
      replay: { goalId: string; title: string }[];
      companions: CompanionId[];
    };

const REPLAY_MAX = 3;
const CARD_KINDS = new Set(["background", "story_card"]);

const byPosition = <T extends { position: number }>(items: T[]) =>
  [...items].sort((left, right) => left.position - right.position);

function newest(values: (string | null | undefined)[]): string {
  return values.reduce<string>((best, value) => (value && value > best ? value : best), "");
}

function sessionActivity(session: ProgressSession): string {
  return newest([
    ...session.steps.flatMap((step) => [step.openedAt, step.doneAt]),
    ...session.lines.map((line) => line.shownAt),
  ]);
}

function activity(goal: ProgressGoal, sessions: ProgressSession[]): string {
  const own = sessions.filter((session) => session.goalId === goal.id);
  return newest([...own.map(sessionActivity)]) || goal.createdAt || "";
}

const newestFirst = (sessions: ProgressSession[]) => (left: ProgressGoal, right: ProgressGoal) =>
  activity(right, sessions).localeCompare(activity(left, sessions));

function openSession(goal: ProgressGoal, sessions: ProgressSession[]) {
  return sessions.find((session) => session.goalId === goal.id && session.state === "open");
}

function card(
  companions: Companion[],
  goal: ProgressGoal,
  sessions: ProgressSession[],
): HomeGoalCard {
  const open = openSession(goal, sessions);
  const steps = byPosition(goal.steps);
  const sessionSteps = open ? byPosition(open.steps) : [];
  const firstOpen = sessionSteps.findIndex((step) => step.doneAt === null);
  const index = firstOpen === -1 ? 0 : Math.min(firstOpen, steps.length - 1);
  const step = steps[index];
  const stepLabel =
    steps.length <= 1 ? (step?.title ?? "") : `Step ${index + 1}: ${step?.title ?? ""}`;
  const cards = (open?.lines ?? [])
    .filter((line) => CARD_KINDS.has(line.kind))
    .sort((left, right) => right.shownAt.localeCompare(left.shownAt) || right.seq - left.seq);
  return {
    goalId: goal.id,
    title: goal.title,
    companion: companionById(companions, open?.companionId ?? "").shortName,
    stepLabel,
    line: cards[0]?.text ?? null,
    status: "in_progress",
  };
}

function companionsOf(companions: Companion[], sessions: ProgressSession[]): CompanionId[] {
  const ids: CompanionId[] = [];
  for (const session of sessions) {
    if (session.state === "restarted") continue;
    const id = companionById(companions, session.companionId).id;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function companionOfGoal(
  companions: Companion[],
  goal: ProgressGoal,
  sessions: ProgressSession[],
): string {
  const own = sessions.find(
    (session) => session.goalId === goal.id && session.state !== "restarted",
  );
  return companionById(companions, own?.companionId ?? "").shortName;
}

/** `companions` comes from the story content (#284). */
export function homeView(progress: AccountProgress, allCompanions: Companion[]): HomeView {
  const { goals, sessions } = progress;
  // The first-visit card only for an account that never started a Goal (#90 AC3).
  if (goals.length === 0) return { kind: "first" };
  const companions = companionsOf(allCompanions, sessions);

  const inProgress = goals
    .filter((goal) => goal.status === "in_progress")
    .sort(newestFirst(sessions));
  if (inProgress.length > 0) {
    return {
      kind: "goal",
      card: card(allCompanions, inProgress[0], sessions),
      companions,
      inProgress: inProgress.map((goal) => ({
        goalId: goal.id,
        title: goal.title,
        companion: companionOfGoal(allCompanions, goal, sessions),
      })),
    };
  }

  const completed = sessions
    .filter((session) => session.state === "completed")
    .sort((left, right) => sessionActivity(right).localeCompare(sessionActivity(left)));
  const carriedLine =
    completed
      .map((session) => session.lines.find((line) => line.kind === "closing")?.text)
      .find((text): text is string => typeof text === "string" && text.length > 0) ?? null;
  const replay = goals
    .filter((goal) => goal.status === "done")
    .sort(newestFirst(sessions))
    .slice(0, REPLAY_MAX)
    .map((goal) => ({ goalId: goal.id, title: goal.title }));
  return { kind: "none", carriedLine, replay, companions };
}
