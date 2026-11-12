/**
 * Edit rules for the Plan card (FLOW 4.3 GD4, issue #37, decisions D1d, T2, STEP-EDIT).
 * Pure functions: the dialogue keeps the list in React state and saves it on Start.
 */
import type { PlanStep } from "@/lib/model-gateway";
import { formatMinutes } from "./goal-time";

export const MINUTES_STEP = 15;

export type EditableStep = PlanStep & {
  id: string;
  /** The last non-empty title; an emptied title comes back to this (#37 AC4). */
  savedTitle: string;
  /** Added by the user and never given a title: removed if its title stays empty (#37 AC2). */
  isNew: boolean;
};

let nextId = 0;
const newId = () => `step-${(nextId += 1)}`;

export function fromPlan(steps: PlanStep[]): EditableStep[] {
  return steps.map((step) => ({ ...step, id: newId(), savedTitle: step.title, isNew: false }));
}

export function commitTitle(steps: EditableStep[], id: string, title: string): EditableStep[] {
  const clean = title.trim();
  return steps.flatMap((step) => {
    if (step.id !== id) return [step];
    if (clean.length > 0) return [{ ...step, title: clean, savedTitle: clean, isNew: false }];
    if (step.isNew) return [];
    return [{ ...step, title: step.savedTitle }];
  });
}

export function setDescription(
  steps: EditableStep[],
  id: string,
  description: string,
): EditableStep[] {
  return steps.map((step) => (step.id === id ? { ...step, description } : step));
}

export function changeMinutes(steps: EditableStep[], id: string, delta: number): EditableStep[] {
  return steps.map((step) =>
    step.id === id ? { ...step, minutes: Math.max(MINUTES_STEP, step.minutes + delta) } : step,
  );
}

export function addStep(steps: EditableStep[]): { steps: EditableStep[]; id: string } {
  const id = newId();
  return {
    id,
    steps: [
      ...steps,
      { id, title: "", description: "", minutes: MINUTES_STEP, savedTitle: "", isNew: true },
    ],
  };
}

export function canRemove(steps: EditableStep[]): boolean {
  return steps.length > 1;
}

export function removeStep(steps: EditableStep[], id: string): EditableStep[] {
  if (!canRemove(steps)) return steps;
  return steps.filter((step) => step.id !== id);
}

export function moveStep(steps: EditableStep[], id: string, by: -1 | 1): EditableStep[] {
  const from = steps.findIndex((step) => step.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= steps.length) return steps;
  const next = [...steps];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function totalMinutes(steps: Pick<PlanStep, "minutes">[]): number {
  return steps.reduce((sum, step) => sum + step.minutes, 0);
}

/** "3 steps · 60 min"; singular "1 step". */
export function countLine(steps: Pick<PlanStep, "minutes">[]): string {
  const noun = steps.length === 1 ? "step" : "steps";
  return `${steps.length} ${noun} · ${formatMinutes(totalMinutes(steps))}`;
}

/** The Steps to save on Start: titled Steps only, without editing fields. */
export function toSavedSteps(steps: EditableStep[]): PlanStep[] {
  return steps
    .filter((step) => step.title.trim().length > 0)
    .map(({ title, description, minutes }) => ({ title, description, minutes }));
}
