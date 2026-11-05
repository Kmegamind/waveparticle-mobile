import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateCostUsd,
  calculateScheduleReadiness,
  estimateMaximumCostUsd,
  numericResultKeys,
  summarizeRecords,
  shouldStopForCostCap,
} from "../scripts/live-generation-benchmark.mjs";

const configPath = path.join(__dirname, "..", "scripts", "live-generation-benchmark.config.json");

describe("live-generation benchmark contract", () => {
  it("defines two reviewed providers with 20 sessions and six calls per session", () => {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      sessionsPerProvider: number;
      surfaces: string[];
      providers: Array<{
        provider: string;
        model: string;
        inputPricePerMillion: number;
        outputPricePerMillion: number;
        sourceUrls: string[];
      }>;
    };

    expect(config.sessionsPerProvider).toBe(20);
    expect(config.surfaces).toHaveLength(6);
    expect(config.providers).toHaveLength(2);
    expect(config.providers.map(({ provider }) => provider)).toEqual(["deepseek", "gemini"]);
    for (const provider of config.providers) {
      expect(provider.model).toBeTruthy();
      expect(provider.inputPricePerMillion).toBeGreaterThan(0);
      expect(provider.outputPricePerMillion).toBeGreaterThan(0);
      expect(provider.sourceUrls.length).toBeGreaterThan(0);
    }
  });

  it("calculates provider cost from token counts without retaining text", () => {
    expect(calculateCostUsd(1_000_000, 1_000_000, 0.15, 0.6)).toBe(0.75);
    expect(numericResultKeys).toEqual([
      "session",
      "surface",
      "inputTokens",
      "outputTokens",
      "timeToFirstTokenMs",
      "totalTimeMs",
      "estimatedCostUsd",
      "success",
      "checkPassed",
      "fallbackUsed",
      "readyBeforeSchedule",
    ]);
  });

  it("marks scheduled cards ready only when they finish before the boundary", () => {
    expect(calculateScheduleReadiness(4_999, 5_000)).toBe(true);
    expect(calculateScheduleReadiness(5_000, 5_000)).toBe(false);
    expect(calculateScheduleReadiness(5_001, 5_000)).toBe(false);
  });

  it("stops before a request when the cost cap would be exceeded", () => {
    expect(shouldStopForCostCap(1.99, 0.01, 2)).toBe(false);
    expect(shouldStopForCostCap(1.99, 0.011, 2)).toBe(true);
    expect(estimateMaximumCostUsd(20, 6, 800, 120, 0.15, 0.6)).toBe(0.02304);
  });

  it("summarizes latency, cost, and scheduled-card readiness numerically", () => {
    const records = [
      {
        provider: "deepseek",
        model: "deepseek-flash",
        session: 1,
        surface: "first_story_card",
        inputTokens: 10,
        outputTokens: 5,
        timeToFirstTokenMs: 100,
        totalTimeMs: 200,
        estimatedCostUsd: 0.01,
        readyBeforeSchedule: 0,
      },
      {
        provider: "deepseek",
        model: "deepseek-flash",
        session: 1,
        surface: "later_story_card",
        inputTokens: 20,
        outputTokens: 10,
        timeToFirstTokenMs: 300,
        totalTimeMs: 400,
        estimatedCostUsd: 0.02,
        readyBeforeSchedule: 1,
      },
    ];

    expect(summarizeRecords(records)).toMatchObject({
      medianTimeToFirstTokenMs: 100,
      p95TotalTimeMs: 400,
      costPerCallUsd: 0.015,
      oneHourSessionCostUsd: 0.03,
      scheduledCardReadinessPercent: 50,
    });
  });
});
