import {
  createClock,
  pauseClock,
  remainingSeconds,
  resumeClock,
  type ClockState,
} from "@/lib/clock";

/**
 * Focus-page session for the sign-in-free test path (/try/focus). Browser-only, kept under its own
 * storage key so it never conflicts with the Goal and Steps in `store.ts`. All functions are pure
 * and take the time as an argument; the page passes `Date.now()`.
 *
 * Rules: docs/FLOW.md 3.7 to 3.9 and 4.4; docs/DECISIONS.md X2, X3, X6, F3, T1, T7, T8, T9.
 */
export const SESSION_KEY = "waveparticle.prototype.session";
const VERSION = 1;

/** The clock holds still this long after Done (X3) and after Undo. */
export const HOLD_MS = 1_200;
/** How long Undo is offered after Done (FLOW 3.9 and #27: about eight seconds). */
export const UNDO_MS = 8_000;
/** At least five minutes between story cards (T7). */
const MIN_CARD_GAP_MINUTES = 5;
const MAX_STORY_CARDS = 5;

export type StepCards = {
  /** The one card a Step opens with: the background card on Step 1, otherwise what he just finished. */
  opening: string;
  /** The n story cards, already limited to the Step's maximum. */
  story: string[];
};

export type StepRun = {
  cards: StepCards | null;
  /** null until the Step has started (its cards are ready). */
  clock: ClockState | null;
  /** Story cards already shown; they stay shown even after Undo (#12 AC4, #27 AC3). */
  shownStory: number;
  targetSeconds: number;
};

export type FocusSession = {
  version: typeof VERSION;
  planKey: string;
  /** Test-only speed-up: at speed s one minute of the plan lasts 60/s seconds. */
  speed: number;
  /** Index of the current Step; equal to the number of Steps when every Step is done. */
  current: number;
  steps: StepRun[];
  holdUntilMs: number | null;
  undo: { step: number; untilMs: number } | null;
  /** True while the clock is frozen because the user left the page or paused. */
  paused: boolean;
};

export type SessionPlan = {
  goal: { text: string; minutes: number } | null;
  steps: { title: string; description: string; minutes: number }[];
};

/** Test-only speed-up from `?speed=`: a whole number from 1 to 600, otherwise 1. */
export function parseSpeed(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const speed = Number(value);
  return speed >= 1 && speed <= 600 ? speed : 1;
}

export type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function planKey(plan: SessionPlan): string {
  return JSON.stringify([plan.goal, plan.steps]);
}

/** The most story cards a Step of this many minutes may have: 1 to 5, at least 5 minutes apart. */
export function maxStoryCards(minutes: number): number {
  return Math.min(MAX_STORY_CARDS, Math.max(1, Math.floor(minutes / MIN_CARD_GAP_MINUTES)));
}

function newSession(plan: SessionPlan, speed: number): FocusSession {
  return {
    version: VERSION,
    planKey: planKey(plan),
    speed,
    current: 0,
    steps: plan.steps.map((step) => ({
      cards: null,
      clock: null,
      shownStory: 0,
      targetSeconds: (step.minutes * 60) / speed,
    })),
    holdUntilMs: null,
    undo: null,
    paused: false,
  };
}

/** Keeps a stored session for the same plan and speed; otherwise starts a new one. */
export function syncSession(
  stored: FocusSession | null,
  plan: SessionPlan,
  speed: number,
): FocusSession {
  if (stored && stored.planKey === planKey(plan) && stored.speed === speed) return stored;
  return newSession(plan, speed);
}

function replaceStep(session: FocusSession, index: number, step: StepRun): FocusSession {
  const steps = session.steps.slice();
  steps[index] = step;
  return { ...session, steps };
}

/**
 * Stores a Step's cards once (a shown card never changes) and drops story cards beyond the limit
 * for its minutes. If this is the current Step and it has not started, its clock starts now, or
 * after the hold when the cards arrive during it.
 */
export function setStepCards(
  session: FocusSession,
  index: number,
  cards: StepCards,
  nowMs: number,
): FocusSession {
  const step = session.steps[index];
  if (!step || step.cards) return session;
  const minutes = (step.targetSeconds * session.speed) / 60;
  const limited = { opening: cards.opening, story: cards.story.slice(0, maxStoryCards(minutes)) };
  let next: StepRun = { ...step, cards: limited };
  if (index === session.current && !next.clock) {
    const startAt = Math.max(nowMs, session.holdUntilMs ?? 0);
    next = { ...next, clock: createClock(step.targetSeconds, startAt) };
    if (session.paused) next = { ...next, clock: pauseClock(next.clock!, nowMs) };
  }
  return replaceStep(session, index, next);
}

export function remainingFor(session: FocusSession, index: number, nowMs: number): number {
  const step = session.steps[index];
  if (!step) return 0;
  if (!step.clock) return Math.ceil(step.targetSeconds);
  return remainingSeconds(step.clock, nowMs);
}

function dueStoryCount(session: FocusSession, index: number, nowMs: number): number {
  const step = session.steps[index];
  if (!step?.cards || !step.clock) return 0;
  const n = step.cards.story.length;
  if (n === 0) return 0;
  const target = step.targetSeconds;
  const elapsed = target - remainingFor(session, index, nowMs);
  let due = 0;
  for (let k = 1; k <= n; k += 1) {
    // Card k arrives at k*y/n of foreground time; the last one exactly at 00:00 (T8).
    if (elapsed >= (k * target) / n - 1e-9) due = k;
  }
  return due;
}

/** The cards of a Step that are visible now, oldest first: the opening card, then story cards. */
export function visibleCards(session: FocusSession, index: number, nowMs: number): string[] {
  const step = session.steps[index];
  if (!step?.cards) return [];
  const count = Math.max(step.shownStory, dueStoryCount(session, index, nowMs));
  return [step.cards.opening, ...step.cards.story.slice(0, count)];
}

/** Records the story cards of the current Step that are due, so they stay shown. */
export function tick(session: FocusSession, nowMs: number): FocusSession {
  const index = session.current;
  const step = session.steps[index];
  if (!step) return session;
  const due = dueStoryCount(session, index, nowMs);
  if (due <= step.shownStory) return session;
  return replaceStep(session, index, { ...step, shownStory: due });
}

export function isHolding(session: FocusSession, nowMs: number): boolean {
  return session.holdUntilMs !== null && nowMs < session.holdUntilMs;
}

export function isFinished(session: FocusSession): boolean {
  return session.current >= session.steps.length;
}

/** Done: no question, always allowed except during the hold, so a double tap cannot skip a Step. */
export function completeStep(session: FocusSession, nowMs: number): FocusSession {
  if (isFinished(session) || isHolding(session, nowMs)) return session;
  const index = session.current;
  const step = session.steps[index];
  let next = replaceStep(session, index, {
    ...tick(session, nowMs).steps[index],
    clock: step.clock ? pauseClock(step.clock, nowMs) : null,
  });
  const nextIndex = index + 1;
  next = { ...next, current: nextIndex, undo: { step: index, untilMs: nowMs + UNDO_MS } };
  if (nextIndex >= session.steps.length) return { ...next, holdUntilMs: null };

  const holdUntilMs = nowMs + HOLD_MS;
  const following = next.steps[nextIndex];
  let clock = following.clock;
  if (clock) clock = resumeClock(clock, holdUntilMs);
  else if (following.cards) clock = createClock(following.targetSeconds, holdUntilMs);
  return replaceStep({ ...next, holdUntilMs, paused: false }, nextIndex, { ...following, clock });
}

export function canUndo(session: FocusSession, nowMs: number): boolean {
  return session.undo !== null && nowMs < session.undo.untilMs;
}

/** Undo: the previous Step returns with its own cards and its clock continues after the hold. */
export function undoDone(session: FocusSession, nowMs: number): FocusSession {
  if (!canUndo(session, nowMs) || !session.undo) return session;
  const back = session.undo.step;
  let next: FocusSession = session;
  const leaving = session.steps[session.current];
  if (leaving) {
    next = replaceStep(next, session.current, {
      ...tick(session, nowMs).steps[session.current],
      clock: leaving.clock ? pauseClock(leaving.clock, nowMs) : null,
    });
  }
  const holdUntilMs = nowMs + HOLD_MS;
  const step = next.steps[back];
  next = replaceStep(next, back, {
    ...step,
    clock: step.clock ? resumeClock(step.clock, holdUntilMs) : null,
  });
  return { ...next, current: back, holdUntilMs, undo: null, paused: false };
}

/** Freezes the current Step's clock (the page was left, or Pause was pressed). */
export function pauseSession(session: FocusSession, nowMs: number): FocusSession {
  if (session.paused) return session;
  const step = session.steps[session.current];
  if (!step?.clock) return { ...session, paused: true };
  return replaceStep({ ...session, paused: true }, session.current, {
    ...tick(session, nowMs).steps[session.current],
    clock: pauseClock(step.clock, nowMs),
  });
}

/** Restarts the clock from the frozen value; a hold that has not finished is kept. */
export function resumeSession(session: FocusSession, nowMs: number): FocusSession {
  if (!session.paused) return session;
  const step = session.steps[session.current];
  if (!step?.clock) return { ...session, paused: false };
  const startAt = Math.max(nowMs, session.holdUntilMs ?? 0);
  return replaceStep({ ...session, paused: false }, session.current, {
    ...step,
    clock: resumeClock(step.clock, startAt),
  });
}

function isSession(value: unknown): value is FocusSession {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === VERSION &&
    typeof record.planKey === "string" &&
    typeof record.speed === "number" &&
    typeof record.current === "number" &&
    Array.isArray(record.steps)
  );
}

export function loadSession(storage: SessionStorage): FocusSession | null {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(storage: SessionStorage, session: FocusSession): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage is unavailable; the page keeps working for this visit only.
  }
}

export function clearSession(storage: SessionStorage): void {
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
