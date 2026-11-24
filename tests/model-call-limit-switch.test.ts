import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@/lib/model-gateway";
import {
  LIMIT_SWITCH_ENV,
  isModelCallLimitOn,
  resetInvalidLimitSwitchLog,
} from "@/lib/prototype/cost-cap";
import { splitGoal, type SplitDeps } from "@/lib/prototype/split-goal";

// #256: the per-browser daily limit can be switched off by MODEL_CALL_LIMIT_ENABLED=0.

const model = { MODEL_API_KEY: "k", MODEL_API_URL: "https://model.invalid", MODEL_NAME: "m" };
const generated = {
  source: "generated" as const,
  title: "Plan",
  steps: [
    { title: "One", description: "Do one.", minutes: 15 },
    { title: "Two", description: "Do two.", minutes: 15 },
  ],
};
const input = { goal: "Revise chapter four", totalMinutes: 30, splitFiner: false };

function run(setting: string | undefined, counter: string | undefined) {
  const written: string[] = [];
  const gateway = { splitPlan: vi.fn(async () => generated) } as unknown as ModelGateway;
  const deps: SplitDeps = {
    env: { ...model, ...(setting === undefined ? {} : { [LIMIT_SWITCH_ENV]: setting }) },
    today: "2026-11-24",
    readCounter: () => counter,
    writeCounter: (value) => void written.push(value),
    createGateway: () => gateway,
  };
  return { result: splitGoal(input, deps), gateway, written };
}

describe("the limit switch (#256)", () => {
  beforeEach(() => {
    resetInvalidLimitSwitchLog();
    vi.restoreAllMocks();
  });

  it("unset: the limit is on", async () => {
    expect(isModelCallLimitOn({})).toBe(true);
    const { result, gateway } = run(undefined, "2026-11-24:20");
    expect(await result).toEqual({ status: "failed" });
    expect(gateway.splitPlan).not.toHaveBeenCalled();
  });

  it('"1": the limit is on', async () => {
    expect(isModelCallLimitOn({ [LIMIT_SWITCH_ENV]: "1" })).toBe(true);
    const { result } = run("1", "2026-11-24:20");
    expect(await result).toEqual({ status: "failed" });
  });

  it('"0": the limit is off, past 20 the model is still called and no counter is written', async () => {
    expect(isModelCallLimitOn({ [LIMIT_SWITCH_ENV]: "0" })).toBe(false);
    const { result, gateway, written } = run("0", "2026-11-24:20");
    expect((await result).status).toBe("plan");
    expect(gateway.splitPlan).toHaveBeenCalledTimes(1);
    expect(written).toEqual([]);
  });

  it("surrounding spaces are ignored", () => {
    expect(isModelCallLimitOn({ [LIMIT_SWITCH_ENV]: " 0" })).toBe(false);
    expect(isModelCallLimitOn({ [LIMIT_SWITCH_ENV]: "0 " })).toBe(false);
    expect(isModelCallLimitOn({ [LIMIT_SWITCH_ENV]: " 1 " })).toBe(true);
  });

  it("an invalid value keeps the limit on and logs once", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((line: string) => void lines.push(line));
    for (const value of ["off", "false", "2", "00"]) {
      expect(isModelCallLimitOn({ [LIMIT_SWITCH_ENV]: value })).toBe(true);
    }
    const { result } = run("off", "2026-11-24:20");
    expect(await result).toEqual({ status: "failed" });
    const own = lines.filter((line) => line.includes("limit_switch_invalid"));
    expect(own).toHaveLength(1);
    expect(own[0]).not.toContain("off");
  });
});
