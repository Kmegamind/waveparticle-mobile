import type { StoryContent } from "@/lib/content/types";
import type { ModelGateway } from "@/lib/model-gateway";
import { gateFreeText } from "@/lib/safety/crisis";
import type { RestMessage, ReturnTrigger } from "./session";
import { laterStoryWords } from "./rest-later-words";
import { DEFAULT_STORY_ID } from "./story-ids";
import { generationInputs, isStoryId } from "./story-inputs";
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

/**
 * The story being played. A missing id is chapter 8 (a session from before #254); an id that is
 * present but unknown is null, and the line fails rather than switching story (#254 AC5). Without
 * the story content (a failed read, #284) every story is null and the line fails.
 */
function storyOf(content: StoryContent | null, storyId: unknown): string | null {
  if (!content) return null;
  if (storyId === undefined) return DEFAULT_STORY_ID;
  return isStoryId(content, storyId) ? storyId : null;
}

/** Who he is, the place and the goal sentence, from this story's own inputs (#254). */
function baseFacts(content: StoryContent, storyId: string): string {
  const inputs = generationInputs(content, storyId);
  return [inputs.who, `Place: ${inputs.place}.`, inputs.goalShort].join(" ");
}

/** The pause number for his stuck story; from the third Pause the snag is much harder (PAUSE-3). */
export function stuckFacts(
  content: StoryContent,
  pauseNumber: number,
  storyId: string = DEFAULT_STORY_ID,
): string {
  const parts = [
    baseFacts(content, storyOf(content, storyId) ?? DEFAULT_STORY_ID),
    `This is pause number ${pauseNumber} in this Step.`,
  ];
  if (pauseNumber >= 3) {
    parts.push(
      "Every pause has stalled his own work and he remembers the earlier setbacks, so this snag is much harder, and he says he is worried he may fail.",
    );
  }
  parts.push("He never gives the person an instruction and never asks the person to stop pausing.");
  return parts.join(" ");
}

function restFacts(content: StoryContent, history: RestMessage[], storyId: string): string {
  const lines = history.map(
    (message) =>
      `${message.from === "him" ? "He" : "The person"}: ${message.text.slice(0, MAX_MESSAGE_CHARS)}`,
  );
  return [
    baseFacts(content, storyId),
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
  content: StoryContent | null,
  request: { storyId?: string; pauseNumber: number; stepTitle?: string; lastCard?: string },
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  const storyId = storyOf(content, request.storyId);
  if (content === null || storyId === null) return { status: "failed" };
  if (!gateway) return { status: "ok", isTestData: true, text: loadTestStory().pauseMessage };
  const input = {
    stepTitle: request.stepTitle,
    pauseNumber: request.pauseNumber,
    facts: stuckFacts(content, request.pauseNumber, storyId),
    forbidTerms: generationInputs(content, storyId).forbidTerms,
    companionName: generationInputs(content, storyId).companionName,
    lastCard: request.lastCard,
  };
  return ask(() => gateway.writeStuckStory(input));
}

/**
 * The story content for a rest reply: the snapshot, or a loader that is called only after the
 * safety gate, so a crisis message never waits for a content read (#284).
 */
export type ContentSource = StoryContent | null | (() => Promise<StoryContent | null>);

const contentOf = async (source: ContentSource) =>
  typeof source === "function" ? source() : source;

export async function restReplyFor(
  source: ContentSource,
  request: {
    storyId?: string;
    message: string;
    history: RestMessage[];
    replyIndex: number;
    /** Where the person is in the Plan, for the facts from later in the Story (#60). */
    stepIndex?: number;
    stepCount?: number;
  },
  gateway: ModelGateway | null,
): Promise<RestReplyResponse> {
  // The safety gate runs first: a crisis message is never sent to the model (US-SAF-1).
  if (gateFreeText(request.message).action === "crisis-page") return { status: "crisis" };
  const content = await contentOf(source);
  const storyId = storyOf(content, request.storyId);
  if (content === null || storyId === null) return { status: "failed" };
  if (!gateway) {
    const replies = loadTestStory().restReplies;
    const text = replies[Math.abs(request.replyIndex) % replies.length];
    return { status: "ok", isTestData: true, text };
  }
  const history = request.history
    .filter((message) => message.from === "him" || gateFreeText(message.text).action === "continue")
    .slice(-MAX_HISTORY);
  const inputs = generationInputs(content, storyId);
  // CHAT-USER-WORD: everything the person typed in this chat, so a later word he typed may be
  // repeated. Crisis text is left out, as in the history sent to the model.
  const userTexts = [
    ...request.history
      .filter((message) => message.from === "you")
      .map((message) => message.text)
      .filter((text) => gateFreeText(text).action === "continue"),
    request.message,
  ];
  return ask(() =>
    gateway.writeRestReply({
      userMessage: request.message.slice(0, MAX_MESSAGE_CHARS),
      facts: restFacts(content, history, storyId),
      companionName: inputs.companionName,
      // Words from after his date, checked on the reply (#59 AC4, ERA-ANSWER).
      forbidTerms: inputs.forbidTerms,
      userTexts,
      // Facts from later in the Story: the parts not reached yet and the scene's later words (#60).
      ...laterStoryWords(content, storyId, positionOf(request)),
    }),
  );
}

function positionOf(request: { stepIndex?: number; stepCount?: number }) {
  const { stepIndex, stepCount } = request;
  return stepIndex === undefined || stepCount === undefined ? undefined : { stepIndex, stepCount };
}

/** Exact clock numbers stay out of the return pop-up until CLOCK-NUMBERS is decided. */
const HAS_NUMBER = /\d/;

export async function returnLineFor(
  content: StoryContent | null,
  request: { storyId?: string; trigger: ReturnTrigger; awayMinutes: number },
  gateway: ModelGateway | null,
): Promise<LineResponse> {
  const storyId = storyOf(content, request.storyId);
  if (content === null || storyId === null) return { status: "failed" };
  if (!gateway) return { status: "ok", isTestData: true, text: loadTestStory().returnLine };
  const input = {
    trigger: request.trigger,
    facts: baseFacts(content, storyId),
    awayMinutes: request.awayMinutes,
    forbidTerms: generationInputs(content, storyId).forbidTerms,
    companionName: generationInputs(content, storyId).companionName,
  };
  const result = await ask(() => gateway.writeReturnPopup(input));
  if (result.status === "ok" && HAS_NUMBER.test(result.text)) return { status: "failed" };
  return result;
}
