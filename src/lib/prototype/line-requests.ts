import type { RestMessage, ReturnTrigger } from "./session";

/**
 * Normalises the requests for his lines that arrive at the public server actions of /try and of
 * the signed-in pages (#257). Unknown fields are dropped; numbers and text are kept in bounds.
 */

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function storyIdOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The most Steps a Plan may have (as for the card requests). */
const MAX_STEPS = 50;

type Raw = Record<string, unknown> | null | undefined;

const record = (raw: unknown): Raw =>
  typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : undefined;

/** `awayMinutes` goes to the prompt only; the line never shows how long the person was away. */
export function normaliseReturnRequest(raw: unknown): {
  storyId?: string;
  trigger: ReturnTrigger;
  awayMinutes: number;
} {
  const request = record(raw);
  const away = request?.awayMinutes;
  return {
    storyId: storyIdOf(request?.storyId),
    trigger: request?.trigger === "absence" ? "absence" : "rest",
    awayMinutes:
      typeof away === "number" && away >= 0 ? Math.round(Math.min(away, 60 * 24 * 365)) : 0,
  };
}

export function normalisePauseRequest(raw: unknown): {
  storyId?: string;
  pauseNumber: number;
  stepTitle: string;
  lastCard?: string;
} {
  const request = record(raw);
  const pauseNumber = request?.pauseNumber;
  return {
    storyId: storyIdOf(request?.storyId),
    pauseNumber:
      typeof pauseNumber === "number" && Number.isInteger(pauseNumber) && pauseNumber >= 1
        ? pauseNumber
        : 1,
    stepTitle: text(request?.stepTitle, 200),
    lastCard: text(request?.lastCard, 1_000) || undefined,
  };
}

export function normaliseRestRequest(raw: unknown): {
  storyId?: string;
  message: string;
  history: RestMessage[];
  replyIndex: number;
  stepIndex?: number;
  stepCount?: number;
} {
  const request = record(raw);
  const history = Array.isArray(request?.history)
    ? (request.history as RestMessage[])
        .filter((item) => item && (item.from === "him" || item.from === "you"))
        .map((item) => ({ from: item.from, text: text(item.text, 2_000) }))
    : [];
  const replyIndex = request?.replyIndex;
  // The Step the person rests from (#60): kept only when both numbers describe a Step of a Plan.
  const { stepIndex, stepCount } = request ?? {};
  const position =
    typeof stepIndex === "number" &&
    typeof stepCount === "number" &&
    Number.isInteger(stepIndex) &&
    Number.isInteger(stepCount) &&
    stepCount >= 1 &&
    stepCount <= MAX_STEPS &&
    stepIndex >= 0 &&
    stepIndex < stepCount
      ? { stepIndex, stepCount }
      : {};
  return {
    storyId: storyIdOf(request?.storyId),
    message: text(request?.message, 10_000),
    history,
    replyIndex:
      typeof replyIndex === "number" && Number.isInteger(replyIndex) && replyIndex >= 0
        ? replyIndex
        : 0,
    ...position,
  };
}
