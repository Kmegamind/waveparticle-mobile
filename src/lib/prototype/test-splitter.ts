/**
 * TEST DATA. Deterministic Plan splitter for the test path /try only, used when the model keys
 * (MODEL_API_KEY, MODEL_API_URL, MODEL_NAME) are not set, for example in CI and local runs.
 * It is not the planning prompt (decision D1b) and never runs for real users.
 */
import type { PlanStep } from "@/lib/model-gateway";

/**
 * Test-only: a goal containing this token makes the split fail, so the failure screen (GD-F,
 * issue #38) can be tested end to end. It works only on /try.
 */
export const SPLIT_FAILURE_TOKEN = "[fail-split]";

export type TestDataPlan = { source: "test-data"; title: string; steps: PlanStep[] };

const PIECES: PlanStep[] = [
  {
    title: "Gather what you need",
    description: "Put the notes and files for this in one place. Stop when nothing is missing.",
    minutes: 0,
  },
  {
    title: "Do the first part",
    description: "Work through the opening part only. Watch that you do not polish yet.",
    minutes: 0,
  },
  {
    title: "Do the middle part",
    description: "Carry on from where the first part ended. Keep a list of open questions.",
    minutes: 0,
  },
  {
    title: "Do the last part",
    description: "Finish the remaining part. Note anything you want to change later.",
    minutes: 0,
  },
  {
    title: "Check it through",
    description: "Read it once from the start and fix what is wrong. Stop at the first full pass.",
    minutes: 0,
  },
];

function piece(index: number, count: number): Omit<PlanStep, "minutes"> {
  if (count === 1) return { title: "Do it", description: "Work on it from the start." };
  if (index === 0) return PIECES[0];
  if (index === count - 1) return PIECES[4];
  const middle = PIECES[1 + ((index - 1) % 3)];
  return index > 3 ? { ...middle, title: `${middle.title} (${index})` } : middle;
}

export function splitWithTestData(input: {
  goal: string;
  totalMinutes: number;
  splitFiner: boolean;
}): TestDataPlan {
  if (input.goal.includes(SPLIT_FAILURE_TOKEN)) throw new Error("test-data split failure");
  // 15-minute units; a slider time that is not a multiple of 15 (TIME-SLIDER) puts the rest on
  // the last Step, so the Plan always adds up to the time given.
  if (input.totalMinutes < 15) {
    return {
      source: "test-data",
      title: input.goal.trim().slice(0, 80),
      steps: [{ ...piece(0, 1), minutes: input.totalMinutes }],
    };
  }
  const units = Math.floor(input.totalMinutes / 15);
  const rest = input.totalMinutes - units * 15;
  const broad = Math.max(1, Math.round(units / 2));
  const count = input.splitFiner ? Math.min(units, Math.max(broad + 1, broad * 2)) : broad;
  const base = Math.floor(units / count);
  const extra = units % count;
  const steps = Array.from({ length: count }, (_, index) => ({
    ...piece(index, count),
    minutes: (base + (index < extra ? 1 : 0)) * 15 + (index === count - 1 ? rest : 0),
  }));
  return { source: "test-data", title: input.goal.trim().slice(0, 80), steps };
}
