import { describe, expect, it } from "vitest";
import { classifyGoalShape } from "@/lib/prototype/goal-lines";
import {
  startGoal,
  type GoalRow,
  type GoalWriter,
  type StartGoalInput,
  type StepRow,
} from "@/lib/goals/start-goal";

const USER = "11111111-1111-4111-8111-111111111111";
const GOAL_ID = "22222222-2222-4222-8222-222222222222";

function memoryWriter(options: { failSteps?: boolean } = {}) {
  const goals = new Map<string, GoalRow>();
  const steps = new Map<string, StepRow[]>();
  const calls: string[] = [];
  const writer: GoalWriter = {
    async goalExists(id) {
      calls.push("goalExists");
      return goals.has(id);
    },
    async insertGoal(row) {
      calls.push("insertGoal");
      goals.set(row.id, row);
    },
    async updateGoal(row) {
      calls.push("updateGoal");
      goals.set(row.id, row);
    },
    async replaceSteps(goalId, rows) {
      calls.push("replaceSteps");
      if (options.failSteps) throw new Error("goal write failed");
      steps.set(goalId, rows);
    },
    async deleteGoal(id) {
      calls.push("deleteGoal");
      goals.delete(id);
      steps.delete(id);
    },
  };
  return { writer, goals, steps, calls };
}

function input(overrides: Partial<StartGoalInput> = {}): StartGoalInput {
  return {
    goalId: GOAL_ID,
    goalText: "Write the methods section of my lab report",
    title: "Methods section",
    splitFiner: false,
    steps: [
      { title: "Gather what you need", description: "Find the protocol sheet.", minutes: 7 },
      { title: "Draft it", description: "", minutes: 53 },
    ],
    ...overrides,
  };
}

describe("#32 US-GD-15 Start saves the Goal and the Plan", () => {
  it("#32 AC3 drops Steps whose name is empty after trimming", async () => {
    const memory = memoryWriter();
    const outcome = await startGoal(
      input({
        steps: [
          { title: "Gather what you need", description: "", minutes: 10 },
          { title: "  ", description: "kept nowhere", minutes: 10 },
          { title: "Draft it", description: "", minutes: 20 },
        ],
      }),
      { userId: USER, writer: memory.writer },
    );
    expect(outcome.status).toBe("saved");
    if (outcome.status !== "saved") return;
    expect(outcome.steps).toHaveLength(2);
    const rows = memory.steps.get(GOAL_ID)!;
    expect(rows.map((row) => [row.position, row.title])).toEqual([
      [0, "Gather what you need"],
      [1, "Draft it"],
    ]);
  });

  it("#32 AC4 keeps names, descriptions and minutes as given", async () => {
    const memory = memoryWriter();
    await startGoal(input(), { userId: USER, writer: memory.writer });
    const rows = memory.steps.get(GOAL_ID)!;
    expect(rows).toEqual([
      {
        goal_id: GOAL_ID,
        position: 0,
        title: "Gather what you need",
        description: "Find the protocol sheet.",
        minutes: 7,
      },
      { goal_id: GOAL_ID, position: 1, title: "Draft it", description: null, minutes: 53 },
    ]);
    expect(memory.goals.get(GOAL_ID)!.total_minutes).toBe(60);
  });

  it.each([0, -5, 2.5, Number.NaN])(
    "#32 AC4 rejects minutes that are not whole numbers of at least 1 (%s)",
    async (minutes) => {
      const memory = memoryWriter();
      const outcome = await startGoal(
        input({ steps: [{ title: "Draft it", description: "", minutes }] }),
        { userId: USER, writer: memory.writer },
      );
      expect(outcome.status).toBe("invalid");
      expect(memory.calls).toEqual([]);
    },
  );

  it("#32 AC2 creates one in_progress Goal for the signed-in user", async () => {
    const memory = memoryWriter();
    const outcome = await startGoal(input(), { userId: USER, writer: memory.writer });
    expect(outcome).toMatchObject({ status: "saved", goalId: GOAL_ID });
    expect(memory.goals.get(GOAL_ID)).toEqual({
      id: GOAL_ID,
      user_id: USER,
      title: "Methods section",
      text: "Write the methods section of my lab report",
      shape: classifyGoalShape("Write the methods section of my lab report"),
      split_finer: false,
      total_minutes: 60,
      status: "in_progress",
    });
  });

  it("#32 AC2 a second Start with the same goalId keeps one Goal and replaces its Steps", async () => {
    const memory = memoryWriter();
    await startGoal(input(), { userId: USER, writer: memory.writer });
    await startGoal(
      input({ steps: [{ title: "Draft the whole thing", description: "", minutes: 45 }] }),
      { userId: USER, writer: memory.writer },
    );
    expect(memory.goals.size).toBe(1);
    expect(memory.goals.get(GOAL_ID)!.total_minutes).toBe(45);
    expect(memory.steps.get(GOAL_ID)!.map((row) => row.title)).toEqual(["Draft the whole thing"]);
  });

  it("#32 a Goal left without Steps is repaired by the next Start", async () => {
    const memory = memoryWriter();
    const { steps: _ignored, ...rest } = input();
    void _ignored;
    memory.goals.set(GOAL_ID, {
      id: GOAL_ID,
      user_id: USER,
      title: rest.title,
      text: rest.goalText,
      shape: "specific",
      split_finer: false,
      total_minutes: 60,
      status: "in_progress",
    });
    const outcome = await startGoal(input(), { userId: USER, writer: memory.writer });
    expect(outcome.status).toBe("saved");
    expect(memory.steps.get(GOAL_ID)).toHaveLength(2);
  });

  it("#32 a failed Steps write on the first save deletes the new Goal", async () => {
    const memory = memoryWriter({ failSteps: true });
    const outcome = await startGoal(input(), { userId: USER, writer: memory.writer });
    expect(outcome.status).toBe("failed");
    expect(memory.goals.size).toBe(0);
    expect(memory.calls).toContain("deleteGoal");
  });

  it("#32 a crisis in the goal or in any Step saves nothing", async () => {
    const inGoal = memoryWriter();
    expect(
      (await startGoal(input({ goalText: "I want to kill myself" }), {
        userId: USER,
        writer: inGoal.writer,
      })).status,
    ).toBe("crisis");
    expect(inGoal.calls).toEqual([]);

    const inStep = memoryWriter();
    expect(
      (await startGoal(
        input({
          steps: [{ title: "Draft it", description: "I want to kill myself", minutes: 30 }],
        }),
        { userId: USER, writer: inStep.writer },
      )).status,
    ).toBe("crisis");
    expect(inStep.calls).toEqual([]);
  });

  it("#32 signed out saves nothing", async () => {
    const memory = memoryWriter();
    expect((await startGoal(input(), { userId: null, writer: memory.writer })).status).toBe(
      "signed-out",
    );
    expect(memory.calls).toEqual([]);
  });

  it("#32 no Steps left gives invalid", async () => {
    const memory = memoryWriter();
    const outcome = await startGoal(
      input({ steps: [{ title: " ", description: "", minutes: 30 }] }),
      { userId: USER, writer: memory.writer },
    );
    expect(outcome.status).toBe("invalid");
    expect(memory.calls).toEqual([]);
  });
});
