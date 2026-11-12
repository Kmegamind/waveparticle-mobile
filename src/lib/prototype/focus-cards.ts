import generated from "../../../docs/demo/site-search.generated.json";
import type { ModelGateway } from "@/lib/model-gateway";
import { MODEL_GATEWAY_ENV_NAMES } from "@/lib/model-gateway/server";
import type { StepCards } from "./session";
import { loadTestStory } from "./test-story";

/**
 * Server-only card source for the focus page on the test path (/try/focus).
 * With the model configured, cards come from the gateway; anything that is not a generated
 * result is a failure (FAIL-SCREEN), never a stored line (NO-BACKUP). Without the model, the
 * chapter 8 test data is used and labelled as test data on the page.
 */
export type StepCardsRequest = { index: number; stepTitle: string; minutes: number };

export type StepCardsResponse =
  { status: "ok"; isTestData: boolean; cards: StepCards } | { status: "failed" };

export function modelIsConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return MODEL_GATEWAY_ENV_NAMES.every((name) => (env[name]?.trim() ?? "").length > 0);
}

/** His static "My goal" line for the test story (FLOW F1 and F3: static data). */
export function testStoryGoalLine(): string {
  return generated.meta.story.goalShort;
}

function storyFacts(index: number): string {
  const meta = generated.meta.story;
  const parts = [generated.meta.who, `Place: ${meta.place}.`, meta.goalShort];
  parts.push(
    index === 0
      ? "The first card is the background card: in his own voice, who is here, where this is and what each person knows."
      : "The first card says what he just finished and what he now faces.",
  );
  return parts.join(" ");
}

function testCards(index: number): StepCards {
  const story = loadTestStory();
  if (index === 0) return { opening: story.backgroundCard, story: story.steps[0].cards };
  // The test data has four Steps; a longer plan reuses the last one (test data only).
  const step = story.steps[Math.min(index, story.steps.length - 1)];
  return { opening: step.cards[0], story: step.cards.slice(1) };
}

export async function cardsForStep(
  request: StepCardsRequest,
  gateway: ModelGateway | null,
): Promise<StepCardsResponse> {
  if (!gateway) return { status: "ok", isTestData: true, cards: testCards(request.index) };
  try {
    // Only the Step title and minutes leave the server with the story facts; the Goal text does not.
    const result = await gateway.writeStepCards({
      stepTitle: request.stepTitle,
      minutes: request.minutes,
      facts: storyFacts(request.index),
      forbidTerms: generated.meta.story.forbidTerms,
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
