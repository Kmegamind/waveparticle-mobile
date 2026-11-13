import { describe, expect, it, vi } from "vitest";
import { cardsForStep, modelIsConfigured } from "@/lib/prototype/focus-cards";
import { parseSpeed } from "@/lib/prototype/session";
import { loadTestStory } from "@/lib/prototype/test-story";
import type { ModelGateway } from "@/lib/model-gateway";

const story = loadTestStory();

function gatewayReturning(result: Awaited<ReturnType<ModelGateway["writeStepCards"]>> | Error) {
  const writeStepCards = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { gateway: { writeStepCards } as unknown as ModelGateway, writeStepCards };
}

describe("#12 AC1 and #17 AC3 test data: Step 1 opens with the background card", () => {
  it("uses the background card as Step 1's one opening card", async () => {
    const result = await cardsForStep({ index: 0, planMinutes: [20], earlierCards: [] }, null);
    expect(result).toEqual({
      status: "ok",
      isTestData: true,
      cards: { opening: story.backgroundCard, story: story.steps[0].cards },
    });
  });

  it("opens later Steps with the card about what he just finished", async () => {
    const result = await cardsForStep({ index: 1, planMinutes: [20, 20], earlierCards: [] }, null);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.cards.opening).toBe(story.steps[1].cards[0]);
    expect(result.cards.story).toEqual(story.steps[1].cards.slice(1));
    expect(result.cards.story).not.toContain(result.cards.opening);
  });
});

describe("FAIL-SCREEN with the model configured", () => {
  it("returns the generated cards, the first as the opening card", async () => {
    const { gateway, writeStepCards } = gatewayReturning({
      source: "generated",
      cards: ["one", "two", "three"],
    });
    const result = await cardsForStep(
      { index: 2, planMinutes: [20, 20, 15], earlierCards: [] },
      gateway,
    );
    expect(result).toEqual({
      status: "ok",
      isTestData: false,
      cards: { opening: "one", story: ["two", "three"] },
    });
    expect(writeStepCards).toHaveBeenCalledWith(
      expect.objectContaining({ minutes: 15, stepNumber: 3, stepCount: 3 }),
    );
  });

  it("never sends the Goal text to the model", async () => {
    const { gateway, writeStepCards } = gatewayReturning({ source: "generated", cards: ["a"] });
    await cardsForStep({ index: 0, planMinutes: [15], earlierCards: [] }, gateway);
    expect(JSON.stringify(writeStepCards.mock.calls)).not.toContain("Write the report");
  });

  it("treats a stored fallback, an empty result or an error as a failure", async () => {
    type Outcome = Awaited<ReturnType<ModelGateway["writeStepCards"]>> | Error;
    const outcomes: Outcome[] = [
      // A stored fallback is no longer in the gateway's types (#219), but the answer is
      // untyped at runtime, so an unexpected source must still count as a failure.
      { source: "authored", cards: ["stored line"] } as unknown as Outcome,
      { source: "generated", cards: [] },
      { source: "failed" } as unknown as Outcome,
      { source: "failed", reason: "checks" },
      new Error("network"),
    ];
    for (const outcome of outcomes) {
      const { gateway } = gatewayReturning(outcome);
      expect(
        await cardsForStep({ index: 0, planMinutes: [15], earlierCards: [] }, gateway),
      ).toEqual({
        status: "failed",
      });
    }
  });
});

describe("configuration and the test speed-up", () => {
  it("uses the model only when all three names are set", () => {
    expect(modelIsConfigured({ MODEL_API_KEY: "k", MODEL_API_URL: "u", MODEL_NAME: "m" })).toBe(
      true,
    );
    expect(modelIsConfigured({ MODEL_API_KEY: "k", MODEL_API_URL: "u" })).toBe(false);
    expect(modelIsConfigured({ MODEL_API_KEY: " ", MODEL_API_URL: "u", MODEL_NAME: "m" })).toBe(
      false,
    );
  });

  it("accepts a whole speed from 1 to 600 and otherwise uses 1", () => {
    expect(parseSpeed("60")).toBe(60);
    expect(parseSpeed(undefined)).toBe(1);
    for (const bad of ["0", "-3", "1.5", "abc", "601", ["60", "2"]]) {
      expect(parseSpeed(bad)).toBe(1);
    }
  });
});
