import generated from "../../../docs/demo/site-search.generated.json";
import type { ModelGateway } from "@/lib/model-gateway";
import { gateFreeText } from "@/lib/safety/crisis";
import type { RestMessage, ReturnTrigger } from "./session";
import { loadTestStory } from "./test-story";

/**
 * Server-only sources for his words on the rest page and in the return pop-up on the test path.
 * With the model configured, every line comes from the gateway, and anything that is not a
 * generated line is a failure (FAIL-SCREEN), never a stored line (NO-BACKUP). Without the model,
 * the chapter 8 test data is used and the page labels it as test data.
 *
 * The calls pass the fields of both gateway shapes (before and after #219: `stepTitle` and
 * `pauseNumber` for the stuck story, `trigger` for the return pop-up), so either one accepts them.
 */
export type LineResponse =
  { status: "ok"; isTestData: boolean; text: string } | { status: "failed" };
export type RestReplyResponse = LineResponse | { status: "crisis" };

/** Silent safeguards on what is sent to the model (FLOW R1-C); nothing on the page changes. */
export const MAX_MESSAGE_CHARS = 1_000;
const MAX_HISTORY = 6;

function baseFacts(): string {
  const meta = generated.meta.story;
  return [generated.meta.who, `Place: ${meta.place}.`, meta.goalShort].join(" ");
}

/** The pause number for his stuck story; from the third Pause the snag is much harder (PAUSE-3). */
export function stuckFacts(pauseNumber: number): string {
  const parts = [baseFacts(), `This is pause number ${pauseNumber} in this Step.`];
  if (pauseNumber >= 3) {
    parts.push(
      "Every pause has stalled his own work and he remembers the earlier setbacks, so this snag is much harder, and he says he is worried he may fail.",
    );
  }
  parts.push("He never gives the person an instruction and never asks the person to stop pausing.");
  return parts.join(" ");
}

function restFacts(history: RestMessage[]): string {
  const lines = history.map(
    (message) =>
      `${message.from === "him" ? "He" : "The person"}: ${message.text.slice(0, MAX_MESSAGE_CHARS)}`,
  );
  return [
    baseFacts(),
    "If he is asked something he could not know, he answers as a person of his own time would: he says what he knows, says plainly when he does not know, and may guess.",
    lines.length > 0 ? `Conversation so far: ${lines.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Only a generated, non-empty line is shown (NO-BACKUP, FAIL-SCREEN). */
function generatedText(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  const record = result as { source?: unknown; text?: unknown };
  if (record.source !== "generated" || typeof record.text !== "string") return null;
  const text = record.text.trim();
  return text.length > 0 ? text : null;
}

async function ask(call: () => Promise<unknown>): Promise<LineResponse> {
  try {
    const text = generatedText(await call());
    return text === null ? { status: "failed" } : { status: "ok", isTestData: false, text };
  } catch {
    return { status: "failed" };
  }
}

export async function pauseMessageFor(
  request: { pauseNumber: number; stepTitle: string; lastCard?: string },
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  if (!gateway) return { status: "ok", isTestData: true, text: loadTestStory().pauseMessage };
  const input = {
    stepTitle: request.stepTitle,
    pauseNumber: request.pauseNumber,
    facts: stuckFacts(request.pauseNumber),
    forbidTerms: generated.meta.story.forbidTerms,
    lastCard: request.lastCard,
  };
  return ask(() => gateway.writeStuckStory(input));
}

export async function restReplyFor(
  request: { message: string; history: RestMessage[]; replyIndex: number },
  gateway: ModelGateway | null,
): Promise<RestReplyResponse> {
  // The safety gate runs first: a crisis message is never sent to the model (US-SAF-1).
  if (gateFreeText(request.message).action === "crisis-page") return { status: "crisis" };
  if (!gateway) {
    const replies = loadTestStory().restReplies;
    const text = replies[Math.abs(request.replyIndex) % replies.length];
    return { status: "ok", isTestData: true, text };
  }
  const history = request.history
    .filter((message) => message.from === "him" || gateFreeText(message.text).action === "continue")
    .slice(-MAX_HISTORY);
  return ask(() =>
    gateway.writeRestReply({
      userMessage: request.message.slice(0, MAX_MESSAGE_CHARS),
      facts: restFacts(history),
    }),
  );
}

/** Exact clock numbers stay out of the return pop-up until CLOCK-NUMBERS is decided. */
const HAS_NUMBER = /\d/;

export async function returnLineFor(
  request: { trigger: ReturnTrigger; awayMinutes: number },
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  if (!gateway) return { status: "ok", isTestData: true, text: loadTestStory().returnLine };
  const input = {
    trigger: request.trigger,
    facts: baseFacts(),
    awayMinutes: request.awayMinutes,
    forbidTerms: generated.meta.story.forbidTerms,
  };
  const result = await ask(() => gateway.writeReturnPopup(input));
  if (result.status === "ok" && HAS_NUMBER.test(result.text)) return { status: "failed" };
  return result;
}
