/** Formats a number of seconds as MM:SS, never below 00:00 (US-FOC clock, R-T: the clock stays at 00:00). */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

const DONE_HOLD_MS = 1_200;

export interface ClockState {
  targetSeconds: number;
  startedAtMs: number | null;
  elapsedBeforeRunMs: number;
  keepRunningWhenAway: boolean;
  leftAtMs: number | null;
  holdUntilMs: number | null;
  holdElapsedMs: number | null;
}

export function createClock(
  targetSeconds: number,
  startedAtMs: number,
  keepRunningWhenAway = false,
): ClockState {
  if (!Number.isFinite(targetSeconds) || targetSeconds < 0) {
    throw new RangeError("targetSeconds must be a non-negative finite number");
  }

  return {
    targetSeconds,
    startedAtMs,
    elapsedBeforeRunMs: 0,
    keepRunningWhenAway,
    leftAtMs: null,
    holdUntilMs: null,
    holdElapsedMs: null,
  };
}

function elapsedMilliseconds(state: ClockState, nowMs: number): number {
  if (state.holdUntilMs !== null && state.holdElapsedMs !== null) {
    return state.holdElapsedMs + Math.max(0, nowMs - state.holdUntilMs);
  }

  if (state.startedAtMs === null) {
    return state.elapsedBeforeRunMs;
  }

  const endMs =
    state.leftAtMs !== null && !state.keepRunningWhenAway ? Math.min(nowMs, state.leftAtMs) : nowMs;

  return state.elapsedBeforeRunMs + Math.max(0, endMs - state.startedAtMs);
}

function withElapsedAt(state: ClockState, atMs: number): ClockState {
  return {
    ...state,
    startedAtMs: null,
    elapsedBeforeRunMs: elapsedMilliseconds(state, atMs),
  };
}

export function remainingSeconds(state: ClockState, nowMs: number): number {
  const remaining = state.targetSeconds - elapsedMilliseconds(state, nowMs) / 1_000;
  return Math.max(0, Math.ceil(remaining));
}

export function pauseClock(state: ClockState, atMs: number): ClockState {
  return withElapsedAt(state, atMs);
}

export function resumeClock(state: ClockState, atMs: number): ClockState {
  return {
    ...state,
    startedAtMs: atMs,
    leftAtMs: null,
    holdUntilMs: null,
    holdElapsedMs: null,
  };
}

export function holdAfterDone(state: ClockState, atMs: number): ClockState {
  return {
    ...withElapsedAt(state, atMs),
    holdUntilMs: atMs + DONE_HOLD_MS,
    holdElapsedMs: elapsedMilliseconds(state, atMs),
  };
}

export function leaveClock(state: ClockState, atMs: number): ClockState {
  return {
    ...state,
    leftAtMs: atMs,
  };
}

export function returnFromLeave(state: ClockState, atMs: number): ClockState {
  if (state.leftAtMs === null) {
    return state;
  }

  if (state.keepRunningWhenAway) {
    return { ...state, leftAtMs: null };
  }

  return {
    ...withElapsedAt(state, state.leftAtMs),
    startedAtMs: atMs,
    leftAtMs: null,
  };
}
