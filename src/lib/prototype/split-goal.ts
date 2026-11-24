/**
 * Server logic behind the goal dialogue's split on /try (issues #33, #36, #38, #39).
 * Never logs or stores the goal text. The safety gate runs before any model call.
 */
import type { ModelGateway, PlanStep } from "@/lib/model-gateway";
import { MODEL_GATEWAY_ENV_NAMES } from "@/lib/model-gateway/server";
import { keywordOnlySafetyCheck, type SafetyCheck } from "@/lib/safety/check";
import { isModelCallLimitOn, takeModelCall } from "./cost-cap";
import { SLIDER_MAX_MINUTES } from "./goal-time";
import { splitWithTestData } from "./test-splitter";

export type SplitInput = { goal: string; totalMinutes: number; splitFiner: boolean };

export type SplitPlan = { source: "generated" | "test-data"; title: string; steps: PlanStep[] };

export type SplitOutcome =
  { status: "plan"; plan: SplitPlan } | { status: "failed" } | { status: "crisis" };

export type SplitDeps = {
  env: Record<string, string | undefined>;
  today: string;
  readCounter: () => string | undefined;
  writeCounter: (value: string) => void;
  createGateway?: () => ModelGateway;
  /** The server's safety check (#117); the keyword layer alone if omitted. */
  safety?: SafetyCheck;
};

export const MAX_GOAL_LENGTH = 500;

export function modelIsConfigured(env: Record<string, string | undefined>): boolean {
  return MODEL_GATEWAY_ENV_NAMES.every((name) => (env[name]?.trim() ?? "").length > 0);
}

function isValidInput(input: SplitInput): boolean {
  return (
    typeof input.goal === "string" &&
    input.goal.trim().length > 0 &&
    input.goal.length <= MAX_GOAL_LENGTH &&
    Number.isInteger(input.totalMinutes) &&
    input.totalMinutes >= 1 &&
    input.totalMinutes <= SLIDER_MAX_MINUTES &&
    typeof input.splitFiner === "boolean"
  );
}

function isValidPlan(plan: SplitPlan, totalMinutes: number): boolean {
  if (typeof plan.title !== "string" || plan.title.trim().length === 0) return false;
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) return false;
  const ok = plan.steps.every(
    (step) =>
      typeof step.title === "string" &&
      step.title.trim().length > 0 &&
      typeof step.description === "string" &&
      Number.isInteger(step.minutes) &&
      step.minutes > 0,
  );
  const sum = plan.steps.reduce((total, step) => total + step.minutes, 0);
  return ok && sum === totalMinutes;
}

export async function splitGoal(input: SplitInput, deps: SplitDeps): Promise<SplitOutcome> {
  if (!isValidInput(input)) return { status: "failed" };
  const safety = deps.safety ?? keywordOnlySafetyCheck;
  if ((await safety(input.goal, { position: "plan_split" })).action === "crisis-page") {
    return { status: "crisis" };
  }
  const clean = { ...input, goal: input.goal.trim() };

  let plan: SplitPlan;
  try {
    if (modelIsConfigured(deps.env) && deps.createGateway) {
      // The per-browser limit can be switched off by a server setting (#256, isModelCallLimitOn).
      if (isModelCallLimitOn(deps.env)) {
        const allowance = takeModelCall(deps.readCounter(), deps.today);
        if (!allowance.allowed) return { status: "failed" };
        deps.writeCounter(allowance.cookie);
      }
      const result = await deps.createGateway().splitPlan(clean);
      // Anything that is not a live generated plan is a failure (NO-BACKUP, #38 AC3).
      if (result?.source !== "generated") return { status: "failed" };
      plan = { source: "generated", title: result.title, steps: result.steps };
    } else {
      plan = splitWithTestData(clean);
    }
  } catch {
    return { status: "failed" };
  }
  return isValidPlan(plan, input.totalMinutes) ? { status: "plan", plan } : { status: "failed" };
}
