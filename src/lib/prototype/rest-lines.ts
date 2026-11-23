import { pickPauseSnag, type PauseCategory } from "@/lib/content/pause-snag";
import { companionPeople, sceneTableOf } from "@/lib/content/scene";
import type { StoryContent } from "@/lib/content/types";
import type { ModelGateway } from "@/lib/model-gateway";
import { keywordOnlySafetyCheck, type SafetyCheck } from "@/lib/safety/check";
import { gateFreeText } from "@/lib/safety/crisis";
import type { RestMessage, ReturnTrigger } from "./session";
import { laterStoryWords } from "./rest-later-words";
import { DEFAULT_STORY_ID } from "./story-ids";
import { generationInputs, isStoryId, storyById } from "./story-inputs";
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
/**
 * His pause message (#56): `text` is call two's message he shows; `story` is call one's stuck story,
 * shown on its own slip first; `category` and `prop` are what the code picked, kept by the browser
 * for the next Pause. Test data has the message only.
 */
export type PauseResponse =
  | {
      status: "ok";
      isTestData: boolean;
      text: string;
      story?: string;
      category?: PauseCategory;
      prop?: string;
    }
  | { status: "failed" };

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

export type PauseRequest = {
  storyId?: string;
  pauseNumber: number;
  stepTitle?: string;
  lastCard?: string;
  /** Categories of the last two Pauses of the run (#56). */
  recentCategories?: string[];
  /** Props already used in this Step (#56). */
  usedProps?: string[];
  /** This Step's earlier stuck stories (#56). */
  earlierStories?: string[];
  /** The run's earlier pause lines, for the repeat check (#56). */
  earlierLines?: string[];
};

/**
 * His pause message, made with two calls (PAUSE-TWO-CALLS, #56). The code picks the category and
 * the prop; call one writes the stuck story around them, call two his words about it. If either
 * call fails after its retries, the whole message fails and the page shows the failure screen
 * with Retry (NO-BACKUP, FAIL-SCREEN). Nothing here writes to his Story: the moment is texture.
 */
export async function pauseMessageFor(
  content: StoryContent | null,
  request: PauseRequest,
  gateway: ModelGateway | null,
): Promise<PauseResponse> {
  const storyId = storyOf(content, request.storyId);
  if (content === null || storyId === null) return { status: "failed" };
  if (!gateway) return { status: "ok", isTestData: true, text: loadTestStory().pauseMessage };
  const story = storyById(content, storyId);
  const inputs = generationInputs(content, storyId);
  // SCENE-PER-STORY (#64, #65): the Story's one scene table is the pause message's input.
  const scene = story.inputs.scene ?? undefined;
  const companionStories = content.stories.filter((item) => item.companionId === story.companionId);
  const people = companionPeople(companionStories.map((item) => item.inputs.stageZero));
  const companionProps = [
    ...new Set(
      companionStories.flatMap((item) => sceneTableOf(item.inputs.stageZero)?.props ?? []),
    ),
  ];
  const picked = scene
    ? pickPauseSnag({
        scene,
        recentCategories: request.recentCategories ?? [],
        usedProps: request.usedProps ?? [],
      })
    : null;
  const facts = stuckFacts(content, request.pauseNumber, storyId);
  // One time limit for the whole pause message: call two gets what call one left (TIME-LIMIT).
  const shared = {
    startedAt: Date.now(),
    pauseNumber: request.pauseNumber,
    facts,
    forbidTerms: inputs.forbidTerms,
    companionName: inputs.companionName,
    lastCard: request.lastCard,
    scene,
    people,
    earlierStories: request.earlierStories ?? [],
    earlierLines: request.earlierLines ?? [],
  };
  try {
    // No user-written text goes in (#216): not the Step title, not the Goal.
    const first = await gateway.writeStuckStory({
      ...shared,
      category: picked?.category,
      prop: picked?.prop,
      companionProps,
    });
    if (first.source !== "generated" || !first.story.trim()) return { status: "failed" };
    const second = await ask(() =>
      gateway.writePausePredicament({
        ...shared,
        story: first.story,
        prop: first.prop,
        companionProps,
      }),
    );
    if (second.status !== "ok") return { status: "failed" };
    return {
      status: "ok",
      isTestData: false,
      text: second.text,
      story: first.story,
      ...(picked ? { category: picked.category, prop: picked.prop } : {}),
    };
  } catch {
    return { status: "failed" };
  }
}

/**
 * The story content for a rest reply: the snapshot, or a loader that is called only after the
 * safety gate, so a crisis message never waits for a content read (#284).
 */
export type ContentSource = StoryContent | null | (() => Promise<StoryContent | null>);

const contentOf = async (source: ContentSource) =>
  typeof source === "function" ? source() : source;

/** How many unanswered messages of the person are checked again; older ones are dropped. */
export const MAX_UNANSWERED_RECHECKS = 3;

/**
 * #117 fix rounds 1 and 2 (C1, N1): a message the server's check flagged as a crisis got no reply
 * (the safety page came instead), so it is a "you" message not followed directly by his reply. The
 * browser removes it, but the server does not rely on that: every unanswered message of the person
 * is checked again with the same check, with its own earlier messages of the person as context (as
 * on its own turn), side by side with the new message and within the same 1.5 s. It is dropped
 * from what the reply model sees when it is flagged, and also when its re-check failed or timed
 * out (fail closed: an unanswered message adds little, so the keyword layer alone does not admit
 * it). Older unanswered messages are dropped unchecked. Usually there is none, so no extra call.
 */
async function withoutFlagged(history: RestMessage[], safety: SafetyCheck) {
  const unanswered = history
    .map((message, index) => ({ message, index }))
    .filter(({ message, index }) => message.from === "you" && history[index + 1]?.from !== "him");
  const recheck = unanswered.slice(-MAX_UNANSWERED_RECHECKS);
  const dropped = new Set(unanswered.slice(0, -MAX_UNANSWERED_RECHECKS).map(({ index }) => index));
  const gates = await Promise.all(
    recheck.map(({ message, index }) =>
      safety(message.text, {
        position: "rest_chat",
        previous: history
          .slice(0, index)
          .filter((earlier) => earlier.from === "you")
          .map((earlier) => earlier.text),
      }),
    ),
  );
  recheck.forEach(({ index }, position) => {
    const gate = gates[position];
    if (gate.action === "crisis-page" || gate.classifierFailed) dropped.add(index);
  });
  return history.filter((_, index) => !dropped.has(index));
}

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
  /** The server's check (#117): the keyword layer and the classifier. Keyword only if omitted. */
  safety: SafetyCheck = keywordOnlySafetyCheck,
): Promise<RestReplyResponse> {
  // The safety check runs first: a crisis message is never sent to the reply model (US-SAF-1,
  // #117). The classifier sees the message and the last two earlier messages of this chat.
  const keptPromise = withoutFlagged(request.history, safety);
  const previous = request.history
    .filter((message) => message.from === "you")
    .map((message) => message.text);
  const gate = await safety(request.message, { position: "rest_chat", previous });
  const kept = await keptPromise;
  if (gate.action === "crisis-page") return { status: "crisis" };
  const content = await contentOf(source);
  const storyId = storyOf(content, request.storyId);
  if (content === null || storyId === null) return { status: "failed" };
  if (!gateway) {
    const replies = loadTestStory().restReplies;
    const text = replies[Math.abs(request.replyIndex) % replies.length];
    return { status: "ok", isTestData: true, text };
  }
  const history = kept
    .filter((message) => message.from === "him" || gateFreeText(message.text).action === "continue")
    .slice(-MAX_HISTORY);
  const inputs = generationInputs(content, storyId);
  // CHAT-USER-WORD: everything the person typed in this chat, so a later word he typed may be
  // repeated. Crisis text is left out, as in the history sent to the model.
  const userTexts = [
    ...kept
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
