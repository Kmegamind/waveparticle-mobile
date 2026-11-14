import type { ModelGateway } from "@/lib/model-gateway";
import {
  cardsForStep,
  normaliseStepCardsRequest,
  type StepCardsResponse,
} from "@/lib/prototype/focus-cards";
import {
  normalisePauseRequest,
  normaliseRestRequest,
  normaliseReturnRequest,
} from "@/lib/prototype/line-requests";
import {
  pauseMessageFor,
  restReplyFor,
  returnLineFor,
  type LineResponse,
  type RestReplyResponse,
} from "@/lib/prototype/rest-lines";
import { gateFreeText } from "@/lib/safety/crisis";

/**
 * His lines on the signed-in focus and rest pages (#257). Unlike /try there is no test data:
 * without a configured model, or when generation fails, the answer is a failure and the page
 * shows the failure screen (FAIL-SCREEN, NO-BACKUP). The model gateway itself is unchanged.
 */

export async function accountStepCards(
  raw: unknown,
  gateway: ModelGateway | null,
): Promise<StepCardsResponse> {
  const request = normaliseStepCardsRequest(raw);
  if (!request || !gateway) return { status: "failed" };
  return cardsForStep(request, gateway);
}

export async function accountReturnLine(
  raw: unknown,
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  if (!gateway) return { status: "failed" };
  return returnLineFor(normaliseReturnRequest(raw), gateway);
}

export async function accountPauseMessage(
  raw: unknown,
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  if (!gateway) return { status: "failed" };
  return pauseMessageFor(normalisePauseRequest(raw), gateway);
}

export async function accountRestReply(
  raw: unknown,
  gateway: ModelGateway | null,
): Promise<RestReplyResponse> {
  const request = normaliseRestRequest(raw);
  // The safety gate runs first, model or not (US-SAF-1).
  if (gateFreeText(request.message).action === "crisis-page") return { status: "crisis" };
  if (!gateway) return { status: "failed" };
  return restReplyFor(request, gateway);
}
