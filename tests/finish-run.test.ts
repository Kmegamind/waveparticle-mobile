import { describe, expect, it, vi } from "vitest";
import type { ClosingLineInput, ModelGateway } from "@/lib/model-gateway";
import {
  createMemoryProgressStore,
  type AccountProgress,
  type ProgressGoal,
} from "@/lib/progress/account-progress";
import { generationInputs } from "@/lib/prototype/story-inputs";
import {
  closingInputFor,
  findGoalForPlan,
  finishRun,
  normaliseFinishInput,
} from "@/lib/summary/finish-run";

// Issue #258: a finished run is saved on the account with its live closing line.

const USER = "user-1";
const RUN = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const NOW = "2026-11-13T12:00:00.000Z";
const STEP_TITLE = "SECRET_STEP_TITLE";
const GOAL_TEXT = "SECRET_GOAL_TEXT";

const planSteps = [
  { title: STEP_TITLE, description: "", minutes: 10 },
  { title: "Draft", description: "Rough pass", minutes: 20 },
];

function goal(id: string, status: ProgressGoal["status"] = "in_progress"): ProgressGoal {
  return {
    id,
    title: GOAL_TEXT,
    text: GOAL_TEXT,
    status,
    steps: planSteps.map((step, position) => ({
      id: `${id}-step-${position}`,
      position,
      title: step.title,
      description: step.description === "" ? null : step.description,
      minutes: step.minutes,
    })),
  };
}

const input = (overrides: Record<string, unknown> = {}) => ({
  runId: RUN,
  storyId: "bohr-difficulties",
  steps: planSteps,
  focusSeconds: [600, 1300],
  earlierLines: ["I open the notebook."],
  ...overrides,
});

function gatewayWith(result: unknown) {
  const writeClosingLine = vi.fn(async (_input: ClosingLineInput) => result);
  return { gateway: { writeClosingLine } as unknown as ModelGateway, writeClosingLine };
}

const ok = { source: "generated", closingLine: "I sent the paper off.", carryLine: "I wonder." };

async function storeWith(progress: Partial<AccountProgress>) {
  const store = createMemoryProgressStore();
  await store.write(USER, { userId: USER, goals: [], sessions: [], ...progress });
  return store;
}

describe("#258 the finishRun input is checked (public endpoint)", () => {
  it("refuses malformed input", () => {
    expect(normaliseFinishInput(input())).not.toBeNull();
    expect(normaliseFinishInput(input({ runId: "nope" }))).toBeNull();
    expect(normaliseFinishInput(input({ storyId: "nope" }))).toBeNull();
    expect(
      normaliseFinishInput(input({ steps: Array.from({ length: 51 }, () => planSteps[0]) })),
    ).toBeNull();
    expect(normaliseFinishInput(input({ focusSeconds: [-1, 10] }))).toBeNull();
    expect(normaliseFinishInput(input({ focusSeconds: [10] }))).toBeNull();
    expect(normaliseFinishInput(null)).toBeNull();
  });

  it("caps his earlier lines", () => {
    const many = Array.from({ length: 80 }, (_, i) => `I line ${i}.`);
    expect(normaliseFinishInput(input({ earlierLines: many }))?.earlierLines).toHaveLength(60);
  });
});

describe("#258 AC5 the run is matched to the account Goal by its Plan", () => {
  it("finds the in-progress Goal with the same Steps, ignoring spaces at the ends", () => {
    const progress = { userId: USER, goals: [goal("g1")], sessions: [] };
    const spaced = planSteps.map((step) => ({ ...step, title: ` ${step.title} ` }));
    expect(findGoalForPlan(progress, spaced)?.id).toBe("g1");
    expect(findGoalForPlan(progress, [planSteps[0]])).toBeNull();
    expect(
      findGoalForPlan(progress, [planSteps[0], { ...planSteps[1], minutes: 21 }]),
    ).toBeNull();
  });

  it("picks the last matching Goal", () => {
    const progress = { userId: USER, goals: [goal("g1"), goal("g2")], sessions: [] };
    expect(findGoalForPlan(progress, planSteps)?.id).toBe("g2");
  });

  it("ignores a Goal that is not in progress", () => {
    const progress = { userId: USER, goals: [goal("g1", "on_hold")], sessions: [] };
    expect(findGoalForPlan(progress, planSteps)).toBeNull();
  });
});

describe("#258 AC3 the closing call gets no text from the user", () => {
  it("holds the story's inputs and facts, never a Step title or the Goal", () => {
    const closing = closingInputFor("bohr-difficulties", [10, 20], ["I open the notebook."]);
    const sent = JSON.stringify(closing);
    expect(sent).toContain(generationInputs("bohr-difficulties").who);
    expect(closing.lastMoment.length).toBeGreaterThan(0);
    expect(closing.forbidTerms).toEqual(generationInputs("bohr-difficulties").forbidTerms);
    expect(closing.earlierLines).toEqual(["I open the notebook."]);
    expect(sent).not.toContain(STEP_TITLE);
    expect(sent).not.toContain(GOAL_TEXT);
  });
});

describe("#258 AC4 AC5 AC6 finishing a run", () => {
  const deps = (store: Awaited<ReturnType<typeof storeWith>>, gateway: ModelGateway | null) => ({
    userId: USER,
    store,
    gateway,
    nowIso: NOW,
  });

  it("is refused when signed out", async () => {
    const store = await storeWith({ goals: [goal("g1")] });
    const { gateway } = gatewayWith(ok);
    expect(await finishRun(input(), { ...deps(store, gateway), userId: null })).toEqual({
      status: "signed-out",
    });
  });

  it("is invalid for malformed input", async () => {
    const store = await storeWith({ goals: [goal("g1")] });
    expect(await finishRun(input({ runId: 1 }), deps(store, gatewayWith(ok).gateway))).toEqual({
      status: "invalid",
    });
  });

  it("says no-goal without calling the model when no Goal matches", async () => {
    const store = await storeWith({ goals: [] });
    const { gateway, writeClosingLine } = gatewayWith(ok);
    expect(await finishRun(input(), deps(store, gateway))).toEqual({ status: "no-goal" });
    expect(writeClosingLine).not.toHaveBeenCalled();
  });

  it("fails without a gateway and saves nothing", async () => {
    const store = await storeWith({ goals: [goal("g1")] });
    expect(await finishRun(input(), deps(store, null))).toEqual({ status: "failed" });
    expect((await store.read(USER, USER)).sessions).toHaveLength(0);
  });

  it("fails when generation fails and saves nothing", async () => {
    const store = await storeWith({ goals: [goal("g1")] });
    const { gateway } = gatewayWith({ source: "failed", reason: "checks" });
    expect(await finishRun(input(), deps(store, gateway))).toEqual({ status: "failed" });
    const after = await store.read(USER, USER);
    expect(after.sessions).toHaveLength(0);
    expect(after.goals[0].status).toBe("in_progress");
  });

  it("saves a completed session with his lines, moves the Goal to Done and offers the next story", async () => {
    const store = await storeWith({ goals: [goal("g1")] });
    const { gateway } = gatewayWith(ok);
    expect(await finishRun(input(), deps(store, gateway))).toEqual({
      status: "ok",
      shown: { closingLine: ok.closingLine, carryLine: ok.carryLine, next: "tolman-lecture" },
    });
    const after = await store.read(USER, USER);
    expect(after.goals[0].status).toBe("done");
    expect(after.sessions).toHaveLength(1);
    const session = after.sessions[0];
    expect(session).toMatchObject({
      id: RUN,
      goalId: "g1",
      companionId: "oppenheimer",
      storyId: "bohr-difficulties",
      state: "completed",
      closingLine: ok.closingLine,
    });
    expect(session.steps.map((step) => [step.stepId, step.doneAt])).toEqual([
      ["g1-step-0", NOW],
      ["g1-step-1", NOW],
    ]);
    expect(session.lines).toEqual([
      expect.objectContaining({ kind: "closing", source: "generated", text: ok.carryLine }),
    ]);
  });

  it("reuses the stored lines for a Goal that is already finished", async () => {
    const store = await storeWith({ goals: [goal("g1")] });
    const first = gatewayWith(ok);
    await finishRun(input(), deps(store, first.gateway));
    // The Goal is Done now; a reload sends the same run again.
    const second = gatewayWith({ ...ok, closingLine: "I am someone else." });
    expect(await finishRun(input(), deps(store, second.gateway))).toEqual({
      status: "ok",
      shown: { closingLine: ok.closingLine, carryLine: ok.carryLine, next: "tolman-lecture" },
    });
    expect(second.writeClosingLine).not.toHaveBeenCalled();
    expect((await store.read(USER, USER)).sessions).toHaveLength(1);
  });

  it("offers no next story after the last one or for a story finished before", async () => {
    const last = await storeWith({ goals: [goal("g1")] });
    const result = await finishRun(
      input({ storyId: "fermi-award" }),
      deps(last, gatewayWith(ok).gateway),
    );
    expect(result).toMatchObject({ status: "ok", shown: { next: null } });

    const store = await storeWith({ goals: [goal("old", "done"), goal("g1")] });
    const earlier = await store.read(USER, USER);
    await store.write(USER, {
      ...earlier,
      sessions: [
        {
          id: "9f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f",
          goalId: "old",
          companionId: "oppenheimer",
          storyId: "bohr-difficulties",
          state: "completed",
          backgroundCard: null,
          backgroundCardSource: null,
          mergedKeyMoments: [],
          closingLine: "I was here before.",
          steps: [],
          lines: [],
        },
      ],
    });
    const again = await finishRun(input(), deps(store, gatewayWith(ok).gateway));
    expect(again).toMatchObject({ status: "ok", shown: { next: null } });
  });
});
