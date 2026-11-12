import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway, type ModelProvider } from "@/lib/model-gateway";
import { checkCompanionLine } from "@/lib/model-gateway/checks";
import { MODEL_GATEWAY_ENV_NAMES, createServerModelGateway } from "@/lib/model-gateway/server";

const root = path.resolve(import.meta.dirname, "..");
const goal = "SECRET_GOAL_TEXT";
const userMessage = "SECRET_USER_MESSAGE";
const apiKey = "SECRET_API_KEY";

const planJson = JSON.stringify({
  title: "Read chapter",
  steps: [
    {
      title: "Read the chapter",
      description: "Read the assigned pages and mark the hard ones.",
      minutes: 25,
    },
  ],
});

const card = "I keep the papers flat on the table. The room is quiet around me.";
const cardsJson = (count: number) =>
  JSON.stringify({
    cards: Array.from({ length: count }, () => card),
  });
const stuckJson = JSON.stringify({ story: "I am held on a small snag in my work." });
const replyJson = JSON.stringify({ reply: "I stay with my own work." });
const returnJson = JSON.stringify({
  returnLine:
    "I kept my eyes on the papers in front of me. The room stayed as I had left it a moment before. My hands returned to the work on the table.",
});

function provider(reply: (attempt: number) => Promise<string> | string): {
  calls: string[];
  impl: ModelProvider;
} {
  const calls: string[] = [];
  return {
    calls,
    impl: async ({ prompt }) => {
      calls.push(prompt);
      return reply(calls.length);
    },
  };
}

function assertNoErrorText(text: string) {
  expect(text).not.toMatch(/error|failed|timeout|exception|undefined|MODEL_API/i);
}

describe("model gateway", () => {
  it("returns a checked plan from a successful provider", async () => {
    const fake = provider(async () => planJson);
    const logs: unknown[] = [];
    const gateway = createModelGateway({
      provider: fake.impl,
      log: (event) => logs.push(event),
    });

    const plan = await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: true });

    expect(plan.source).toBe("generated");
    expect(plan.title).toBe("Read chapter");
    expect(plan.steps).toEqual([
      {
        title: "Read the chapter",
        description: "Read the assigned pages and mark the hard ones.",
        minutes: 25,
      },
    ]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toContain(goal);
    expect(JSON.stringify(logs)).not.toContain(goal);
    expect(JSON.stringify(logs)).not.toContain(apiKey);
  });

  it("returns checked step cards, a stuck story, a rest reply and a return pop-up", async () => {
    const replies = [cardsJson(2), stuckJson, replyJson, returnJson];
    const fake = provider(async () => replies.shift() ?? "");
    const gateway = createModelGateway({ provider: fake.impl });

    const cards = await gateway.writeStepCards({
      stepTitle: "Read",
      minutes: 25,
      facts: "He is at a table.",
    });
    const stuck = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "He is at a table.",
    });
    const reply = await gateway.writeRestReply({
      userMessage,
      facts: "He is at a table.",
    });
    const popup = await gateway.writeReturnPopup({
      trigger: "rest",
      facts: "He is at a table.",
      awayMinutes: 12,
    });

    expect(cards).toEqual({ source: "generated", cards: [card, card] });
    expect(stuck.source).toBe("generated");
    expect(stuck.text).toMatch(/\.$/);
    expect(reply).toEqual({ source: "generated", text: "I stay with my own work." });
    expect(popup.source).toBe("generated");
    expect(popup.text.endsWith(".")).toBe(true);
    expect(fake.calls[2]).toContain(userMessage);
  });

  it("drops story cards past the fifth", async () => {
    const gateway = createModelGateway({
      provider: provider(async () => cardsJson(6)).impl,
    });
    const cards = await gateway.writeStepCards({
      stepTitle: "Read",
      minutes: 40,
      facts: "He is at a table.",
    });
    expect(cards.cards).toHaveLength(5);
    expect(cards.source).toBe("generated");
  });

  it("retries once after invalid JSON and then uses the second answer", async () => {
    const fake = provider(async (attempt) => (attempt === 1 ? "not json" : planJson));
    const gateway = createModelGateway({ provider: fake.impl });
    const plan = await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: false });
    expect(plan.source).toBe("generated");
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]).toBe(fake.calls[1]);
  });

  it("uses an authored plan when both answers are invalid JSON", async () => {
    const fake = provider(async () => '{"steps":[]}');
    const gateway = createModelGateway({ provider: fake.impl });
    const plan = await gateway.splitPlan({ goal, totalMinutes: 40, splitFiner: false });
    expect(plan.source).toBe("authored");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.minutes).toBe(40);
    expect(fake.calls).toHaveLength(2);
    assertNoErrorText(`${plan.title} ${plan.steps.map((step) => step.description).join(" ")}`);
  });

  it("uses an authored line when the provider is too slow", async () => {
    let calls = 0;
    const gateway = createModelGateway({
      timeoutMs: 20,
      provider: ({ signal }) => {
        calls += 1;
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        });
      },
    });
    const started = Date.now();
    const popup = await gateway.writeReturnPopup({
      trigger: "absence",
      facts: "A quiet room.",
      awayMinutes: 8,
    });
    expect(Date.now() - started).toBeLessThan(500);
    expect(calls).toBe(2);
    expect(popup.source).toBe("authored");
    assertNoErrorText(popup.text);
    expect(popup.text.endsWith(".")).toBe(true);
  });

  it("uses an authored reply when the provider fails, and logs neither user text nor the key", async () => {
    const logs: unknown[] = [];
    const gateway = createModelGateway({
      log: (event) => logs.push(event),
      provider: async () => {
        throw new Error(`provider failed for ${userMessage} with ${apiKey}`);
      },
    });
    const reply = await gateway.writeRestReply({ userMessage, facts: "A quiet room." });
    expect(reply.source).toBe("authored");
    assertNoErrorText(reply.text);
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain(userMessage);
    expect(logged).not.toContain(apiKey);
    expect(logged).not.toContain("provider failed");
  });

  it("retries a line that fails the check, then falls back without showing the rejected line", async () => {
    const rejected = "You should close your eyes.";
    const gateway = createModelGateway({
      provider: async () => JSON.stringify({ reply: rejected }),
    });
    const reply = await gateway.writeRestReply({
      userMessage: "I am tired.",
      facts: "A quiet room.",
    });
    expect(reply.source).toBe("authored");
    expect(reply.text).not.toContain(rejected);
    assertNoErrorText(reply.text);
  });

  it("reads only the server model settings and skips the network when they are missing", async () => {
    expect([...MODEL_GATEWAY_ENV_NAMES]).toEqual(["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"]);
    for (const name of MODEL_GATEWAY_ENV_NAMES) {
      expect(name.startsWith("NEXT_PUBLIC_")).toBe(false);
    }

    let called = false;
    const gateway = createServerModelGateway({
      env: {
        NEXT_PUBLIC_MODEL_API_KEY: apiKey,
        MODEL_API_URL: "https://models.example/v1/chat/completions",
        MODEL_NAME: "example-model",
      },
      fetchImpl: async () => {
        called = true;
        throw new Error("should not be called");
      },
    });
    const plan = await gateway.splitPlan({ goal, totalMinutes: 15, splitFiner: false });
    expect(called).toBe(false);
    expect(plan.source).toBe("authored");
    expect(plan.steps[0]?.minutes).toBe(15);
  });

  it("sends the key only in the server request header", async () => {
    const logs: unknown[] = [];
    let seenUrl = "";
    let seenAuth = "";
    const gateway = createServerModelGateway({
      env: {
        MODEL_API_KEY: apiKey,
        MODEL_API_URL: "https://models.example/v1/chat/completions",
        MODEL_NAME: "example-model",
      },
      log: (event) => logs.push(event),
      fetchImpl: async (url, init) => {
        seenUrl = String(url);
        const headers = new Headers(init?.headers);
        seenAuth = headers.get("authorization") ?? "";
        return new Response(JSON.stringify({ choices: [{ message: { content: planJson } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const plan = await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: true });
    expect(plan.source).toBe("generated");
    expect(seenUrl).toBe("https://models.example/v1/chat/completions");
    expect(seenUrl).not.toContain(apiKey);
    expect(seenAuth).toBe(`Bearer ${apiKey}`);
    expect(JSON.stringify(logs)).not.toContain(apiKey);
    expect(JSON.stringify(logs)).not.toContain(goal);
  });

  it("keeps the gateway out of client code and out of public env names", () => {
    const gatewayDir = path.join(root, "src/lib/model-gateway");
    const gatewaySource = readdirSync(gatewayDir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(path.join(gatewayDir, name), "utf8"))
      .join("\n");
    expect(gatewaySource).not.toContain("NEXT_PUBLIC_");
    expect(gatewaySource).not.toContain("DEEPSEEK_API_KEY");
    expect(gatewaySource).not.toContain("GEMINI_API_KEY");
    expect(gatewaySource).not.toMatch(/console\.(log|info|debug|warn|error)/);

    const clientFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry)) {
          const source = readFileSync(full, "utf8");
          if (source.includes('"use client"') || source.includes("'use client'")) {
            clientFiles.push(source);
          }
        }
      }
    };
    walk(path.join(root, "src"));
    for (const source of clientFiles) {
      expect(source).not.toContain("model-gateway");
      expect(source).not.toContain("MODEL_API_KEY");
    }
  });

  describe("rules per line kind (#201)", () => {
    const chatWithQuestion = "Do you see the wind on the mesa? I keep my notes dry under my coat.";
    const oneWayKinds = ["step_card", "stuck_story", "return_popup"] as const;

    it("test_201_ac1_rest_reply_allows_a_question_and_you", () => {
      const checked = checkCompanionLine(chatWithQuestion, "rest_reply");
      expect(checked).toEqual({ ok: true, text: chatWithQuestion });
    });

    it("test_201_ac1_rest_reply_allows_at_most_one_question", () => {
      const checked = checkCompanionLine(
        "Do you see it? Do you hear it? I keep my notes dry.",
        "rest_reply",
      );
      expect(checked).toEqual({ ok: false, rejectedRules: ["question"] });
    });

    it("test_201_ac1_rest_reply_still_applies_the_other_rules", () => {
      const cases: [string, string][] = [
        ["Do you see it? I wait for the 5:30 signal.", "clock"],
        ["Do you see it? I watch the gadget rise from the tower.", "leak"],
        ["Do you see it? I keep my notes dry, bro.", "ban"],
        ["Do you see it? I keep my notes dry. I keep them dry. I keep them close.", "len"],
        ["Do you see the wind on the mesa? I keep my notes dry", "form"],
        ["Do you see it? You should close your eyes, I think.", "cmd"],
      ];
      for (const [text, rule] of cases) {
        const checked = checkCompanionLine(text, "rest_reply", ["gadget"]);
        expect(checked.ok, text).toBe(false);
        if (!checked.ok) expect(checked.rejectedRules, text).toContain(rule);
      }
    });

    it("test_201_ac2_one_way_lines_still_reject_a_question_and_you", () => {
      for (const kind of oneWayKinds) {
        const question = checkCompanionLine("Is the wind on the mesa? I keep my notes dry.", kind);
        expect(question.ok, kind).toBe(false);
        if (!question.ok) expect(question.rejectedRules, kind).toContain("question");

        const addressed = checkCompanionLine("I keep my notes dry for you.", kind);
        expect(addressed.ok, kind).toBe(false);
        if (!addressed.ok) expect(addressed.rejectedRules, kind).toEqual(["you"]);
      }
    });

    it("test_201_ac3_gateway_returns_a_rest_reply_with_a_question", async () => {
      const gateway = createModelGateway({
        provider: async () => JSON.stringify({ reply: chatWithQuestion }),
      });
      const reply = await gateway.writeRestReply({ userMessage, facts: "A quiet room." });
      expect(reply).toEqual({ source: "generated", text: chatWithQuestion });
    });
  });

  describe("pause number and return trigger in the prompts (#202)", () => {
    const stepName = "SECRET_STEP_NAME";
    const goalText = "SECRET_GOAL_NAME";
    const worry = /worried he may fail/i;
    const noOrder = /never (?:tell|give) the person (?:what to do|an instruction)/i;
    const noStopAsk = /never ask the person to stop pausing/i;

    async function stuckPromptFor(pauseNumber: number): Promise<string> {
      const fake = provider(async () => stuckJson);
      const gateway = createModelGateway({ provider: fake.impl });
      await gateway.writeStuckStory({ pauseNumber, facts: "He is at a table." });
      return fake.calls[0] ?? "";
    }

    async function returnPromptFor(trigger: "rest" | "absence"): Promise<string> {
      const fake = provider(async () => returnJson);
      const gateway = createModelGateway({ provider: fake.impl });
      await gateway.writeReturnPopup({ trigger, facts: "He is at a table.", awayMinutes: 12 });
      return fake.calls[0] ?? "";
    }

    it("test_202_ac1_stuck_prompt_carries_the_pause_number", async () => {
      for (const pauseNumber of [1, 2, 3, 4]) {
        expect(await stuckPromptFor(pauseNumber)).toContain(`Pause number: ${pauseNumber}`);
      }
    });

    it("test_202_ac1_first_and_second_pause_get_the_ordinary_snag", async () => {
      for (const pauseNumber of [1, 2]) {
        const prompt = await stuckPromptFor(pauseNumber);
        expect(prompt).not.toMatch(worry);
        expect(prompt).toMatch(noOrder);
        expect(prompt).toMatch(noStopAsk);
      }
    });

    it("test_202_ac1_from_the_third_pause_the_snag_is_much_harder_and_he_is_worried", async () => {
      for (const pauseNumber of [3, 4, 9]) {
        const prompt = await stuckPromptFor(pauseNumber);
        expect(prompt).toMatch(/much harder/i);
        expect(prompt).toMatch(/remembers the earlier setbacks/i);
        expect(prompt).toMatch(worry);
        expect(prompt).toMatch(noOrder);
        expect(prompt).toMatch(noStopAsk);
      }
    });

    it("test_202_ac1_an_invalid_pause_number_is_read_as_the_first_pause", async () => {
      for (const pauseNumber of [0, -2, 2.5, Number.NaN]) {
        const prompt = await stuckPromptFor(pauseNumber);
        expect(prompt).toContain("Pause number: 1");
        expect(prompt).not.toMatch(worry);
      }
    });

    it("test_202_ac2_return_prompt_carries_the_trigger_and_differs_by_trigger", async () => {
      const rest = await returnPromptFor("rest");
      const absence = await returnPromptFor("absence");
      expect(rest).toContain("Return trigger: rest");
      expect(absence).toContain("Return trigger: absence");
      expect(rest).toMatch(/rest conversation/i);
      expect(absence).toMatch(/away from the app/i);
      expect(rest).not.toBe(absence);
    });

    it("test_202_ac2_return_prompt_allows_time_words_but_no_clock_numbers", async () => {
      for (const trigger of ["rest", "absence"] as const) {
        const prompt = await returnPromptFor(trigger);
        expect(prompt).toMatch(/how the time felt in his own words/i);
        expect(prompt).toMatch(/no clock times? and no numbers/i);
      }
    });

    it("test_202_ac3_stuck_and_return_prompts_carry_no_goal_or_step_text", async () => {
      const fake = provider(async (attempt) => (attempt === 1 ? stuckJson : returnJson));
      const gateway = createModelGateway({ provider: fake.impl });
      await gateway.writeStuckStory({
        pauseNumber: 3,
        facts: "He is at a table.",
        forbidTerms: [stepName, goalText],
      });
      await gateway.writeReturnPopup({
        trigger: "absence",
        facts: "He is at a table.",
        awayMinutes: 90,
        forbidTerms: [stepName, goalText],
      });
      expect(fake.calls).toHaveLength(2);
      for (const prompt of fake.calls) {
        expect(prompt).not.toContain(stepName);
        expect(prompt).not.toContain(goalText);
      }
    });
  });
});
