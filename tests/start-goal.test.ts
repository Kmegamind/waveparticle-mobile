import { describe, expect, it } from "vitest";
import { classifyGoalShape } from "@/lib/prototype/goal-lines";
import {
  startGoal,
  type GoalRow,
  type GoalWriter,
  type StartGoalInput,
  type StepRow,
} from "@/lib/goals/start-goal";
import { createSupabaseGoalWriter } from "@/lib/goals/supabase-goal-writer";

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
      (
        await startGoal(input({ goalText: "I want to kill myself" }), {
          userId: USER,
          writer: inGoal.writer,
        })
      ).status,
    ).toBe("crisis");
    expect(inGoal.calls).toEqual([]);

    const inStep = memoryWriter();
    expect(
      (
        await startGoal(
          input({
            steps: [{ title: "Draft it", description: "I want to kill myself", minutes: 30 }],
          }),
          { userId: USER, writer: inStep.writer },
        )
      ).status,
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

type Call = [table: string, op: string, args: unknown[]];

/** A recording stand-in for the Supabase query builder; `failOn` makes one operation return an error. */
function fakeClient(options: { exists?: boolean; failOn?: string } = {}) {
  const calls: Call[] = [];
  function builder(table: string) {
    const result = (op: string) => ({
      data: op === "maybeSingle" ? (options.exists ? { id: GOAL_ID } : null) : null,
      error: options.failOn === `${table}.${op}` ? { message: "boom" } : null,
    });
    let lastOp = "";
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "insert", "update", "delete", "eq", "maybeSingle"]) {
      chain[op] = (...args: unknown[]) => {
        calls.push([table, op, args]);
        if (op !== "eq" && op !== "maybeSingle") lastOp = op;
        if (op === "maybeSingle") return Promise.resolve(result("maybeSingle"));
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => void) => resolve(result(lastOp));
    return chain;
  }
  return { client: { from: (table: string) => builder(table) }, calls };
}

const goalRow: GoalRow = {
  id: GOAL_ID,
  user_id: USER,
  title: "Methods section",
  text: "Write the methods",
  shape: "specific",
  split_finer: false,
  total_minutes: 30,
  status: "in_progress",
};
const stepRows: StepRow[] = [
  { goal_id: GOAL_ID, position: 0, title: "Draft it", description: null, minutes: 30 },
];

describe("#32 the Supabase GoalWriter", () => {
  it("reads goals by id to know whether the Goal exists", async () => {
    const fake = fakeClient({ exists: true });
    const writer = createSupabaseGoalWriter(fake.client as never);
    expect(await writer.goalExists(GOAL_ID)).toBe(true);
    expect(fake.calls).toContainEqual(["goals", "eq", ["id", GOAL_ID]]);
    expect(await createSupabaseGoalWriter(fakeClient().client as never).goalExists(GOAL_ID)).toBe(
      false,
    );
  });

  it("inserts and updates the Goal row", async () => {
    const fake = fakeClient();
    const writer = createSupabaseGoalWriter(fake.client as never);
    await writer.insertGoal(goalRow);
    await writer.updateGoal(goalRow);
    expect(fake.calls).toContainEqual(["goals", "insert", [goalRow]]);
    expect(fake.calls.filter(([t, op]) => t === "goals" && op === "update")).toHaveLength(1);
    expect(fake.calls).toContainEqual(["goals", "eq", ["id", GOAL_ID]]);
  });

  it("replaces the Steps: deletes the Goal's Steps, then inserts the new rows", async () => {
    const fake = fakeClient();
    await createSupabaseGoalWriter(fake.client as never).replaceSteps(GOAL_ID, stepRows);
    const ops = fake.calls.filter(([t]) => t === "steps").map(([, op, args]) => [op, args]);
    expect(ops).toEqual([
      ["delete", []],
      ["eq", ["goal_id", GOAL_ID]],
      ["insert", [stepRows]],
    ]);
  });

  it("deletes a Goal by id", async () => {
    const fake = fakeClient();
    await createSupabaseGoalWriter(fake.client as never).deleteGoal(GOAL_ID);
    expect(fake.calls).toEqual([
      ["goals", "delete", []],
      ["goals", "eq", ["id", GOAL_ID]],
    ]);
  });

  it("throws, without row data, when the database returns an error", async () => {
    const writer = createSupabaseGoalWriter(fakeClient({ failOn: "steps.insert" }).client as never);
    await expect(writer.replaceSteps(GOAL_ID, stepRows)).rejects.toThrow(/^goal write failed$/);
  });
});

describe("#32 the server action checks its input at run time (it is a public endpoint)", () => {
  const malformed: [string, unknown][] = [
    ["steps is not a list", { ...input(), steps: null }],
    ["a Step has no title", { ...input(), steps: [{ description: "", minutes: 30 }] }],
    ["goalId is not a UUID", { ...input(), goalId: "not-a-uuid" }],
    ["splitFiner is not a boolean or null", { ...input(), splitFiner: "yes" }],
    [
      "more than 50 Steps",
      {
        ...input(),
        steps: Array.from({ length: 51 }, () => ({ title: "A", description: "", minutes: 1 })),
      },
    ],
    ["a goal text over 1000 characters", { ...input(), goalText: "a".repeat(1001) }],
    ["a title over 1000 characters", { ...input(), title: "a".repeat(1001) }],
    [
      "a Step title over 200 characters",
      { ...input(), steps: [{ title: "a".repeat(201), description: "", minutes: 30 }] },
    ],
    [
      "a Step description over 1000 characters",
      { ...input(), steps: [{ title: "A", description: "a".repeat(1001), minutes: 30 }] },
    ],
    [
      "a Step longer than one day",
      { ...input(), steps: [{ title: "A", description: "", minutes: 24 * 60 + 1 }] },
    ],
    ["not an object", "hello"],
  ];

  it.each(malformed)("%s gives invalid and writes nothing", async (_name, value) => {
    const memory = memoryWriter();
    const outcome = await startGoal(value as StartGoalInput, {
      userId: USER,
      writer: memory.writer,
    });
    expect(outcome.status).toBe("invalid");
    expect(memory.calls).toEqual([]);
  });

  it("still accepts the limits themselves", async () => {
    const memory = memoryWriter();
    const outcome = await startGoal(
      input({
        goalText: "a".repeat(1000),
        title: "a".repeat(1000),
        steps: Array.from({ length: 50 }, () => ({
          title: "a".repeat(200),
          description: "a".repeat(1000),
          minutes: 24 * 60,
        })),
      }),
      { userId: USER, writer: memory.writer },
    );
    expect(outcome.status).toBe("saved");
  });
});
