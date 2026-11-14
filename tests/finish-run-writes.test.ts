import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@/lib/model-gateway";
import {
  createMemoryProgressStore,
  type AccountProgress,
  type ProgressGoal,
} from "@/lib/progress/account-progress";
import { findGoalForPlan, finishRun } from "@/lib/summary/finish-run";
import { createMemoryRunWriter, createSupabaseRunWriter } from "@/lib/summary/run-writer";

// Issue #258, final review: saving a run is safe against a second tab and a write that fails
// halfway, and it touches only the rows of this run.

const USER = "user-1";
const RUN = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const NOW = "2026-11-13T12:00:00.000Z";
const steps = [{ title: "Outline", description: "", minutes: 10 }];

const goal = (id: string, createdAt?: string): ProgressGoal => ({
  id,
  title: "Goal",
  text: "Goal",
  status: "in_progress",
  ...(createdAt ? { createdAt } : {}),
  steps: [{ id: `${id}-s0`, position: 0, title: "Outline", description: null, minutes: 10 }],
});

const input = {
  runId: RUN,
  storyId: "bohr-difficulties",
  steps,
  focusSeconds: [600],
  earlierLines: [],
};

async function setup(goals: ProgressGoal[] = [goal("g1")]) {
  const store = createMemoryProgressStore();
  const progress: AccountProgress = { userId: USER, goals, sessions: [] };
  await store.write(USER, progress);
  return store;
}

function slowGateway(lines: { closingLine: string; carryLine: string }[]) {
  let call = 0;
  const writeClosingLine = vi.fn(async () => {
    const line = lines[Math.min(call, lines.length - 1)];
    call += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { source: "generated" as const, ...line };
  });
  return { gateway: { writeClosingLine } as unknown as ModelGateway, writeClosingLine };
}

describe("#258 review I1: a second tab during the call never mixes two runs' lines", () => {
  it("both tabs show the lines that were saved, and one closing row exists", async () => {
    const store = await setup();
    const writer = createMemoryRunWriter(store, USER);
    const { gateway } = slowGateway([
      { closingLine: "I sent it off.", carryLine: "I wonder about Born." },
      { closingLine: "I kept it a day longer.", carryLine: "I doubt the method." },
    ]);
    const deps = { userId: USER, store, writer, gateway, nowIso: NOW };
    const [first, second] = await Promise.all([finishRun(input, deps), finishRun(input, deps)]);
    expect(first).toEqual(second);
    const saved = (await store.read(USER, USER)).sessions;
    expect(saved).toHaveLength(1);
    expect(saved[0].lines.filter((line) => line.kind === "closing")).toHaveLength(1);
    expect(first).toMatchObject({
      status: "ok",
      shown: { closingLine: saved[0].closingLine, carryLine: saved[0].lines[0].text },
    });
  });
});

describe("#258 review I2: a write that fails halfway can be retried", () => {
  it("a retry after the Goal update failed finishes the run with the same lines", async () => {
    const store = await setup();
    const writer = createMemoryRunWriter(store, USER);
    const markGoalDone = writer.markGoalDone;
    writer.markGoalDone = vi.fn(async () => {
      throw new Error("network");
    });
    const { gateway, writeClosingLine } = slowGateway([
      { closingLine: "I sent it off.", carryLine: "I wonder about Born." },
    ]);
    const deps = { userId: USER, store, writer, gateway, nowIso: NOW };
    expect(await finishRun(input, deps)).toEqual({ status: "failed" });

    writer.markGoalDone = markGoalDone;
    expect(await finishRun(input, deps)).toEqual({
      status: "ok",
      shown: {
        closingLine: "I sent it off.",
        carryLine: "I wonder about Born.",
        next: "tolman-lecture",
      },
    });
    expect(writeClosingLine).toHaveBeenCalledTimes(1);
    const after = await store.read(USER, USER);
    expect(after.goals[0].status).toBe("done");
    expect(after.sessions[0].steps).toHaveLength(1);
  });
});

describe("#258 review I4: the newest matching Goal is chosen by its creation time", () => {
  it("ignores the read order", () => {
    const progress = {
      userId: USER,
      goals: [goal("newer", "2026-11-13T10:00:00Z"), goal("older", "2026-11-12T10:00:00Z")],
      sessions: [],
    };
    expect(findGoalForPlan(progress, steps)?.id).toBe("newer");
  });
});

describe("#258 review I3: the Supabase writer touches only this run's rows", () => {
  function fakeClient(duplicateSession = false) {
    const calls: { table: string; op: string; rows?: unknown; options?: unknown }[] = [];
    const result = (error: { code?: string; message: string } | null = null) =>
      Promise.resolve({ data: [], error });
    const from = (table: string) => ({
      insert: (rows: unknown) => {
        calls.push({ table, op: "insert", rows });
        return result(
          duplicateSession && table === "sessions"
            ? { code: "23505", message: "duplicate key" }
            : null,
        );
      },
      upsert: (rows: unknown, options: unknown) => {
        calls.push({ table, op: "upsert", rows, options });
        return result();
      },
      update: (rows: unknown) => ({
        eq: (column: string, value: string) => {
          calls.push({ table, op: "update", rows, options: { [column]: value } });
          return result();
        },
      }),
    });
    return { client: { from }, calls };
  }

  const session = {
    id: RUN,
    userId: USER,
    goalId: "g1",
    storyId: "bohr-difficulties",
    closingLine: "I sent it off.",
    stepCount: 1,
    completedAt: NOW,
  };

  it("inserts the session (never upserts the account) and updates one Goal", async () => {
    const { client, calls } = fakeClient();
    const writer = createSupabaseRunWriter(client);
    expect(await writer.insertSession(session)).toBe("inserted");
    await writer.markGoalDone("g1");
    expect(calls.map((call) => `${call.table}:${call.op}`)).toEqual([
      "sessions:insert",
      "goals:update",
    ]);
    expect(calls[0].rows).toMatchObject({
      id: RUN,
      user_id: USER,
      state: "completed",
      companion_id: "oppenheimer",
      closing_line: "I sent it off.",
      completed_at: NOW,
    });
    expect(calls[1]).toMatchObject({ rows: { status: "done" }, options: { id: "g1" } });
  });

  it("reports an existing session instead of failing", async () => {
    const { client } = fakeClient(true);
    expect(await createSupabaseRunWriter(client).insertSession(session)).toBe("exists");
  });

  it("writes steps and the closing line so a retry adds no duplicate", async () => {
    const { client, calls } = fakeClient();
    const writer = createSupabaseRunWriter(client);
    await writer.insertSteps(RUN, [
      { id: "a", stepId: "g1-s0", position: 0, openedAt: null, doneAt: NOW },
    ]);
    await writer.insertClosingLine(RUN, {
      id: "b",
      sessionStepId: null,
      seq: 0,
      kind: "closing",
      cardId: null,
      source: "generated",
      text: "I wonder.",
      pauseNumber: null,
      shownAt: NOW,
    });
    expect(calls.map((call) => [call.table, call.op, call.options])).toEqual([
      ["session_steps", "upsert", { onConflict: "id", ignoreDuplicates: true }],
      ["session_lines", "upsert", { onConflict: "id", ignoreDuplicates: true }],
    ]);
  });
});
