"use server";

import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import {
  cardsForStep,
  modelIsConfigured,
  normaliseStepCardsRequest,
  type StepCardsRequest,
  type StepCardsResponse,
} from "@/lib/prototype/focus-cards";
import { normaliseReturnRequest } from "@/lib/prototype/line-requests";
import { returnLineFor, type LineResponse } from "@/lib/prototype/rest-lines";
import type { ReturnTrigger } from "@/lib/prototype/session";

/**
 * Writes one Step's cards for /try/focus (#43). The request carries no user-written text (#216);
 * anything else sent is dropped. Nothing about the request is logged.
 */
export async function loadStepCards(request: StepCardsRequest): Promise<StepCardsResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const normal = normaliseStepCardsRequest(request);
  if (!normal) return { status: "failed" };
  const gateway = modelIsConfigured() ? createServerModelGateway() : null;
  return cardsForStep(normal, gateway);
}

/**
 * His return line for the pop-up on /try/focus (F-RET). `awayMinutes` is passed to the prompt
 * only; the line never shows how long the person was away.
 */
export async function loadReturnLine(request: {
  storyId?: string;
  trigger: ReturnTrigger;
  awayMinutes: number;
}): Promise<LineResponse> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  // TODO(cost cap): apply the per-browser daily cap from the goal-dialogue PR once it is on main.
  const gateway = modelIsConfigured() ? createServerModelGateway() : null;
  return returnLineFor(normaliseReturnRequest(request), gateway);
}
