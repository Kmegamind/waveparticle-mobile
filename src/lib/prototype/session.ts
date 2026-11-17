import {
  createClock,
  pauseClock,
  remainingSeconds,
  resumeClock,
  type ClockState,
} from "@/lib/clock";
import { DEFAULT_STORY_ID } from "./story-ids";

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
/** Away this long or more, the return pop-up opens before the clock restarts (T6, R1). */
export const AWAY_MS = 5 * 60_000;

export type StepCards = {
  /** The one card a Step opens with: the background card on Step 1, otherwise what he just finished. */
  opening: string;
  /** The n story cards, already limited to the Step's maximum. */
  story: string[];
  /**
   * Pre-made cards of the signed-in focus page (#300, CARDS-SPREAD): the story's own cards,
   * never cut by the 1 to 5 limit, which applies to live cards only.
   */
  premade?: true;
  /**
   * Rebuilt on another device from the cards already shown (#300): the Step asks for its cards
   * again, and the full set replaces these, keeping the shown count and the clock.
   */
  partial?: true;
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
  /** When the clock first froze; the absence rule counts from here (T6, R1). */
  pausedAtMs: number | null;
  /** Pauses so far in each Step. Passed to his pause message only; never shown (F1, PAUSE-3). */
  pauses: number[];
  /** The open rest conversation (R1, R1-C), kept so a reopened rest page looks the same. */
  rest: RestState | null;
  /** The return pop-up (F-RET) that must open before the clock restarts. */
  returnPending: ReturnTrigger | null;
  /** His return line once written: stored once and never regenerated (#57 AC3). */
  returnLine: string | null;
};

/** Why the return pop-up opens: Back to step from rest, or back after 5 minutes or more away. */
export type ReturnTrigger = "rest" | "absence";

export type RestMessage = { from: "him" | "you"; text: string };

export type RestState = {
  /** 1-based number of this Pause in the current Step. */
  pauseNumber: number;
  messages: RestMessage[];
  /** Unsent text in the composer; kept when the page is reopened. */
  draft: string;
};

export type SessionPlan = {
  goal: { text: string; minutes: number } | null;
  steps: { title: string; description: string; minutes: number }[];
  /** The story being played (#254): a session of one story is never reused for another. */
  storyId?: string;
};

/** Test-only speed-up from `?speed=`: a whole number from 1 to 600, otherwise 1. */
export function parseSpeed(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const speed = Number(value);
  return speed >= 1 && speed <= 600 ? speed : 1;
}

export type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function planKey(plan: SessionPlan): string {
  // A Plan without a story is chapter 8, so sessions stored before #254 keep their key.
  const story = plan.storyId && plan.storyId !== DEFAULT_STORY_ID ? [plan.storyId] : [];
  return JSON.stringify([plan.goal, plan.steps, ...story]);
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
    pausedAtMs: null,
    pauses: plan.steps.map(() => 0),
    rest: null,
    returnPending: null,
    returnLine: null,
  };
}

/** True while a Step has no cards yet, or only the shown cards of a rebuilt session (#300). */
export function needsCards(step: StepRun | undefined): boolean {
  return !step?.cards || step.cards.partial === true;
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
  if (!step || (step.cards && !step.cards.partial)) return session;
  const minutes = (step.targetSeconds * session.speed) / 60;
  const limited = cards.premade
    ? { opening: cards.opening, story: [...cards.story], premade: true as const }
    : { opening: cards.opening, story: cards.story.slice(0, maxStoryCards(minutes)) };
  let next: StepRun = { ...step, cards: limited };
  // A partial Step already runs: its clock and shown cards stay as they are.
  if (step.cards?.partial) return replaceStep(session, index, next);
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
  return replaceStep({ ...next, holdUntilMs, paused: false, pausedAtMs: null }, nextIndex, {
    ...following,
    clock,
  });
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
  return { ...next, current: back, holdUntilMs, undo: null, paused: false, pausedAtMs: null };
}

/** Freezes the current Step's clock (the page was left, or Pause was pressed). */
export function pauseSession(session: FocusSession, nowMs: number): FocusSession {
  if (session.paused) return session;
  const frozen = { ...session, paused: true, pausedAtMs: nowMs };
  const step = session.steps[session.current];
  if (!step?.clock) return frozen;
  return replaceStep(frozen, session.current, {
    ...tick(session, nowMs).steps[session.current],
    clock: pauseClock(step.clock, nowMs),
  });
}

/** Restarts the clock from the frozen value; a hold that has not finished is kept. */
export function resumeSession(session: FocusSession, nowMs: number): FocusSession {
  if (!session.paused) return session;
  const running = { ...session, paused: false, pausedAtMs: null };
  const step = session.steps[session.current];
  if (!step?.clock) return running;
  const startAt = Math.max(nowMs, session.holdUntilMs ?? 0);
  return replaceStep(running, session.current, {
    ...step,
    clock: resumeClock(step.clock, startAt),
  });
}

/** Pause: freezes the clock, counts this Pause for the current Step and opens a new rest. */
export function startRest(session: FocusSession, nowMs: number): FocusSession {
  if (isFinished(session)) return session;
  const frozen = pauseSession(session, nowMs);
  const pauses = session.steps.map((_, index) => frozen.pauses[index] ?? 0);
  pauses[session.current] += 1;
  return {
    ...frozen,
    pauses,
    rest: { pauseNumber: pauses[session.current], messages: [], draft: "" },
    returnPending: null,
    returnLine: null,
  };
}

/** The number of the latest Pause in the current Step (0 before the first). */
export function pauseNumberFor(session: FocusSession): number {
  return session.pauses[session.current] ?? 0;
}

export function addRestMessage(session: FocusSession, message: RestMessage): FocusSession {
  if (!session.rest) return session;
  return { ...session, rest: { ...session.rest, messages: [...session.rest.messages, message] } };
}

/** His first message for this Pause goes first, even if the user wrote before it arrived. */
export function addFirstRestMessage(session: FocusSession, text: string): FocusSession {
  if (!session.rest || hasFirstRestMessage(session)) return session;
  const messages: RestMessage[] = [{ from: "him", text }, ...session.rest.messages];
  return { ...session, rest: { ...session.rest, messages } };
}

export function hasFirstRestMessage(session: FocusSession): boolean {
  return session.rest?.messages[0]?.from === "him";
}

export function setRestDraft(session: FocusSession, draft: string): FocusSession {
  if (!session.rest) return session;
  return { ...session, rest: { ...session.rest, draft } };
}

/** Back to step: the rest ends, the clock stays frozen and the return pop-up is due. */
export function backFromRest(session: FocusSession): FocusSession {
  return { ...session, rest: null, returnPending: "rest", returnLine: null };
}

/** Home from the rest page: the rest ends and the Step stays paused (FLOW 3.6). */
export function leaveRest(session: FocusSession): FocusSession {
  return { ...session, rest: null };
}

/**
 * Opening the focus page with a frozen clock. Coming from a rest that is still open counts as
 * Back to step. Away 5 minutes or more (60/s seconds at test speed s) asks for the absence pop-up;
 * a shorter absence resumes the clock with no pop-up. The pop-up keeps the clock frozen.
 */
export function returnOnOpen(session: FocusSession, nowMs: number): FocusSession {
  if (!session.paused || isFinished(session) || session.returnPending) return session;
  if (session.rest) return backFromRest(session);
  const awayMs = session.pausedAtMs === null ? 0 : nowMs - session.pausedAtMs;
  if (awayMs >= AWAY_MS / session.speed) return { ...session, returnPending: "absence" };
  return resumeSession(session, nowMs);
}

export function setReturnLine(session: FocusSession, text: string): FocusSession {
  if (session.returnLine !== null) return session;
  return { ...session, returnLine: text };
}

/** Start in the return pop-up: it closes and the clock starts from the frozen value. */
export function startFromReturn(session: FocusSession, nowMs: number): FocusSession {
  return resumeSession({ ...session, returnPending: null, returnLine: null }, nowMs);
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

/** Sessions stored before the rest page have no rest fields; they get the defaults. */
function withRestFields(session: FocusSession): FocusSession {
  const partial = session as Partial<FocusSession> & FocusSession;
  return {
    ...session,
    pausedAtMs: partial.pausedAtMs ?? null,
    pauses: session.steps.map((_, index) => partial.pauses?.[index] ?? 0),
    rest: partial.rest ?? null,
    returnPending: partial.returnPending ?? null,
    returnLine: partial.returnLine ?? null,
  };
}

/** `key` is the test path's own key unless a signed-in session passes its own (#257). */
export function loadSession(storage: SessionStorage, key = SESSION_KEY): FocusSession | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? withRestFields(parsed) : null;
  } catch {
    return null;
  }
}

export function saveSession(
  storage: SessionStorage,
  session: FocusSession,
  key = SESSION_KEY,
): void {
  try {
    storage.setItem(key, JSON.stringify(session));
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
