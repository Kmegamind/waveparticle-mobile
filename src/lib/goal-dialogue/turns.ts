/**
 * The goal dialogue's turns, counted and checked on the server (#31, US-GD-14; FLOW 4.3;
 * docs/decisions/0026). The dialogue has at most three turns in this order: the goal line, the
 * time (skipped when the goal states one, GOAL-TIME), and the split answer (chips only). After a
 * split, only Split again and Try again remain, with no limit inside the dialogue (owner decision
 * 1) and the same goal line: a changed line is refused (decision 2), and the browser shows GD-F
 * for any refusal (decision 3). A new goal line is always a new dialogue. Going back a turn sends
 * an earlier token again, which FLOW allows. Plan edits are never a turn, so he never answers them.
 * Never logs or keeps the goal text.
 */
import { capGoalMinutes, findTimeInGoal, SLIDER_MAX_MINUTES } from "@/lib/prototype/goal-time";
import {
  MAX_GOAL_LENGTH,
  type SplitInput,
  type SplitOutcome,
  type SplitPlan,
} from "@/lib/prototype/split-goal";
import { keywordOnlySafetyCheck, type SafetyCheck } from "@/lib/safety/check";
import { goalHash, signDialogueToken, verifyDialogueToken, type DialogueState } from "./token";

export const MAX_TURNS = 3;
/** "Just split it" without a time, and "Not sure" (FLOW GD1, GD2). */
export const DEFAULT_MINUTES = 30;
export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type TurnRequest =
  | { kind: "goal"; goal: string }
  | { kind: "time"; token: string; minutes: number }
  /** The split answer; `splitFiner: null` is "Just split it" (broad, 30 minutes if no time). */
  | { kind: "split"; token: string; goal: string; splitFiner: boolean | null }
  /** Split again on GD4 and Try again on GD-F. */
  | { kind: "split-again"; token: string; goal: string };

export type TurnOutcome =
  | { status: "turn"; token: string; minutes: number | null }
  | { status: "plan"; token: string; plan: SplitPlan }
  | { status: "failed"; token: string }
  | { status: "crisis" }
  | { status: "refused" };

export type TurnDeps = {
  /** The signing key; null refuses every turn (see `dialogueSecret`). */
  secret: Buffer | null;
  now: () => number;
  newId: () => string;
  /** The split itself (safety gate, cost cap, model or test data): `splitGoal` with its deps. */
  split: (input: SplitInput) => Promise<SplitOutcome>;
  /** The server's safety check on the goal line (#117); the keyword layer alone if omitted. */
  safety?: SafetyCheck;
};

const REFUSED: TurnOutcome = { status: "refused" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function takeTurn(request: TurnRequest, deps: TurnDeps): Promise<TurnOutcome> {
  const secret = deps.secret;
  if (!secret || !isRecord(request)) return REFUSED;
  const now = deps.now();
  const sign = (state: Omit<DialogueState, "v" | "iat">) =>
    signDialogueToken({ v: 1, ...state, iat: now }, secret);

  if (request.kind === "goal") {
    if (typeof request.goal !== "string") return REFUSED;
    const goal = request.goal.trim();
    if (goal.length === 0 || request.goal.length > MAX_GOAL_LENGTH) return REFUSED;
    const safety = deps.safety ?? keywordOnlySafetyCheck;
    if ((await safety(goal, { position: "goal_input" })).action === "crisis-page") {
      return { status: "crisis" };
    }
    const minutes = capGoalMinutes(findTimeInGoal(goal));
    const token = sign({
      id: deps.newId(),
      goal: goalHash(goal, secret),
      turns: 1,
      minutes,
      finer: null,
      closed: false,
    });
    return { status: "turn", token, minutes };
  }

  if (request.kind !== "time" && request.kind !== "split" && request.kind !== "split-again") {
    return REFUSED;
  }
  const state = verifyDialogueToken(request.token, secret, now, TOKEN_MAX_AGE_MS);
  if (!state) return REFUSED;

  if (request.kind === "time") {
    const minutes = request.minutes;
    if (state.closed || state.turns !== 1) return REFUSED;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > SLIDER_MAX_MINUTES) return REFUSED;
    const token = sign({ ...state, turns: 2, minutes });
    return { status: "turn", token, minutes };
  }

  // Both kinds of split carry the goal line, which must be the one this dialogue began with.
  if (typeof request.goal !== "string") return REFUSED;
  if (goalHash(request.goal, secret) !== state.goal) return REFUSED;
  const goal = request.goal.trim();

  let next: DialogueState;
  if (request.kind === "split") {
    const answer = request.splitFiner;
    if (answer !== null && typeof answer !== "boolean") return REFUSED;
    if (state.closed || state.turns >= MAX_TURNS) return REFUSED;
    // The split question comes after the time; only "Just split it" may come before it.
    if (answer !== null && state.minutes === null) return REFUSED;
    next = {
      ...state,
      turns: state.turns + 1,
      minutes: state.minutes ?? DEFAULT_MINUTES,
      finer: answer ?? false,
      closed: true,
    };
  } else {
    if (!state.closed) return REFUSED;
    next = state;
  }

  const outcome = await deps.split({
    goal,
    totalMinutes: next.minutes ?? DEFAULT_MINUTES,
    splitFiner: next.finer ?? false,
  });
  if (outcome.status === "crisis") return { status: "crisis" };
  const token = sign(next);
  return outcome.status === "plan"
    ? { status: "plan", token, plan: outcome.plan }
    : { status: "failed", token };
}
