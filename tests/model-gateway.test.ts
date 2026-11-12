import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway, type ModelProvider } from "@/lib/model-gateway";
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
      stepTitle: "Read",
      facts: "He is at a table.",
    });
    const reply = await gateway.writeRestReply({
      userMessage,
      facts: "He is at a table.",
    });
    const popup = await gateway.writeReturnPopup({ facts: "He is at a table.", awayMinutes: 12 });

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
    const popup = await gateway.writeReturnPopup({ facts: "A quiet room.", awayMinutes: 8 });
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
});
