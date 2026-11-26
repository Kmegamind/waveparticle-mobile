import { describe, expect, it } from "vitest";
import { createModelGateway, type ModelProvider } from "@/lib/model-gateway";
import { seedPromptSource } from "./support/seed-prompts";
import { OPPENHEIMER } from "./support/companion";

// Issue #258 (#41): his closing line and the line he still carries, from one live call.

const closing = "I sent the paper off before I could change my mind. I am relieved.";
const carry = "I still do not know what Born thinks of me.";
const answer = (closingLine: string, carryLine: string) =>
  JSON.stringify({ closing_line: closingLine, carry_line: carryLine });

function fake(replies: string[]) {
  const prompts: string[] = [];
  const impl: ModelProvider = async ({ prompt }) => {
    prompts.push(prompt);
    return replies[Math.min(prompts.length - 1, replies.length - 1)];
  };
  return { prompts, impl };
}

const input = {
  companionName: OPPENHEIMER,
  facts: "FACT_ONE. FACT_TWO.",
  lastMoment: "LAST_MOMENT.",
  forbidTerms: ["Los Alamos"],
  earlierLines: ["I set the lamp down on the desk."],
};

describe("#258 AC3 AC4 the closing call", () => {
  it("returns both lines when they pass the existing checks", async () => {
    const provider = fake([answer(closing, carry)]);
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider: provider.impl });
    expect(await gateway.writeClosingLine(input)).toEqual({
      source: "generated",
      closingLine: closing,
      carryLine: carry,
    });
  });

  it("asks again when either line breaks an existing rule", async () => {
    const provider = fake([
      answer("You did well today and I am proud of you.", carry),
      answer(closing, "Do I know what Born thinks?"),
      answer(closing, carry),
    ]);
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider: provider.impl });
    const result = await gateway.writeClosingLine(input);
    expect(result.source).toBe("generated");
    expect(provider.prompts).toHaveLength(3);
  });

  it("refuses a carried line that repeats the closing line", async () => {
    const provider = fake([answer(closing, closing)]);
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: provider.impl,
      maxAttempts: 2,
    });
    expect(await gateway.writeClosingLine(input)).toEqual({ source: "failed", reason: "checks" });
  });

  it("refuses a forbidden term and a line over the length limit", async () => {
    const long = `I ${"walk ".repeat(45)}home.`;
    const provider = fake([answer("I think of Los Alamos tonight.", carry), answer(long, carry)]);
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: provider.impl,
      maxAttempts: 2,
    });
    expect((await gateway.writeClosingLine(input)).source).toBe("failed");
  });

  it("builds the prompt from what happened to him, in the END-TONE", async () => {
    const provider = fake([answer(closing, carry)]);
    await createModelGateway({
      prompts: seedPromptSource(),
      provider: provider.impl,
    }).writeClosingLine(input);
    const prompt = provider.prompts[0];
    expect(prompt).toContain("FACT_ONE. FACT_TWO.");
    expect(prompt).toContain("LAST_MOMENT.");
    expect(prompt).toMatch(/what happened to (him|you) that day/i);
    expect(prompt).toMatch(/never count/i);
    expect(prompt).toMatch(/pauses/i);
    expect(prompt).not.toContain("{{");
  });
});
