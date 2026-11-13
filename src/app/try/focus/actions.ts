"use server";

import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import {
  cardsForStep,
  modelIsConfigured,
  type StepCardsRequest,
  type StepCardsResponse,
} from "@/lib/prototype/focus-cards";
import { returnLineFor, type LineResponse } from "@/lib/prototype/rest-lines";
import type { ReturnTrigger } from "@/lib/prototype/session";

/** Writes one Step's cards for /try/focus. Nothing about the request is logged. */
export async function loadStepCards(request: StepCardsRequest): Promise<StepCardsResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const index = Number.isInteger(request?.index) && request.index >= 0 ? request.index : 0;
  const stepTitle = typeof request?.stepTitle === "string" ? request.stepTitle.slice(0, 200) : "";
  const minutes =
    typeof request?.minutes === "number" && request.minutes >= 1 && request.minutes <= 600
      ? request.minutes
      : 1;
  const gateway = modelIsConfigured() ? createServerModelGateway() : null;
  return cardsForStep({ index, stepTitle, minutes }, gateway);
}

/**
 * His return line for the pop-up on /try/focus (F-RET). `awayMinutes` is passed to the prompt
 * only; the line never shows how long the person was away.
 */
export async function loadReturnLine(request: {
  trigger: ReturnTrigger;
  awayMinutes: number;
}): Promise<LineResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  // TODO(cost cap): apply the per-browser daily cap from the goal-dialogue PR once it is on main.
  const trigger = request?.trigger === "absence" ? "absence" : "rest";
  const awayMinutes =
    typeof request?.awayMinutes === "number" && request.awayMinutes >= 0
      ? Math.round(Math.min(request.awayMinutes, 60 * 24 * 365))
      : 0;
  const gateway = modelIsConfigured() ? createServerModelGateway() : null;
  return returnLineFor({ trigger, awayMinutes }, gateway);
}
