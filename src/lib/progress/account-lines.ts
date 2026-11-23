import type { StoryContent } from "@/lib/content/types";
import type { ModelGateway } from "@/lib/model-gateway";
import {
  normalisePauseRequest,
  normaliseRestRequest,
  normaliseReturnRequest,
} from "@/lib/prototype/line-requests";
import {
  pauseMessageFor,
  restReplyFor,
  returnLineFor,
  type ContentSource,
  type LineResponse,
  type PauseResponse,
  type RestReplyResponse,
} from "@/lib/prototype/rest-lines";
import { keywordOnlySafetyCheck, type SafetyCheck } from "@/lib/safety/check";

/**
 * His lines on the signed-in focus and rest pages (#257). Unlike /try there is no test data:
 * without a configured model, or when generation fails, the answer is a failure and the page
 * shows the failure screen (FAIL-SCREEN, NO-BACKUP). The model gateway itself is unchanged.
 * `content` is the story content (#284), or null when it could not be read: the line then fails,
 * after the safety gate.
 */

export async function accountReturnLine(
  content: StoryContent | null,
  raw: unknown,
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  if (!gateway) return { status: "failed" };
  return returnLineFor(content, normaliseReturnRequest(raw), gateway);
}

export async function accountPauseMessage(
  content: StoryContent | null,
  raw: unknown,
  gateway: ModelGateway | null,
): Promise<PauseResponse> {
  if (!gateway) return { status: "failed" };
  return pauseMessageFor(content, normalisePauseRequest(raw), gateway);
}

export async function accountRestReply(
  content: ContentSource,
  raw: unknown,
  gateway: ModelGateway | null,
  safety: SafetyCheck = keywordOnlySafetyCheck,
): Promise<RestReplyResponse> {
  const request = normaliseRestRequest(raw);
  // The safety check runs first, model or not (US-SAF-1, #117). Without a model there is no
  // reply to protect, so only the keyword layer runs.
  if (!gateway) {
    const gate = await keywordOnlySafetyCheck(request.message, { position: "rest_chat" });
    return gate.action === "crisis-page" ? { status: "crisis" } : { status: "failed" };
  }
  return restReplyFor(content, request, gateway, safety);
}
