/**
 * Edit rules for the Plan card (FLOW 4.3 GD4, issue #37, decisions D1d, T2, STEP-EDIT).
 * Pure functions: the dialogue keeps the list in React state and saves it on Start.
 */
import type { PlanStep } from "@/lib/model-gateway";
import { minutesLabel } from "./goal-time";

/** STEP-EDIT and #249: any whole number of minutes from 1; the buttons move by 5 (prototype v4). */
export const MINUTES_STEP = 5;
export const MIN_MINUTES = 1;
/** The account save refuses a longer Step (`LIMITS.stepMinutes` in src/lib/goals). */
export const MAX_MINUTES = 24 * 60;
export const NEW_STEP_MINUTES = 15;
export const MINUTES_FLOOR_HINT = "A Step is at least 1 minute.";
export const MINUTES_CEILING_HINT = "A Step is at most 24 hours.";

const clampMinutes = (minutes: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes));

/** The longest Step title and description the editor allows; the account save refuses longer (#32). */
export const STEP_TITLE_MAX = 200;
export const STEP_DESCRIPTION_MAX = 1000;

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
    step.id === id ? { ...step, minutes: clampMinutes(step.minutes + delta) } : step,
  );
}

/** A typed number of minutes: a whole number of at least 1 is taken (capped at 24 hours). */
export function setMinutes(steps: EditableStep[], id: string, typed: string): EditableStep[] {
  const text = typed.trim();
  if (!/^\d+$/.test(text) || Number(text) < MIN_MINUTES) return steps;
  return steps.map((step) =>
    step.id === id ? { ...step, minutes: clampMinutes(Number(text)) } : step,
  );
}

/** Adds an empty Step after `afterId` (the open Step), or at the end. */
export function addStep(
  steps: EditableStep[],
  afterId?: string,
): { steps: EditableStep[]; id: string } {
  const id = newId();
  const fresh: EditableStep = {
    id,
    title: "",
    description: "",
    minutes: NEW_STEP_MINUTES,
    savedTitle: "",
    isNew: true,
  };
  const after = afterId === undefined ? -1 : steps.findIndex((step) => step.id === afterId);
  const at = after < 0 ? steps.length : after + 1;
  return { id, steps: [...steps.slice(0, at), fresh, ...steps.slice(at)] };
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
  return `${steps.length} ${noun} · ${minutesLabel(totalMinutes(steps))}`;
}

/** The Goal field on the Plan card (#237): its text, or the typed goal when it is left empty. */
export function planTitleFor(field: string, goal: string): string {
  return field.trim() || goal;
}

/** The Steps to save on Start: titled Steps only, without editing fields. */
export function toSavedSteps(steps: EditableStep[]): PlanStep[] {
  return steps
    .filter((step) => step.title.trim().length > 0)
    .map(({ title, description, minutes }) => ({ title, description, minutes }));
}
