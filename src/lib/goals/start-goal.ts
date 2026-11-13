import { classifyGoalShape, type GoalShape } from "@/lib/prototype/goal-lines";
import { STEP_DESCRIPTION_MAX, STEP_TITLE_MAX } from "@/lib/prototype/plan-edit";
import { gateFreeText } from "@/lib/safety/crisis";

/**
 * Start on the Plan saves the Goal and its Steps on the account (issue #32, US-GD-15).
 * The rules live here; the database sits behind `GoalWriter` (see supabase-goal-writer.ts).
 * No goal or Step text is ever logged.
 */

export type StartStep = { title: string; description: string; minutes: number };

export type StartGoalInput = {
  goalId: string;
  goalText: string;
  title: string;
  splitFiner: boolean | null;
  steps: StartStep[];
};

export type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  text: string;
  shape: GoalShape;
  split_finer: boolean | null;
  total_minutes: number;
  status: "in_progress";
};

export type StepRow = {
  goal_id: string;
  position: number;
  title: string;
  description: string | null;
  minutes: number;
};

export type GoalWriter = {
  goalExists(id: string): Promise<boolean>;
  insertGoal(row: GoalRow): Promise<void>;
  updateGoal(row: GoalRow): Promise<void>;
  replaceSteps(goalId: string, rows: StepRow[]): Promise<void>;
  deleteGoal(id: string): Promise<void>;
};

export type StartGoalOutcome =
  | { status: "saved"; goalId: string; steps: StartStep[] }
  | { status: "signed-out" | "crisis" | "invalid" | "failed" };

/** Limits for the public server action; anything outside them is refused, never trimmed. */
export const LIMITS = {
  steps: 50,
  goalText: 1000,
  // The Plan title can be the whole goal text ("Use one step").
  title: 1000,
  stepTitle: STEP_TITLE_MAX,
  description: STEP_DESCRIPTION_MAX,
  stepMinutes: 24 * 60,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

/** The action is a public endpoint, so the shape and size are checked at run time. */
function isWellFormed(value: unknown): value is StartGoalInput {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  if (typeof input.goalId !== "string" || !UUID.test(input.goalId)) return false;
  if (!isText(input.goalText, LIMITS.goalText) || !isText(input.title, LIMITS.title)) return false;
  if (input.splitFiner !== null && typeof input.splitFiner !== "boolean") return false;
  if (!Array.isArray(input.steps) || input.steps.length > LIMITS.steps) return false;
  return input.steps.every((step: unknown) => {
    if (typeof step !== "object" || step === null) return false;
    const { title, description, minutes } = step as Record<string, unknown>;
    return (
      isText(title, LIMITS.stepTitle) &&
      isText(description, LIMITS.description) &&
      typeof minutes === "number" &&
      minutes <= LIMITS.stepMinutes
    );
  });
}

function isCrisis(text: string): boolean {
  return gateFreeText(text).action === "crisis-page";
}

export async function startGoal(
  input: StartGoalInput,
  deps: { userId: string | null; writer: GoalWriter },
): Promise<StartGoalOutcome> {
  if (!deps.userId) return { status: "signed-out" };
  if (!isWellFormed(input)) return { status: "invalid" };

  if (isCrisis(input.goalText) || isCrisis(input.title)) return { status: "crisis" };
  if (input.steps.some((step) => isCrisis(`${step.title}\n${step.description}`))) {
    return { status: "crisis" };
  }

  // AC3: the server removes Steps whose name is empty.
  const steps = input.steps
    .map((step) => ({
      title: step.title.trim(),
      description: step.description.trim(),
      minutes: step.minutes,
    }))
    .filter((step) => step.title.length > 0);
  // STEP-EDIT: any whole number of minutes from 1 upward, never rounded.
  const goalText = input.goalText.trim();
  if (
    steps.length === 0 ||
    goalText.length === 0 ||
    !steps.every((step) => Number.isInteger(step.minutes) && step.minutes >= 1)
  ) {
    return { status: "invalid" };
  }

  const goal: GoalRow = {
    id: input.goalId,
    user_id: deps.userId,
    title: input.title.trim() || goalText,
    text: goalText,
    shape: classifyGoalShape(goalText),
    split_finer: input.splitFiner,
    total_minutes: steps.reduce((sum, step) => sum + step.minutes, 0),
    status: "in_progress",
  };
  const rows: StepRow[] = steps.map((step, position) => ({
    goal_id: input.goalId,
    position,
    title: step.title,
    description: step.description.length > 0 ? step.description : null,
    minutes: step.minutes,
  }));

  let created = false;
  try {
    // Start again for the same Plan keeps one Goal and makes its Steps match the Plan.
    if (await deps.writer.goalExists(input.goalId)) {
      await deps.writer.updateGoal(goal);
    } else {
      await deps.writer.insertGoal(goal);
      created = true;
    }
    await deps.writer.replaceSteps(input.goalId, rows);
  } catch {
    // No Goal is left without its Plan: undo a Goal this call created.
    if (created) await deps.writer.deleteGoal(input.goalId).catch(() => undefined);
    return { status: "failed" };
  }
  return { status: "saved", goalId: input.goalId, steps };
}
