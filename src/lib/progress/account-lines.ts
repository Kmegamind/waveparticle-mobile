import type { StoryContent } from "@/lib/content/types";
import { REST_ROUNDS, type ModelGateway } from "@/lib/model-gateway";
import {
  normalisePauseRequest,
  normaliseRestRequest,
  normaliseReturnRequest,
} from "@/lib/prototype/line-requests";
import {
  afterTheLastRound,
  pauseMessageFor,
  restReplyFor,
  restReplyInRound,
  returnLineFor,
  type ContentSource,
  type RestRoundProblem,
  type RestRounds,
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

/**
 * The round count of one Pause of an account session (REST-ROUND-10, #518), kept on the server:
 * `sessionId` is the account's session, `pauseKey` the Pause's own id.
 */
export type AccountRestRounds = (sessionId: string, pauseKey: string) => RestRounds;

export async function accountRestReply(
  content: ContentSource,
  raw: unknown,
  gateway: ModelGateway | null,
  safety: SafetyCheck = keywordOnlySafetyCheck,
  rounds?: AccountRestRounds,
  /** REST-ROUND-10: told when the count could not be read or written (no text, only which). */
  warn?: (problem: RestRoundProblem) => void,
): Promise<RestReplyResponse> {
  const request = normaliseRestRequest(raw);
  // The safety check runs first, model or not (US-SAF-1, #117). Without a model there is no
  // reply to protect, so only the keyword layer runs.
  if (!gateway) {
    const gate = await keywordOnlySafetyCheck(request.message, { position: "rest_chat" });
    return gate.action === "crisis-page" ? { status: "crisis" } : { status: "failed" };
  }
  if (!rounds) return restReplyFor(content, request, gateway, safety);
  // REST-ROUND-10: without the session and the Pause there is no count to keep, so no reply.
  const { sessionId, pauseKey } = request;
  if (!sessionId || !pauseKey) {
    const ended = await afterTheLastRound(request.message, safety, request.history);
    return ended.status === "crisis" ? ended : { status: "failed" };
  }
  return restReplyInRound(
    rounds(sessionId, pauseKey),
    (round) => restReplyFor(content, { ...request, round }, gateway, safety),
    () => afterTheLastRound(request.message, safety, request.history),
    warn,
  );
}

/** Whether a Pause of an account session already had its tenth reply (REST-ROUND-10, R1-C10). */
export async function accountRestEnded(
  raw: unknown,
  rounds: AccountRestRounds,
): Promise<{ status: "ok"; ended: boolean } | { status: "failed" }> {
  const request = normaliseRestRequest(raw);
  if (!request.sessionId || !request.pauseKey) return { status: "failed" };
  try {
    const answered = await rounds(request.sessionId, request.pauseKey).answered();
    return { status: "ok", ended: answered >= REST_ROUNDS };
  } catch {
    return { status: "failed" };
  }
}
