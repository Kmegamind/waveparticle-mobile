"use server";

import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import {
  cardsForStep,
  modelIsConfigured,
  type StepCardsRequest,
  type StepCardsResponse,
} from "@/lib/prototype/focus-cards";

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
