import { storyFacts, type Story, type StoryContent } from "@/lib/content/types";
import type { ModelGateway } from "@/lib/model-gateway";
import { MODEL_GATEWAY_ENV_NAMES } from "@/lib/model-gateway/server";
import { startStory } from "@/lib/story/start";
import { maxStoryCards, type StepCards } from "./session";
import { DEFAULT_STORY_ID } from "./story-ids";
import { generationInputs, isStoryId, storyById } from "./story-inputs";
import { loadTestStory } from "./test-story";

/**
 * Server-only card source for the focus page on the test path (/try/focus).
 * With the model configured, cards come from the gateway; anything that is not a generated
 * result is a failure (FAIL-SCREEN), never a stored line (NO-BACKUP). Without the model, the
 * chapter 8 test data is used and labelled as test data on the page.
 */
/**
 * What the page sends for one Step's cards. It carries no user-written text (#216): the Plan's
 * minutes and the cards already shown in this run (his own lines, for CARD-NEW).
 */
export type StepCardsRequest = {
  /** The story being played (#254); one of the 26 Oppenheimer stories. Missing: chapter 8. */
  storyId?: string;
  index: number;
  planMinutes: number[];
  earlierCards: string[];
};

export { DEFAULT_STORY_ID };

const MAX_STEPS = 50;
const MAX_STEP_MINUTES = 24 * 60;
/** The run list keeps his last 60 cards: a bounded check, never a stricter rule. */
const MAX_EARLIER_CARDS = 60;
const MAX_CARD_LENGTH = 600;

/**
 * The server action is a public endpoint: keep the numbers and his earlier cards within limits,
 * drop every other field (a Step title or Goal sent anyway never goes further). Null when the
 * request cannot describe a Step of a Plan.
 */
export function normaliseStepCardsRequest(
  content: StoryContent | null,
  raw: unknown,
): StepCardsRequest | null {
  // Without the story content no story can be checked, so no request is accepted (#284).
  if (!content) return null;
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const planMinutes = value.planMinutes;
  if (
    !Array.isArray(planMinutes) ||
    planMinutes.length === 0 ||
    planMinutes.length > MAX_STEPS ||
    !planMinutes.every(
      (minutes) =>
        typeof minutes === "number" &&
        Number.isInteger(minutes) &&
        minutes >= 1 &&
        minutes <= MAX_STEP_MINUTES,
    )
  ) {
    return null;
  }
  const index = value.index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null;
  if (index >= planMinutes.length) return null;
  const earlier = Array.isArray(value.earlierCards) ? value.earlierCards : [];
  const earlierCards = earlier
    .filter(
      (card): card is string =>
        typeof card === "string" && card.length > 0 && card.length <= MAX_CARD_LENGTH,
    )
    .slice(-MAX_EARLIER_CARDS);
  const storyId = value.storyId === undefined ? DEFAULT_STORY_ID : value.storyId;
  // An unknown story is refused, never swapped for another one (#254 AC5).
  if (!isStoryId(content, storyId)) return null;
  return { storyId, index, planMinutes: [...planMinutes] as number[], earlierCards };
}

export type StepCardsResponse =
  { status: "ok"; isTestData: boolean; cards: StepCards } | { status: "failed" };

export function modelIsConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return MODEL_GATEWAY_ENV_NAMES.every((name) => (env[name]?.trim() ?? "").length > 0);
}

/**
 * #43 AC1: the whole Story is divided across the Plan's Steps (US-FMT-3, `startStory`). A Step's
 * prompt gets the facts of this Step and the Steps before it, never a later Step's facts, and the
 * key lines this Step must use (US-CON-2).
 */
function stepBrief(content: StoryContent, record: Story, request: StepCardsRequest) {
  const story = storyFacts(record);
  const brief = startStory(
    story,
    request.planMinutes.map((minutes) => ({ minutes })),
  );
  const share = brief.steps[request.index];
  const textOf = (ids: Set<string>) =>
    story.facts.filter((fact) => ids.has(fact.id)).map((fact) => fact.text);
  const earlier = new Set(brief.steps.slice(0, request.index).flatMap((step) => step.factIds));
  // #254: who he is, the place and the goal sentence come from this story's own inputs.
  const inputs = generationInputs(content, story.id);
  const facts = [inputs.who, `Place: ${inputs.place}.`, inputs.goalShort, ...textOf(earlier)];
  // CARD-NEW: this Step's own facts go separately, so the prompt says what is new. A Plan with
  // more Steps than the Story has facts gives the later Steps none (startStory).
  const stepFacts = textOf(new Set(share.factIds)).join(" ");
  const mustUse = share.mustUseKeySliceIds
    .map((id) => story.keySlices.find((slice) => slice.id === id)?.keyLine)
    .filter((line): line is string => typeof line === "string");
  return { share, facts: facts.join(" "), stepFacts, mustUse, stepCount: brief.stepCount };
}

function testCards(index: number): StepCards {
  const story = loadTestStory();
  if (index === 0) return { opening: story.backgroundCard, story: story.steps[0].cards };
  // The test data has four Steps; a longer plan reuses the last one (test data only).
  const step = story.steps[Math.min(index, story.steps.length - 1)];
  return { opening: step.cards[0], story: step.cards.slice(1) };
}

export async function cardsForStep(
  content: StoryContent,
  request: StepCardsRequest,
  gateway: ModelGateway | null,
): Promise<StepCardsResponse> {
  if (!gateway) return { status: "ok", isTestData: true, cards: testCards(request.index) };
  try {
    // No user-written text leaves the server (#216): only the Story side and numbers.
    const storyId = request.storyId ?? DEFAULT_STORY_ID;
    const story = storyById(content, storyId);
    const { share, facts, stepFacts, mustUse, stepCount } = stepBrief(content, story, request);
    const minutes = request.planMinutes[request.index];
    const result = await gateway.writeStepCards({
      minutes,
      facts,
      stepFacts,
      stepNumber: share.index,
      stepCount,
      storyCards: maxStoryCards(minutes),
      background: request.index === 0,
      mustUse,
      forbidTerms: generationInputs(content, story.id).forbidTerms,
      companionName: generationInputs(content, story.id).companionName,
      // CARD-NEW: his cards already shown in this run.
      earlierLines: request.earlierCards,
    });
    if (
      result?.source !== "generated" ||
      !Array.isArray(result.cards) ||
      result.cards.length === 0
    ) {
      return { status: "failed" };
    }
    const [opening, ...rest] = result.cards;
    return { status: "ok", isTestData: false, cards: { opening, story: rest } };
  } catch {
    return { status: "failed" };
  }
}
