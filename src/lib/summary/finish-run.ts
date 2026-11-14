import { oppenheimerStories } from "@/content/oppenheimer";
import { LIMITS } from "@/lib/goals/start-goal";
import type { ClosingLineInput, ModelGateway } from "@/lib/model-gateway";
import type {
  AccountProgress,
  ProgressGoal,
  ProgressSession,
  ProgressStore,
} from "@/lib/progress/account-progress";
import { STORY_IDS, generationInputs, isStoryId } from "@/lib/prototype/story-inputs";
import { startStory } from "@/lib/story/start";
import type { FinishShown } from "./run";

/**
 * Finishing a signed-in run (issue #258). The run itself happened in the browser (the test focus
 * page); this saves it on the account Goal it was started from, with his live closing line and the
 * line he still carries. No stored or pre-written line is ever returned (NO-BACKUP), and no text
 * the user wrote reaches the model.
 */

export const COMPANION_ID = "oppenheimer";

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
  return matches.at(-1) ?? null;
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

function shownFrom(session: ProgressSession, next: string | null): FinishShown | null {
  const carry = session.lines.find((line) => line.kind === "closing")?.text;
  if (!session.closingLine || !carry) return null;
  return { closingLine: session.closingLine, carryLine: carry, next };
}

export async function finishRun(
  raw: unknown,
  deps: {
    userId: string | null;
    store: ProgressStore;
    gateway: ModelGateway | null;
    nowIso: string;
  },
): Promise<FinishOutcome> {
  if (!deps.userId) return { status: "signed-out" };
  const input = normaliseFinishInput(raw);
  if (!input) return { status: "invalid" };
  const progress = await deps.store.read(deps.userId, deps.userId);

  // A reload or a second tab: this run is already saved, so its lines come back unchanged.
  const saved = progress.sessions.find(
    (session) => session.id === input.runId && session.state === "completed",
  );
  if (saved) {
    const others = { ...progress, sessions: progress.sessions.filter((s) => s.id !== saved.id) };
    const shown = shownFrom(saved, nextStoryAfter(others, saved.storyId));
    return shown ? { status: "ok", shown } : { status: "failed" };
  }

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

  const next = nextStoryAfter(progress, input.storyId);
  const steps = [...goal.steps].sort((left, right) => left.position - right.position);
  const session: ProgressSession = {
    id: input.runId,
    goalId: goal.id,
    companionId: COMPANION_ID,
    storyId: input.storyId,
    state: "completed",
    backgroundCard: null,
    backgroundCardSource: null,
    // The merged key moments list on END is not built yet (#52 AC4).
    mergedKeyMoments: [],
    closingLine: result.closingLine,
    steps: steps.map((step) => ({
      id: crypto.randomUUID(),
      stepId: step.id,
      position: step.position,
      openedAt: null,
      doneAt: deps.nowIso,
    })),
    lines: [
      {
        id: crypto.randomUUID(),
        sessionStepId: null,
        seq: 0,
        kind: "closing",
        cardId: null,
        source: "generated",
        text: result.carryLine,
        pauseNumber: null,
        shownAt: deps.nowIso,
      },
    ],
  };
  await deps.store.write(deps.userId, {
    ...progress,
    goals: progress.goals.map((item) =>
      item.id === goal.id ? { ...item, status: "done" as const } : item,
    ),
    sessions: [...progress.sessions, session],
  });
  return {
    status: "ok",
    shown: { closingLine: result.closingLine, carryLine: result.carryLine, next },
  };
}
