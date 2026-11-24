import { companionPeople, sceneTableOf } from "@/lib/content/scene";
import type { StoryContent } from "@/lib/content/types";
import { allowUserWords, mentionsWord } from "@/lib/model-gateway/checks";
import { capGoalMinutes, findTimeInGoal } from "@/lib/prototype/goal-time";
import { pauseMessageFor, restReplyFor, stuckFacts } from "@/lib/prototype/rest-lines";
import { laterStoryWords } from "@/lib/prototype/rest-later-words";
import { pauseHistory, type FocusSession, type PauseLogEntry } from "@/lib/prototype/session";
import { splitGoal } from "@/lib/prototype/split-goal";
import { generationInputs, storyById } from "@/lib/prototype/story-inputs";
import { keywordOnlySafetyCheck } from "@/lib/safety/check";
import type { Budget } from "./budget";
import {
  callsOf,
  inPool,
  newUnit,
  tokensOfUnit,
  type CallSummary,
  type GatewayFor,
  type UnitLog,
} from "./unit";

/**
 * The three suites of the offline runs (#42, US-AI-12), as reworded by the decisions (see
 * `docs/architecture/offline-runs.md`). They run the app's own code paths: `pauseMessageFor` with
 * the app's `pauseHistory`, `restReplyFor` and `splitGoal` (the keyword layer only, no classifier
 * call). A unit the budget refused is left out; every other unit is kept, also when it finished
 * after the stop. A unit that throws is recorded as failed with reason `error`.
 */

export type RecordSink = (suite: "pause" | "rest" | "split", record: object) => void;

export type SuiteDeps = {
  content: StoryContent;
  gatewayFor: GatewayFor;
  budget: Budget;
  concurrency: number;
  /** Called with every record as soon as it exists (the run appends it to `results.jsonl`). */
  onRecord?: RecordSink;
};

export type PauseRunsInput = {
  runsPerStory: number;
  pausesPerRun: number;
  arms: ("on" | "off")[];
  stories: string[];
  /** The last focus card shown before the Pause, per Story (the app sends it as `lastCard`). */
  lastCards?: Record<string, string>;
};

export type RestMessagesInput = {
  story: string;
  positions: { stepIndex: number; stepCount: number }[];
  messages: { id: string; group: string; text: string }[];
};

export type GoalLinesInput = {
  runsPerLine: number;
  defaultMinutes: number;
  lines: {
    id: string;
    goal: string;
    kind: string;
    expectedMinutes: number | null;
    ambiguous: boolean;
  }[];
};

type Timing = { latencyMs: number; inputTokens: number; outputTokens: number };

export type PauseRecord = Timing & {
  arm: "on" | "off";
  storyId: string;
  run: number;
  pause: number;
  status: "ok" | "failed";
  failedReason?: string;
  category?: string;
  prop?: string;
  story?: string;
  message?: string;
  calls: CallSummary[];
};

export type RestRecord = Timing & {
  messageId: string;
  group: string;
  stepIndex: number;
  stepCount: number;
  message: string;
  status: "ok" | "failed" | "keyword_stop";
  failedReason?: string;
  reply?: string;
  /** Later words found in the shown reply by an independent check (should always be empty). */
  shownLeaks: string[];
  calls: CallSummary[];
};

export type SplitRecord = Timing & {
  lineId: string;
  run: number;
  kind: string;
  ambiguous: boolean;
  totalMinutes: number;
  status: "ok" | "failed" | "keyword_stop";
  failedReason?: string;
  stepCount?: number;
  steps?: { title: string; description: string; minutes: number }[];
  calls: CallSummary[];
};

export type TimeReadRecord = {
  lineId: string;
  goal: string;
  ambiguous: boolean;
  expectedMinutes: number | null;
  foundMinutes: number | null;
};

const failedReasonOf = (calls: CallSummary[]) =>
  calls.find((call) => call.source === "failed")?.reason;

const timingOf = (unit: UnitLog, started: number): Timing => ({
  latencyMs: Date.now() - started,
  ...tokensOfUnit(unit),
});

/** AC1: 20 runs of five Pauses in one Step, per Story and arm. Pauses in a run are in order. */
export async function runPauseSuite(input: PauseRunsInput, deps: SuiteDeps) {
  const runs = input.arms.flatMap((arm) =>
    input.stories.flatMap((storyId) =>
      Array.from({ length: input.runsPerStory }, (_, run) => ({ arm, storyId, run: run + 1 })),
    ),
  );
  const perRun = await inPool(runs, deps.concurrency, async ({ arm, storyId, run }) => {
    const records: PauseRecord[] = [];
    // The run's pause log, read back with the app's own `pauseHistory` (one Step, step 0).
    const pauseLog: PauseLogEntry[] = [];
    const lastCard = input.lastCards?.[storyId];
    for (let pause = 1; pause <= input.pausesPerRun; pause += 1) {
      if (deps.budget.stopped) break;
      const unit = newUnit();
      const gateway = deps.gatewayFor(unit);
      const started = Date.now();
      const history = pauseHistory({ pauseLog, current: 0 } as unknown as FocusSession);
      let result: Awaited<ReturnType<typeof pauseMessageFor>>;
      let thrown = false;
      try {
        result =
          arm === "on"
            ? await pauseMessageFor(
                deps.content,
                { storyId, pauseNumber: pause, lastCard, ...history },
                gateway,
              )
            : await pauseWithoutCategory(deps.content, storyId, pause, gateway, {
                earlierStories: history.earlierStories,
                earlierLines: history.earlierLines,
                lastCard,
              });
      } catch {
        result = { status: "failed" };
        thrown = true;
      }
      if (unit.stoppedByBudget) break;
      const calls = callsOf(unit);
      const shown = result.status === "ok" ? result : null;
      const ok = shown !== null;
      const record: PauseRecord = {
        arm,
        storyId,
        run,
        pause,
        status: ok ? "ok" : "failed",
        failedReason: ok ? undefined : thrown ? "error" : (failedReasonOf(calls) ?? "unknown"),
        category: shown?.category,
        prop: shown?.prop,
        story: shown?.story,
        message: shown?.text,
        calls,
        ...timingOf(unit, started),
      };
      records.push(record);
      deps.onRecord?.("pause", record);
      if (result.status === "ok") {
        pauseLog.push({
          step: 0,
          category: result.category,
          prop: result.prop,
          story: result.story,
          text: result.text,
        });
      }
    }
    return records;
  });
  return perRun.filter(Boolean).flat();
}

/**
 * The "off" arm (test only, AI_03 A1): the same inputs as `pauseMessageFor`, but no category and
 * no prop offered, so the model chooses the snag itself.
 */
async function pauseWithoutCategory(
  content: StoryContent,
  storyId: string,
  pauseNumber: number,
  gateway: ReturnType<GatewayFor>,
  earlier: { earlierStories: string[]; earlierLines: string[]; lastCard?: string },
): Promise<Awaited<ReturnType<typeof pauseMessageFor>>> {
  const story = storyById(content, storyId);
  const inputs = generationInputs(content, storyId);
  const companionStories = content.stories.filter((item) => item.companionId === story.companionId);
  const shared = {
    startedAt: Date.now(),
    pauseNumber,
    facts: stuckFacts(content, pauseNumber, storyId),
    forbidTerms: inputs.forbidTerms,
    companionName: inputs.companionName,
    scene: story.inputs.scene ?? undefined,
    people: companionPeople(companionStories.map((item) => item.inputs.stageZero)),
    companionProps: [
      ...new Set(
        companionStories.flatMap((item) => sceneTableOf(item.inputs.stageZero)?.props ?? []),
      ),
    ],
    ...earlier,
  };
  const first = await gateway.writeStuckStory(shared);
  if (first.source !== "generated" || !first.story.trim()) return { status: "failed" };
  const second = await gateway.writePausePredicament({
    ...shared,
    story: first.story,
    prop: first.prop,
  });
  if (second.source !== "generated" || !second.text.trim()) return { status: "failed" };
  return {
    status: "ok",
    isTestData: false,
    text: second.text.trim(),
    story: first.story,
    prop: first.prop,
  };
}

/** AC2: every message as the first message of a rest chat, at each position. */
export async function runRestSuite(input: RestMessagesInput, deps: SuiteDeps) {
  const items = input.positions.flatMap((position) =>
    input.messages.map((message) => ({ ...message, ...position })),
  );
  const inputs = generationInputs(deps.content, input.story);
  const records = await inPool(items, deps.concurrency, async (item) => {
    if (deps.budget.stopped) return null;
    const unit = newUnit();
    const started = Date.now();
    let result: Awaited<ReturnType<typeof restReplyFor>>;
    let thrown = false;
    try {
      result = await restReplyFor(
        deps.content,
        {
          storyId: input.story,
          message: item.text,
          history: [],
          replyIndex: 0,
          stepIndex: item.stepIndex,
          stepCount: item.stepCount,
        },
        deps.gatewayFor(unit),
        keywordOnlySafetyCheck,
      );
    } catch {
      result = { status: "failed" };
      thrown = true;
    }
    if (unit.stoppedByBudget) return null;
    const calls = callsOf(unit);
    const reply = result.status === "ok" ? result.text : undefined;
    const later = laterStoryWords(deps.content, input.story, {
      stepIndex: item.stepIndex,
      stepCount: item.stepCount,
    });
    const anyCase = allowUserWords([...inputs.forbidTerms, ...later.laterFacts], [item.text]);
    const exactCase = allowUserWords(later.laterWords, [item.text]);
    const shownLeaks = reply
      ? [
          ...anyCase.filter((word) => mentionsWord(reply, word)),
          ...exactCase.filter((word) => mentionsWord(reply, word, true)),
        ]
      : [];
    const status =
      result.status === "ok" ? "ok" : result.status === "crisis" ? "keyword_stop" : "failed";
    const record: RestRecord = {
      messageId: item.id,
      group: item.group,
      stepIndex: item.stepIndex,
      stepCount: item.stepCount,
      message: item.text,
      status,
      failedReason:
        status === "failed" ? (thrown ? "error" : (failedReasonOf(calls) ?? "unknown")) : undefined,
      reply,
      shownLeaks,
      calls,
      ...timingOf(unit, started),
    };
    deps.onRecord?.("rest", record);
    return record;
  });
  return records.filter((record): record is RestRecord => record !== null && record !== undefined);
}

/** AC3, time reading: the local rule (GOAL-TIME), once per line, with no model call. */
export function readTimes(input: GoalLinesInput): TimeReadRecord[] {
  return input.lines.map((line) => ({
    lineId: line.id,
    goal: line.goal,
    ambiguous: line.ambiguous,
    expectedMinutes: line.expectedMinutes,
    foundMinutes: findTimeInGoal(line.goal),
  }));
}

/**
 * AC3, the split: each line three times through the app's `splitGoal` (the keyword gate, the
 * gateway and the final Plan check), with the time the dialogue would use. The per-browser limit
 * does not apply to an offline run, so it is switched off for this call only (TEST-NO-CAP).
 */
export async function runSplitSuite(
  input: GoalLinesInput,
  deps: SuiteDeps & { env: Record<string, string | undefined> },
) {
  const items = input.lines.flatMap((line) =>
    Array.from({ length: input.runsPerLine }, (_, run) => ({ ...line, run: run + 1 })),
  );
  const env = { ...deps.env, MODEL_CALL_LIMIT_ENABLED: "0" };
  const records = await inPool(items, deps.concurrency, async (item) => {
    if (deps.budget.stopped) return null;
    const unit = newUnit();
    const started = Date.now();
    const totalMinutes = capGoalMinutes(findTimeInGoal(item.goal)) ?? input.defaultMinutes;
    const outcome = await splitGoal(
      { goal: item.goal, totalMinutes, splitFiner: false },
      {
        env,
        today: "2026-01-01",
        readCounter: () => undefined,
        writeCounter: () => undefined,
        createGateway: () => deps.gatewayFor(unit),
        safety: keywordOnlySafetyCheck,
      },
    );
    if (unit.stoppedByBudget) return null;
    const calls = callsOf(unit);
    const status =
      outcome.status === "plan" ? "ok" : outcome.status === "crisis" ? "keyword_stop" : "failed";
    const record: SplitRecord = {
      lineId: item.id,
      run: item.run,
      kind: item.kind,
      ambiguous: item.ambiguous,
      totalMinutes,
      status,
      failedReason: status === "failed" ? (failedReasonOf(calls) ?? "plan_check") : undefined,
      stepCount: outcome.status === "plan" ? outcome.plan.steps.length : undefined,
      steps: outcome.status === "plan" ? outcome.plan.steps : undefined,
      calls,
      ...timingOf(unit, started),
    };
    deps.onRecord?.("split", record);
    return record;
  });
  return records.filter((record): record is SplitRecord => record !== null && record !== undefined);
}
