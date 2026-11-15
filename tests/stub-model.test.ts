import { describe, expect, it } from "vitest";
import { createModelGateway } from "@/lib/model-gateway";
import { stubAnswer } from "../e2e/support/stub-cards.mjs";
import { seedPromptSource } from "./support/seed-prompts";

// #254 AC8: the e2e stub model answers within the existing card checks, so a failure in the
// live e2e run is a real failure of the app, not of the stub.

const provider = async ({ prompt }: { prompt: string }) => stubAnswer(prompt) as string;

describe("the e2e stub model", () => {
  it("writes cards that pass the existing checks for three Steps in a row", async () => {
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider });
    const earlier: string[] = [];
    for (const stepNumber of [1, 2, 3]) {
      const result = await gateway.writeStepCards({
        minutes: 20,
        facts: "I am in Cambridge.",
        stepFacts: "I work at the bench.",
        stepNumber,
        stepCount: 3,
        storyCards: 4,
        background: stepNumber === 1,
        forbidTerms: ["the neutron", "Los Alamos"],
        earlierLines: earlier,
      });
      expect(result.source, `step ${stepNumber}`).toBe("generated");
      if (result.source === "generated") earlier.push(...result.cards);
    }
    expect(earlier).toHaveLength(15);
  });

  it("splits a plan that adds up to the time", async () => {
    const result = await createModelGateway({ prompts: seedPromptSource(), provider }).splitPlan({
      goal: "Read the paper",
      totalMinutes: 30,
      splitFiner: false,
    });
    expect(result.source).toBe("generated");
  });
});
