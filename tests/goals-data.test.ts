import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { GoalStatusWriter } from "@/lib/home/goal-status";
import { renameGoal, resumeGoal, setGoalKind, type GoalEditWriter } from "@/lib/goals/goal-edits";
import { isGoalId, readGoalsData } from "@/lib/goals/goals-reader";

const ID = "11111111-1111-4111-8111-111111111111";
const USER = "99999999-9999-4999-8999-999999999999";

function editWriter(overrides: Partial<GoalEditWriter> = {}): GoalEditWriter {
  return {
    rename: vi.fn(async () => {}),
    setKind: vi.fn(async () => {}),
    newestSessionIn: vi.fn(async () => null),
    ...overrides,
  };
}

function statusWriter(overrides: Partial<GoalStatusWriter> = {}): GoalStatusWriter {
  return {
    goalStatus: vi.fn(async () => "on_hold" as const),
    setGoal: vi.fn(async () => {}),
    sessionIn: vi.fn(async () => null),
    sessionOf: vi.fn(async () => ({ goalId: ID, state: "on_hold" })),
    setSession: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("#77 AC4 the Goal type", () => {
  it("#77 AC4 the migration adds goals.kind, default one_time, checked", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261114000000_goal_kind.sql"),
      "utf8",
    );
    expect(sql).toMatch(
      /alter table public\.goals\s+add column kind text not null default 'one_time'/i,
    );
    expect(sql).toMatch(/check \(kind in \('one_time', 'ongoing'\)\)/i);
  });

  it("#78 the type accepts one_time and ongoing only", async () => {
    const writer = editWriter();
    expect(await setGoalKind({ goalId: ID, kind: "ongoing" }, { userId: USER, writer })).toEqual({
      status: "ok",
    });
    expect(writer.setKind).toHaveBeenCalledWith(ID, "ongoing");
    for (const input of [{ goalId: ID, kind: "weekly" }, { goalId: "x", kind: "ongoing" }, null]) {
      expect(await setGoalKind(input, { userId: USER, writer })).toEqual({ status: "failed" });
    }
    expect(await setGoalKind({ goalId: ID, kind: "ongoing" }, { userId: null, writer })).toEqual({
      status: "failed",
    });
  });

  it("#78 a failed type write (for example before the migration) fails cleanly", async () => {
    const writer = editWriter({
      setKind: vi.fn(async () => {
        throw new Error("column goals.kind does not exist");
      }),
    });
    expect(await setGoalKind({ goalId: ID, kind: "ongoing" }, { userId: USER, writer })).toEqual({
      status: "failed",
    });
  });
});

describe("#78 renaming a Goal on its detail page", () => {
  it("#78 rename trims and saves", async () => {
    const writer = editWriter();
    expect(
      await renameGoal({ goalId: ID, title: "  Methods  " }, { userId: USER, writer }),
    ).toEqual({
      status: "ok",
    });
    expect(writer.rename).toHaveBeenCalledWith(ID, "Methods");
  });

  it("#78 rename refuses an empty title or one over 1000 characters", async () => {
    const writer = editWriter();
    for (const title of ["   ", "x".repeat(1001), 42]) {
      expect(await renameGoal({ goalId: ID, title }, { userId: USER, writer })).toEqual({
        status: "failed",
      });
    }
    expect(writer.rename).not.toHaveBeenCalled();
  });

  it("#78 rename gates crisis words and saves nothing", async () => {
    const writer = editWriter();
    expect(
      await renameGoal({ goalId: ID, title: "I want to kill myself" }, { userId: USER, writer }),
    ).toEqual({ status: "crisis" });
    expect(writer.rename).not.toHaveBeenCalled();
  });
});

describe("#79 Resume", () => {
  it("#79 AC2 Resume reopens the newest parked session", async () => {
    const edits = editWriter({ newestSessionIn: vi.fn(async () => "parked-1") });
    const status = statusWriter();
    expect(await resumeGoal({ goalId: ID }, { userId: USER, writer: edits, status })).toEqual({
      status: "ok",
      previous: "on_hold",
    });
    expect(status.setGoal).toHaveBeenCalledWith(ID, "in_progress");
    expect(status.setSession).toHaveBeenCalledWith("parked-1", "open");
  });

  it("#79 Resume without a parked session only changes the status", async () => {
    const status = statusWriter();
    await resumeGoal({ goalId: ID }, { userId: USER, writer: editWriter(), status });
    expect(status.setGoal).toHaveBeenCalledWith(ID, "in_progress");
    expect(status.setSession).not.toHaveBeenCalled();
  });

  it("#79 Resume refuses a bad id or no user", async () => {
    const status = statusWriter();
    for (const [input, userId] of [
      [{ goalId: "nope" }, USER],
      [{ goalId: ID }, null],
    ] as const) {
      expect(await resumeGoal(input, { userId, writer: editWriter(), status })).toEqual({
        status: "failed",
      });
    }
    expect(status.setGoal).not.toHaveBeenCalled();
  });
});

describe("the Goals reader", () => {
  it("isGoalId refuses non-UUIDs", () => {
    expect(isGoalId(ID)).toBe(true);
    for (const value of ["not-a-uuid", "", 3, null, `${ID}x`]) expect(isGoalId(value)).toBe(false);
  });

  it("#73 reads the account's rows; a missing kind is one_time", async () => {
    const tables: Record<string, unknown[]> = {
      goals: [
        {
          id: ID,
          user_id: USER,
          title: "Methods",
          status: "in_progress",
          created_at: "2026-11-01T09:00:00Z",
          updated_at: null,
        },
      ],
      steps: [
        {
          id: "s1",
          goal_id: ID,
          position: 0,
          title: "Gather",
          description: "Collect.",
          minutes: 15,
        },
      ],
      sessions: [
        {
          id: "x1",
          goal_id: ID,
          user_id: USER,
          state: "open",
          companion_id: "oppenheimer",
          started_at: "2026-11-11T09:00:00Z",
          last_active_at: null,
        },
      ],
      session_steps: [
        {
          id: "ss1",
          session_id: "x1",
          step_id: "s1",
          position: 0,
          done_at: "2026-11-11T09:20:00Z",
        },
      ],
    };
    const calls: string[] = [];
    const client = {
      from(table: string) {
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            calls.push(`${table}.${column}=${value}`);
            return query;
          },
          in: (column: string) => {
            calls.push(`${table}.${column} in`);
            return query;
          },
          then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            resolve({ data: tables[table] ?? [], error: null }),
        };
        return query;
      },
    };
    const data = await readGoalsData(client as never, USER);
    expect(calls).toContain(`goals.user_id=${USER}`);
    expect(calls).toContain(`sessions.user_id=${USER}`);
    expect(data).toEqual({
      goals: [
        {
          id: ID,
          title: "Methods",
          status: "in_progress",
          kind: "one_time",
          createdAt: "2026-11-01T09:00:00Z",
          updatedAt: null,
        },
      ],
      steps: [
        {
          id: "s1",
          goalId: ID,
          position: 0,
          title: "Gather",
          description: "Collect.",
          minutes: 15,
        },
      ],
      sessions: [
        {
          id: "x1",
          goalId: ID,
          state: "open",
          companionId: "oppenheimer",
          startedAt: "2026-11-11T09:00:00Z",
          lastActiveAt: null,
        },
      ],
      sessionSteps: [{ sessionId: "x1", stepId: "s1", doneAt: "2026-11-11T09:20:00Z" }],
    });
  });
});
