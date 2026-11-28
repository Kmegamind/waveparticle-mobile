import { createClock } from "@/lib/clock";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import { syncSession, type FocusSession, type SessionPlan } from "@/lib/prototype/session";
import type {
  AccountProgress,
  LineKind,
  ProgressGoal,
  ProgressSession,
  SessionLine,
  SessionStep,
} from "./account-progress";

/**
 * The signed-in focus and rest pages (#257) on the account. Pure functions: the server pages and
 * the server action read the account, call these, and write the result with the progress store.
 *
 * What lives on the account: the Goal's open session, each Step's opened and done times, and every
 * line he showed (background card, story cards, pause messages, return pop-ups). What stays on
 * the device (docs/decisions/0014): the running clock, the pause count and the rest conversation.
 */

/**
 * True when the Story was turned off for this session (#114, STUDY-SESSION): `sessions.story_off_at`
 * is set. The session keeps its Companion and story, but never counts as story progress (no Life
 * Path row, no summary, no Story record).
 */
export function isStoryOff(session: Pick<ProgressSession, "storyOffAt">): boolean {
  return typeof session.storyOffAt === "string" && session.storyOffAt.length > 0;
}

/**
 * Whether the Story was on when this Step was done (#114): a Step done before `story_off_at` was
 * done with the Story on. Null for a Step not done.
 */
export function doneWithStory(
  session: Pick<ProgressSession, "storyOffAt">,
  step: Pick<SessionStep, "doneAt">,
): boolean | null {
  if (step.doneAt === null) return null;
  if (!isStoryOff(session)) return true;
  return Date.parse(step.doneAt) < Date.parse(session.storyOffAt!);
}

/** The browser key of one account session's device state. */
export function accountSessionKey(sessionId: string): string {
  return `waveparticle.session.${sessionId}`;
}

/**
 * The device key of a Plan. A session turned Story-off (#114) gets its own key, so the device
 * state of its Story run is not reused: it is rebuilt from the account with its done Steps.
 */
export function planStorageKey(plan: Pick<AccountFocusPlan, "sessionId" | "storyOff">): string {
  return plan.storyOff
    ? `${accountSessionKey(plan.sessionId)}.study`
    : accountSessionKey(plan.sessionId);
}

export type AccountFocusPlan = {
  sessionId: string;
  goalId: string;
  /** #521: the session's Companion (any Companion with stories, not only Oppenheimer). */
  companionId: string;
  storyId: string;
  goal: { text: string; minutes: number };
  steps: { title: string; description: string; minutes: number }[];
  /** Per Step, in Step order: done on the account. */
  done: boolean[];
  /** Per Step: the cards already shown, opening card first; empty when none was shown. */
  cards: string[][];
  /** The study condition (#114, F1-STUDY): no Companion, no cards, no return pop-up. */
  storyOff: boolean;
};

/**
 * `storyOff` is the account's research flag (#114): a new session is opened with the Story off,
 * and an open session that plays the Story is turned Story-off in place (STUDY-SESSION).
 */
type Deps = {
  storyId: string;
  /** #521: the Companion of the story a new session plays; the default Companion when left out. */
  companionId?: string;
  newId: () => string;
  storyOff?: boolean;
  now?: string;
};

const byPosition = <T extends { position: number }>(items: T[]) =>
  [...items].sort((left, right) => left.position - right.position);

function matchesPlan(session: ProgressSession, goal: ProgressGoal): boolean {
  const steps = byPosition(goal.steps);
  const sessionSteps = byPosition(session.steps);
  return (
    steps.length === sessionSteps.length &&
    steps.every((step, index) => sessionSteps[index].stepId === step.id)
  );
}

const CARD_KINDS: LineKind[] = ["background", "story_card"];

function planOf(goal: ProgressGoal, session: ProgressSession): AccountFocusPlan {
  const steps = byPosition(goal.steps);
  const sessionSteps = byPosition(session.steps);
  return {
    sessionId: session.id,
    goalId: goal.id,
    companionId: session.companionId,
    storyId: session.storyId,
    goal: { text: goal.text, minutes: steps.reduce((sum, step) => sum + step.minutes, 0) },
    steps: steps.map((step) => ({
      title: step.title,
      description: step.description ?? "",
      minutes: step.minutes,
    })),
    done: sessionSteps.map((step) => step.doneAt !== null),
    // #114: with the Story off no card goes back to the device, even one shown before.
    cards: sessionSteps.map((sessionStep) =>
      isStoryOff(session)
        ? []
        : session.lines
            .filter(
              (line) => line.sessionStepId === sessionStep.id && CARD_KINDS.includes(line.kind),
            )
            .sort((left, right) => left.seq - right.seq)
            .map((line) => line.text),
    ),
    storyOff: isStoryOff(session),
  };
}

/**
 * The session /focus works on: the Goal's open session for its current Plan, or a new one. A
 * session for an older Plan of the same Goal (Start again changed its Steps) is marked restarted
 * first. `writes` lists the sessions to save, in order. Without a Goal id, the Goal of the open
 * session is continued. Null when there is no Goal to work on.
 */
export function openFocusSession(
  progress: AccountProgress,
  goalId: string | null,
  deps: Deps,
): { plan: AccountFocusPlan; writes: ProgressSession[] } | null {
  const id = goalId ?? progress.sessions.find((session) => session.state === "open")?.goalId;
  const goal = progress.goals.find((item) => item.id === id);
  if (!goal || goal.steps.length === 0 || goal.status === "done") return null;

  const found = progress.sessions.find(
    (session) => session.goalId === goal.id && session.state === "open",
  );
  const now = deps.now ?? new Date().toISOString();
  if (found && matchesPlan(found, goal)) {
    // The Story freezes (#114): the open Story session keeps its Companion, story, done Steps and
    // shown cards, and is marked Story-off from now, so it never finishes a story or makes a Life
    // Path row. A Story-off session stays so when the flag is removed.
    if (deps.storyOff && !isStoryOff(found)) {
      const frozen = { ...found, storyOffAt: now };
      return { plan: planOf(goal, frozen), writes: [frozen] };
    }
    return { plan: planOf(goal, found), writes: [] };
  }

  const writes: ProgressSession[] = [];
  // A session for an older Plan is restarted as it was: its Story state is not changed.
  if (found) writes.push({ ...found, state: "restarted" });
  const session: ProgressSession = {
    id: deps.newId(),
    goalId: goal.id,
    companionId: deps.companionId ?? DEFAULT_COMPANION_ID,
    storyId: deps.storyId,
    // #114: the new session follows the account's research flag as read now.
    storyOffAt: deps.storyOff ? now : null,
    state: "open",
    backgroundCard: null,
    backgroundCardSource: null,
    mergedKeyMoments: [],
    closingLine: null,
    steps: byPosition(goal.steps).map((step, position): SessionStep => ({
      id: deps.newId(),
      stepId: step.id,
      position,
      openedAt: null,
      doneAt: null,
    })),
    lines: [],
  };
  writes.push(session);
  return { plan: planOf(goal, session), writes };
}

export type SnapshotLine = {
  step: number;
  kind: LineKind;
  /** Position of a card within its Step (0 is the opening card); null for other lines. */
  seq: number | null;
  text: string;
  pauseNumber: number | null;
};

/** What the browser reports after each change: positions and shown lines, never the clock. */
export type FocusSnapshot = {
  sessionId: string;
  current: number;
  opened: boolean[];
  lines: SnapshotLine[];
};

export function snapshotOf(sessionId: string, session: FocusSession): FocusSnapshot {
  const lines: SnapshotLine[] = [];
  session.steps.forEach((step, index) => {
    // A Step's cards count as shown once its clock started; the next Step's cards that were asked
    // for ahead of time are not shown yet.
    if (!step.cards || !step.clock || step.cards.none) return;
    lines.push({
      step: index,
      kind: index === 0 ? "background" : "story_card",
      seq: 0,
      text: step.cards.opening,
      pauseNumber: null,
    });
    step.cards.story.slice(0, step.shownStory).forEach((text, position) => {
      lines.push({ step: index, kind: "story_card", seq: position + 1, text, pauseNumber: null });
    });
  });
  const first = session.rest?.messages[0];
  if (session.rest && first?.from === "him") {
    lines.push({
      step: session.current,
      kind: "pause_message",
      seq: null,
      text: first.text,
      pauseNumber: session.rest.pauseNumber,
    });
  }
  if (session.returnPending && session.returnLine !== null) {
    lines.push({
      step: session.current,
      kind: "return_popup",
      seq: null,
      text: session.returnLine,
      pauseNumber: null,
    });
  }
  return {
    sessionId,
    current: session.current,
    opened: session.steps.map((step) => step.clock !== null),
    lines,
  };
}

const MAX_LINE_LENGTH = 2_000;
// A card's place in its Step. A one-Step Plan holds the story's whole deck, and a regenerated deck
// can hold dozens of cards (#516), so the bound only stops a malformed snapshot.
const MAX_CARD_SEQ = 200;
const RECORDED_KINDS: LineKind[] = ["background", "story_card", "pause_message", "return_popup"];

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Applies one snapshot from the browser to the account's session. The snapshot comes from a
 * public server action, so every field is checked and anything malformed is dropped. A line that
 * is already stored is never written again, and a stored line never changes. Null when the
 * session is not this account's open or completed session.
 */
export function applyFocusSnapshot(
  progress: AccountProgress,
  snapshot: FocusSnapshot,
  deps: { now: string; newId: () => string; userId: string },
): { goal: ProgressGoal; session: ProgressSession } | null {
  if (progress.userId !== deps.userId || typeof snapshot?.sessionId !== "string") return null;
  const session = progress.sessions.find((item) => item.id === snapshot.sessionId);
  if (!session || (session.state !== "open" && session.state !== "completed")) return null;
  const goal = progress.goals.find((item) => item.id === session.goalId);
  if (!goal) return null;

  const steps = byPosition(session.steps);
  const total = steps.length;
  const current = isWholeNumber(snapshot.current, 0, total) ? snapshot.current : null;
  if (current === null) return null;
  const opened = Array.isArray(snapshot.opened) ? snapshot.opened : [];

  const nextSteps = steps.map((step, index): SessionStep => {
    const done = index < current;
    const isOpen = done || opened[index] === true;
    return {
      ...step,
      openedAt: step.openedAt ?? (isOpen ? deps.now : null),
      doneAt: done ? (step.doneAt ?? deps.now) : null,
    };
  });

  const lines: SessionLine[] = [...session.lines];
  // #114: a session with the Story off stores no new line of his, whatever the browser sends.
  const incoming = Array.isArray(snapshot.lines) && !isStoryOff(session) ? snapshot.lines : [];
  for (const line of incoming) {
    if (!line || !RECORDED_KINDS.includes(line.kind)) continue;
    if (!isWholeNumber(line.step, 0, total - 1)) continue;
    if (typeof line.text !== "string" || line.text.length === 0) continue;
    if (line.text.length > MAX_LINE_LENGTH) continue;
    const stepId = steps[line.step].id;
    const inStep = lines.filter((item) => item.sessionStepId === stepId);

    let seq: number;
    let pauseNumber: number | null = null;
    if (line.kind === "pause_message") {
      if (!isWholeNumber(line.pauseNumber, 1, 1_000)) continue;
      if (inStep.some((item) => item.kind === line.kind && item.pauseNumber === line.pauseNumber)) {
        continue;
      }
      pauseNumber = line.pauseNumber;
      seq = inStep.reduce((max, item) => Math.max(max, item.seq + 1), 0);
    } else if (line.kind === "return_popup") {
      if (inStep.some((item) => item.kind === line.kind && item.text === line.text)) continue;
      seq = inStep.reduce((max, item) => Math.max(max, item.seq + 1), 0);
    } else {
      if (!isWholeNumber(line.seq, 0, MAX_CARD_SEQ)) continue;
      if ((line.kind === "background") !== (line.step === 0 && line.seq === 0)) continue;
      if (inStep.some((item) => CARD_KINDS.includes(item.kind) && item.seq === line.seq)) {
        continue;
      }
      seq = line.seq;
    }
    lines.push({
      id: deps.newId(),
      sessionStepId: stepId,
      seq,
      kind: line.kind,
      cardId: null,
      // #300: his cards are the story's pre-made cards; the pause message and return pop-up are
      // still written live.
      source: CARD_KINDS.includes(line.kind) ? "authored" : "generated",
      text: line.text,
      pauseNumber,
      shownAt: deps.now,
    });
  }

  const completed = current >= total;
  // #75 AC5: a One-time Goal moves to Done at its last Step; an Ongoing Goal stays In progress with
  // no open Plan (the session is completed), so its next visit starts a new run. Undo reopens both.
  const goalDone = completed && goal.kind !== "ongoing";
  return {
    goal: { ...goal, status: goalDone ? "done" : "in_progress" },
    session: { ...session, state: completed ? "completed" : "open", steps: nextSteps, lines },
  };
}

export function sessionPlanOf(plan: AccountFocusPlan): SessionPlan & {
  goal: { text: string; minutes: number };
} {
  return { goal: plan.goal, steps: plan.steps, storyId: plan.storyId };
}

/**
 * The focus session rebuilt from the account when this device has none (another device, or
 * cleared storage). Done Steps stay done and every shown card is shown again as it was; the
 * current Step's clock starts again from its full time (docs/decisions/0014). A Step with no
 * stored card has its cards asked for as usual.
 */
export function seedFocusSession(
  plan: AccountFocusPlan,
  speed: number,
  nowMs: number,
): FocusSession {
  const base = syncSession(null, sessionPlanOf(plan), speed);
  const firstOpen = plan.done.findIndex((done) => !done);
  const current = firstOpen === -1 ? plan.steps.length : firstOpen;
  return {
    ...base,
    current,
    steps: base.steps.map((step, index) => {
      const cards = plan.cards[index] ?? [];
      if (cards.length === 0) return step;
      return {
        ...step,
        // #300: the current Step's other pre-made cards are asked for again (pinned, so the
        // shown ones stay the same).
        cards:
          index === current
            ? { opening: cards[0], story: cards.slice(1), partial: true as const }
            : { opening: cards[0], story: cards.slice(1) },
        shownStory: cards.length - 1,
        clock: index === current ? createClock(step.targetSeconds, nowMs) : null,
      };
    }),
  };
}
