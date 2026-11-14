import { createHash } from "node:crypto";
import { oppenheimerStories } from "@/content/oppenheimer";
import { LIMITS } from "@/lib/goals/start-goal";
import type { ClosingLineInput, ModelGateway } from "@/lib/model-gateway";
import type {
  AccountProgress,
  ProgressGoal,
  ProgressSession,
  ProgressStore,
  SessionStep,
} from "@/lib/progress/account-progress";
import { STORY_IDS, generationInputs, isStoryId } from "@/lib/prototype/story-inputs";
import { startStory } from "@/lib/story/start";
import type { FinishShown } from "./run";
import { RUN_COMPANION_ID, type RunWriter } from "./run-writer";

/**
 * Finishing a signed-in run (issue #258). The run itself happened in the browser (the test focus
 * page); this saves it on the account Goal it was started from, with his live closing line and the
 * line he still carries. No stored or pre-written line is ever returned (NO-BACKUP), and no text
 * the user wrote reaches the model.
 */

export const COMPANION_ID = RUN_COMPANION_ID;

type PlanStepInput = { title: string; description: string; minutes: number };

export type FinishInput = {
  runId: string;
  storyId: string;
  steps: PlanStepInput[];
  focusSeconds: number[];
  earlierLines: string[];
};

export type FinishOutcome =
  | { status: "ok"; shown: FinishShown }
  | { status: "signed-out" | "invalid" | "no-goal" | "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FOCUS_SECONDS = 24 * 60 * 60;
const MAX_EARLIER_LINES = 60;
const MAX_LINE_LENGTH = 600;

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;

function isPlanStep(value: unknown): value is PlanStepInput {
  if (typeof value !== "object" || value === null) return false;
  const { title, description, minutes } = value as Record<string, unknown>;
  return (
    isText(title, LIMITS.stepTitle) &&
    isText(description, LIMITS.description) &&
    typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= 1 &&
    minutes <= LIMITS.stepMinutes
  );
}

/** The action is a public endpoint: the shape and sizes are checked at run time, never trimmed. */
export function normaliseFinishInput(raw: unknown): FinishInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.runId !== "string" || !UUID.test(value.runId)) return null;
  if (!isStoryId(value.storyId)) return null;
  const steps = value.steps;
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > LIMITS.steps) return null;
  if (!steps.every(isPlanStep)) return null;
  const focus = value.focusSeconds;
  if (
    !Array.isArray(focus) ||
    focus.length !== steps.length ||
    !focus.every(
      (seconds) =>
        typeof seconds === "number" &&
        Number.isFinite(seconds) &&
        seconds >= 0 &&
        seconds <= MAX_FOCUS_SECONDS,
    )
  ) {
    return null;
  }
  const earlier = Array.isArray(value.earlierLines) ? value.earlierLines : [];
  const earlierLines = earlier
    .filter(
      (line): line is string =>
        typeof line === "string" && line.length > 0 && line.length <= MAX_LINE_LENGTH,
    )
    .slice(-MAX_EARLIER_LINES);
  return {
    runId: value.runId,
    storyId: value.storyId,
    steps: steps.map((step) => ({ ...step })),
    focusSeconds: [...focus] as number[],
    earlierLines,
  };
}

const sameStep = (
  saved: { title: string; description: string | null; minutes: number },
  step: PlanStepInput,
) =>
  saved.title.trim() === step.title.trim() &&
  saved.minutes === step.minutes &&
  (saved.description ?? "").trim() === step.description.trim();

/** The in-progress Goal whose Steps, in order, are the run's Plan; the last one when several match. */
export function findGoalForPlan(
  progress: AccountProgress,
  steps: PlanStepInput[],
): ProgressGoal | null {
  const matches = progress.goals.filter((goal) => {
    if (goal.status !== "in_progress") return false;
    const saved = [...goal.steps].sort((left, right) => left.position - right.position);
    return saved.length === steps.length && saved.every((step, i) => sameStep(step, steps[i]));
  });
  // The newest Goal wins: by creation time when the database gives it, otherwise the read order.
  const newest = [...matches].sort((left, right) =>
    (left.createdAt ?? "").localeCompare(right.createdAt ?? ""),
  );
  return newest.at(-1) ?? null;
}

function storyRecord(storyId: string) {
  const story = oppenheimerStories.find((item) => item.id === storyId);
  if (!story) throw new Error(`Unknown story ${storyId}`);
  return story;
}

/** The closing call's input: the story's own inputs and the facts of this run, no user text. */
export function closingInputFor(
  storyId: string,
  minutes: number[],
  earlierLines: string[],
): ClosingLineInput {
  const story = storyRecord(storyId);
  const brief = startStory(
    story,
    minutes.map((value) => ({ minutes: value })),
  );
  const factText = (ids: string[]) => {
    const wanted = new Set(ids);
    return story.facts
      .filter((fact) => wanted.has(fact.id))
      .map((fact) => fact.text)
      .join(" ");
  };
  const inputs = generationInputs(storyId);
  const allIds = brief.steps.flatMap((step) => step.factIds);
  // A Plan with more Steps than facts leaves the last Steps without facts; the last moment is the
  // last Step that has any.
  const lastIds = [...brief.steps].reverse().find((step) => step.factIds.length > 0)?.factIds ?? [];
  return {
    facts: [inputs.who, `Place: ${inputs.place}.`, inputs.goalShort, factText(allIds)].join(" "),
    lastMoment: factText(lastIds),
    forbidTerms: inputs.forbidTerms,
    earlierLines,
  };
}

const completedOf = (progress: AccountProgress, storyId: string) =>
  progress.sessions.filter(
    (session) =>
      session.state === "completed" &&
      session.companionId === COMPANION_ID &&
      session.storyId === storyId,
  );

/** The next story after this one, only for its first completion and only when one exists. */
export function nextStoryAfter(before: AccountProgress, storyId: string): string | null {
  if (completedOf(before, storyId).length > 0) return null;
  const index = STORY_IDS.indexOf(storyId);
  return index >= 0 && index + 1 < STORY_IDS.length ? STORY_IDS[index + 1] : null;
}

const WAIT_FOR_OTHER_TAB_MS = 200;
const WAIT_FOR_OTHER_TAB_TRIES = 10;

/** Fixed ids for one run's rows, so a retry writes the same rows again (ignored as duplicates). */
function rowId(runId: string, part: string): string {
  const hex = createHash("sha256").update(`${runId}:${part}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type Deps = {
  userId: string | null;
  store: ProgressStore;
  writer: RunWriter;
  gateway: ModelGateway | null;
  nowIso: string;
  wait?: (ms: number) => Promise<void>;
};

function stepRows(runId: string, goal: ProgressGoal, nowIso: string): SessionStep[] {
  return [...goal.steps]
    .sort((left, right) => left.position - right.position)
    .map((step) => ({
      id: rowId(runId, `step-${step.position}`),
      stepId: step.id,
      position: step.position,
      openedAt: null,
      doneAt: nowIso,
    }));
}

/**
 * A run that is already saved: finish what a failed write left undone (its Steps and the Goal's
 * Done, both safe to write again) and show the lines that were saved. Nothing is generated again.
 */
async function showSaved(
  saved: ProgressSession,
  progress: AccountProgress,
  deps: Deps,
): Promise<FinishOutcome> {
  const goal = progress.goals.find((item) => item.id === saved.goalId);
  try {
    if (goal) {
      await deps.writer.insertSteps(saved.id, stepRows(saved.id, goal, deps.nowIso));
      if (goal.status !== "done") await deps.writer.markGoalDone(goal.id);
    }
  } catch {
    return { status: "failed" };
  }
  const others = { ...progress, sessions: progress.sessions.filter((item) => item !== saved) };
  return {
    status: "ok",
    shown: {
      closingLine: saved.closingLine ?? "",
      // Empty only when the write of the carried line failed; END then shows the closing line alone.
      carryLine: saved.lines.find((line) => line.kind === "closing")?.text ?? "",
      next: nextStoryAfter(others, saved.storyId),
    },
  };
}

export async function finishRun(raw: unknown, deps: Deps): Promise<FinishOutcome> {
  if (!deps.userId) return { status: "signed-out" };
  const userId = deps.userId;
  const input = normaliseFinishInput(raw);
  if (!input) return { status: "invalid" };
  const progress = await deps.store.read(userId, userId);

  // A reload or a retry: this run is already saved, so its lines come back unchanged.
  const saved = progress.sessions.find((session) => session.id === input.runId);
  if (saved) return showSaved(saved, progress, deps);

  const goal = findGoalForPlan(progress, input.steps);
  if (!goal) return { status: "no-goal" };
  if (!deps.gateway) return { status: "failed" };

  const result = await deps.gateway.writeClosingLine(
    closingInputFor(
      input.storyId,
      input.steps.map((step) => step.minutes),
      input.earlierLines,
    ),
  );
  if (result.source !== "generated") return { status: "failed" };

  try {
    const claim = await deps.writer.insertSession({
      id: input.runId,
      userId,
      goalId: goal.id,
      storyId: input.storyId,
      closingLine: result.closingLine,
      stepCount: goal.steps.length,
      completedAt: deps.nowIso,
    });
    if (claim === "exists") return await waitForOtherTab(input.runId, deps);
    await deps.writer.insertClosingLine(input.runId, {
      id: rowId(input.runId, "closing"),
      sessionStepId: null,
      seq: 0,
      kind: "closing",
      cardId: null,
      source: "generated",
      text: result.carryLine,
      pauseNumber: null,
      shownAt: deps.nowIso,
    });
    await deps.writer.insertSteps(input.runId, stepRows(input.runId, goal, deps.nowIso));
    await deps.writer.markGoalDone(goal.id);
  } catch {
    return { status: "failed" };
  }
  return {
    status: "ok",
    shown: {
      closingLine: result.closingLine,
      carryLine: result.carryLine,
      next: nextStoryAfter(progress, input.storyId),
    },
  };
}

/** Another tab saved this run first: show its lines once its carried line is written. */
async function waitForOtherTab(runId: string, deps: Deps): Promise<FinishOutcome> {
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const userId = deps.userId as string;
  for (let attempt = 0; attempt < WAIT_FOR_OTHER_TAB_TRIES; attempt += 1) {
    const progress = await deps.store.read(userId, userId);
    const saved = progress.sessions.find((session) => session.id === runId);
    if (saved && saved.lines.some((line) => line.kind === "closing")) {
      return showSaved(saved, progress, deps);
    }
    await wait(WAIT_FOR_OTHER_TAB_MS);
  }
  return { status: "failed" };
}
