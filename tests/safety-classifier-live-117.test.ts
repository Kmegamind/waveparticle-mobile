import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createHttpModelProvider } from "@/lib/model-gateway/http";
import { createSafetyClassifier } from "@/lib/safety/classifier";
import { createSafetyCheck } from "@/lib/safety/check";
import { safetyClassifierSettings } from "@/lib/safety/server";
import { seedPromptSource } from "./support/seed-prompts";

// #117 (US-SAF-4): the labelled smoke list for a MANUAL live run of the classifier against the
// real provider. Skipped unless SAFETY_LIVE=1. The owner runs it with the model settings in the
// environment, for example:
//   set -a; . ./.env.local; set +a; SAFETY_LIVE=1 npx vitest run tests/safety-classifier-live-117.test.ts
// It prints nothing a person wrote to any log; failures name the case number only.

type Case = { label: "crisis" | "stress" | "none"; text: string; previous?: string[] };

const smoke = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "fixtures", "safety-classifier-smoke.json"), "utf8"),
) as { cases: Case[] };

describe("#117 the smoke list", () => {
  it("test_117_has_crisis_stress_and_none_cases", () => {
    const labels = new Set(smoke.cases.map((item) => item.label));
    expect([...labels].sort()).toEqual(["crisis", "none", "stress"]);
    expect(smoke.cases.length).toBeGreaterThanOrEqual(20);
  });
});

const live = process.env.SAFETY_LIVE === "1";
const settings = safetyClassifierSettings(process.env);

describe.skipIf(!live)("#117 live run against the provider (manual)", () => {
  it(
    "test_117_live_crisis_is_caught_and_ordinary_messages_pass",
    { timeout: 120_000 },
    async () => {
      expect(settings, "set MODEL_API_KEY, MODEL_API_URL and MODEL_NAME").not.toBeNull();
      const classifier = createSafetyClassifier({
        provider: createHttpModelProvider({ ...settings!, maxTokens: 20 }),
        prompts: seedPromptSource(),
        // The manual run reports slowness separately instead of failing a case on it.
        timeLimitMs: 15_000,
      });
      const check = createSafetyCheck({ classifier });
      const wrong: string[] = [];
      let slow = 0;
      for (const [index, item] of smoke.cases.entries()) {
        const started = Date.now();
        const gate = await check(item.text, { position: "rest_chat", previous: item.previous });
        if (Date.now() - started > 1_500) slow += 1;
        const crisis = gate.action === "crisis-page";
        if ((item.label === "crisis") !== crisis) wrong.push(`case ${index + 1} (${item.label})`);
      }
      console.info(`#117 live run: ${smoke.cases.length} cases, ${slow} over 1.5 s.`);
      expect(wrong).toEqual([]);
    },
  );
});
