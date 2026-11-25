import {
  createClock,
  elapsedSeconds,
  leaveClock,
  pauseClock,
  remainingSeconds,
  resumeClock,
  returnFromLeave,
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
  /**
   * The study condition (#114, F1-STUDY): the Step has no cards at all. It starts its clock as if
   * its cards were in, and nothing is shown or recorded.
   */
  none?: true;
};

/** The "cards" of a Step with the Story off (#114): none, so the clock starts at once. */
export const NO_CARDS: StepCards = { opening: "", story: [], premade: true, none: true };

export type StepRun = {
  cards: StepCards | null;
  /** null until the Step has started (its cards are ready). */
  clock: ClockState | null;
  /** Story cards already shown; they stay shown even after Undo (#12 AC4, #27 AC3). */
  shownStory: number;
  targetSeconds: number;
  /**
   * Time away while "Keep the clock running when I leave" was on (#71): counted on the clock but
   * not by the cards, which use foreground time only (FLOW 3.1, F2).
   */
  awayMs?: number;
  /**
   * The time-up signal (the polite announcement and the haptic) has been given for this Step
   * (#115). Stored with the session, so a re-render, a Pause and return or a reload never give it
   * a second time.
   */
  timeUpSignalled?: true;
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
  /**
   * The pause messages of this run, oldest first (#56): the category and prop the code picked,
   * the stuck story and his message. The next Pause picks a new category and prop from it and is
   * checked against it. Never shown; missing in sessions stored before #56.
   */
  pauseLog?: PauseLogEntry[];
};

export type PauseLogEntry = {
  step: number;
  category?: string;
  prop?: string;
  story?: string;
  text: string;
};

/** Why the return pop-up opens: Back to step from rest, or back after 5 minutes or more away. */
export type ReturnTrigger = "rest" | "absence";

export type RestMessage = { from: "him" | "you"; text: string };

export type RestState = {
  /** 1-based number of this Pause in the current Step. */
  pauseNumber: number;
  /** Call one's stuck story, shown on its own slip before his message (#56, R1). */
  stuckStory?: string;
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
  const limited = cards.none
    ? NO_CARDS
    : cards.premade
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

/** Whether this Step's clock has reached 00:00 and its time-up signal has not been given (#115). */
export function timeUpDue(session: FocusSession, index: number, nowMs: number): boolean {
  const step = session.steps[index];
  if (!step?.clock || step.timeUpSignalled) return false;
  return remainingFor(session, index, nowMs) === 0;
}

/** Records that this Step's time-up signal has been given (#115). */
export function markTimeUp(session: FocusSession, index: number): FocusSession {
  const step = session.steps[index];
  if (!step || step.timeUpSignalled) return session;
  return replaceStep(session, index, { ...step, timeUpSignalled: true });
}

export function remainingFor(session: FocusSession, index: number, nowMs: number): number {
  const step = session.steps[index];
  if (!step) return 0;
  if (!step.clock) return Math.ceil(step.targetSeconds);
  return remainingSeconds(step.clock, nowMs);
}

/** Foreground seconds of a Step: the clock's time without time away with the clock running. */
function foregroundSeconds(step: StepRun, nowMs: number): number {
  if (!step.clock) return 0;
  const leftAt = step.clock.leftAtMs;
  const awayNow = leftAt !== null && step.clock.keepRunningWhenAway ? nowMs - leftAt : 0;
  return elapsedSeconds(step.clock, nowMs) - ((step.awayMs ?? 0) + Math.max(0, awayNow)) / 1_000;
}

function dueStoryCount(session: FocusSession, index: number, nowMs: number): number {
  const step = session.steps[index];
  if (!step?.cards || !step.clock) return 0;
  const n = step.cards.story.length;
  if (n === 0) return 0;
  const target = step.targetSeconds;
  const elapsed = foregroundSeconds(step, nowMs);
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
  if (!step?.cards || step.cards.none) return [];
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

/**
 * The page was left (hidden or closed). With "Keep the clock running when I leave" off (the
 * default) the clock freezes as on Pause (F2). With it on, the clock keeps running from
 * timestamps; only the moment of leaving is kept so the cards can skip the time away (#71).
 * The setting is read at each leave, so a change applies the next time the user leaves.
 */
export function leaveSession(
  session: FocusSession,
  nowMs: number,
  keepClockRunning: boolean,
): FocusSession {
  if (!keepClockRunning) return pauseSession(session, nowMs);
  const step = session.steps[session.current];
  if (session.paused || !step?.clock || step.clock.leftAtMs !== null) return session;
  return replaceStep(session, session.current, {
    ...tick(session, nowMs).steps[session.current],
    clock: leaveClock({ ...step.clock, keepRunningWhenAway: true }, nowMs),
  });
}

/** Back after leaving with the clock running: no pop-up (T10); the time away is set aside. */
function returnWithClockRunning(session: FocusSession, nowMs: number): FocusSession {
  const step = session.steps[session.current];
  const leftAt = step?.clock?.leftAtMs ?? null;
  if (!step?.clock || leftAt === null) return session;
  return replaceStep(session, session.current, {
    ...step,
    awayMs: (step.awayMs ?? 0) + Math.max(0, nowMs - leftAt),
    clock: returnFromLeave(step.clock, nowMs),
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

/**
 * #117 (C1): the server flagged the person's last message as a crisis, so it is discarded: removed
 * from the rest messages (and so from local storage and every later history). Only the last
 * message, and only when it is that text.
 */
export function dropFlaggedRestMessage(session: FocusSession, text: string): FocusSession {
  const last = session.rest?.messages.at(-1);
  if (!session.rest || last?.from !== "you" || last.text !== text) return session;
  return { ...session, rest: { ...session.rest, messages: session.rest.messages.slice(0, -1) } };
}

/** His first message for this Pause goes first, even if the user wrote before it arrived. */
export function addFirstRestMessage(session: FocusSession, text: string): FocusSession {
  if (!session.rest || hasFirstRestMessage(session)) return session;
  const messages: RestMessage[] = [{ from: "him", text }, ...session.rest.messages];
  return { ...session, rest: { ...session.rest, messages } };
}

/**
 * His pause message of two calls (#56): the stuck story goes on its own slip before his message,
 * and the Pause is added to the run's pause log. Nothing else changes: the Step, its cards and
 * the clock stay as they were, so the moment never moves his Story.
 */
export function addPauseMessage(
  session: FocusSession,
  pause: { text: string; story?: string; category?: string; prop?: string },
): FocusSession {
  if (!session.rest || hasFirstRestMessage(session)) return session;
  const withMessage = addFirstRestMessage(session, pause.text);
  const rest = { ...withMessage.rest!, ...(pause.story ? { stuckStory: pause.story } : {}) };
  const entry: PauseLogEntry = { step: session.current, text: pause.text };
  if (pause.story) entry.story = pause.story;
  if (pause.category) entry.category = pause.category;
  if (pause.prop) entry.prop = pause.prop;
  return { ...withMessage, rest, pauseLog: [...(session.pauseLog ?? []), entry] };
}

/** How many earlier lines of the pause log go back to the server with the next Pause. */
const PAUSE_HISTORY = 8;

/**
 * What the next Pause needs from the earlier ones (#56): the categories of the last two Pauses of
 * the run, the props used in this Step, this Step's stuck stories, and the run's pause lines for
 * the repeat check.
 */
export function pauseHistory(session: FocusSession): {
  recentCategories: string[];
  usedProps: string[];
  earlierStories: string[];
  earlierLines: string[];
} {
  const log = session.pauseLog ?? [];
  const inStep = log.filter((entry) => entry.step === session.current);
  return {
    recentCategories: log
      .slice(-2)
      .map((entry) => entry.category)
      .filter((category): category is string => typeof category === "string"),
    usedProps: inStep
      .map((entry) => entry.prop)
      .filter((prop): prop is string => typeof prop === "string"),
    earlierStories: inStep
      .map((entry) => entry.story)
      .filter((story): story is string => typeof story === "string")
      .slice(-PAUSE_HISTORY),
    earlierLines: log
      .flatMap((entry) => [entry.story, entry.text])
      .filter((line): line is string => typeof line === "string")
      .slice(-PAUSE_HISTORY),
  };
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
 * Back from leaving with the clock kept running (#71) never opens the pop-up (T10).
 */
export function returnOnOpen(session: FocusSession, nowMs: number): FocusSession {
  session = returnWithClockRunning(session, nowMs);
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

/**
 * Opening the focus page with the Story off (#114, F1-STUDY): there is no return pop-up (it is his
 * voice), so a return that would open it restarts the clock at once instead.
 */
export function returnWithoutPopup(session: FocusSession, nowMs: number): FocusSession {
  const next = returnOnOpen(session, nowMs);
  return next.returnPending ? startFromReturn(next, nowMs) : next;
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
    ...(Array.isArray(partial.pauseLog)
      ? {
          pauseLog: partial.pauseLog.filter(
            (entry) =>
              typeof entry === "object" &&
              entry !== null &&
              typeof entry.step === "number" &&
              typeof entry.text === "string",
          ),
        }
      : {}),
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

/** A period after these words, or after a single capital letter, does not end a sentence. */
const NOT_A_SENTENCE_END = /(?:^|\s)(?:[A-Z]|Mr|Mrs|Ms|Dr|Gen|Col|Lt|Capt|Prof|St)\.$/;

/** The first sentence of a card (DONE-LINE); a card of one sentence is kept whole. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const ends = /[.!?]+(?=\s|$)/g;
  for (let match = ends.exec(trimmed); match; match = ends.exec(trimmed)) {
    const end = match.index + match[0].length;
    if (!NOT_A_SENTENCE_END.test(trimmed.slice(0, end))) return trimmed.slice(0, end);
  }
  return trimmed;
}

/**
 * "What I have done" in the "Who I am" sheet (#72, DONE-LINE): one line per finished Step, the
 * first sentence of the last card shown in that Step. Never a Step ahead; no model call. A Step
 * finished before any card was shown has no line.
 */
export function doneLines(session: FocusSession, nowMs: number): string[] {
  const finished = Math.min(session.current, session.steps.length);
  const lines: string[] = [];
  for (let index = 0; index < finished; index += 1) {
    const last = visibleCards(session, index, nowMs).at(-1);
    if (last) lines.push(firstSentence(last));
  }
  return lines;
}
