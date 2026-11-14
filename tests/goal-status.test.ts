import { describe, expect, it } from "vitest";
import { setGoalStatus, type GoalStatusWriter } from "@/lib/home/goal-status";
import type { ProgressGoal } from "@/lib/progress/account-progress";

// #268 AC4 (#88): Put on hold and Mark done take the Goal off Home with no question, and Undo
// puts it back. The Goal's open session is parked as on_hold so /focus never resumes it.

const GOAL = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

type Session = { id: string; goalId: string; state: "open" | "on_hold" | "completed" };

function memory(goals: Record<string, ProgressGoal["status"]>, sessions: Session[]) {
  const calls: string[] = [];
  const writer: GoalStatusWriter = {
    async goalStatus(goalId) {
      return goals[goalId] ?? null;
    },
    async setGoal(goalId, status) {
      calls.push(`goal ${status}`);
      goals[goalId] = status;
    },
    async sessionIn(goalId, state) {
      const found = sessions.filter((s) => s.goalId === goalId && s.state === state).at(-1);
      return found?.id ?? null;
    },
    async setSession(sessionId, state) {
      calls.push(`session ${state}`);
      const found = sessions.find((s) => s.id === sessionId);
      if (found) found.state = state;
    },
  };
  return { writer, goals, sessions, calls };
}

describe("#268 AC4 the Goal options", () => {
  it("put on hold sets the Goal and parks its open session", async () => {
    const store = memory({ [GOAL]: "in_progress" }, [{ id: "s1", goalId: GOAL, state: "open" }]);
    const outcome = await setGoalStatus(
      { goalId: GOAL, status: "on_hold" },
      { userId: "u", writer: store.writer },
    );
    expect(outcome).toEqual({ status: "ok", previous: "in_progress" });
    expect(store.goals[GOAL]).toBe("on_hold");
    expect(store.sessions[0].state).toBe("on_hold");
  });

  it("mark done does the same with done", async () => {
    const store = memory({ [GOAL]: "in_progress" }, [{ id: "s1", goalId: GOAL, state: "open" }]);
    await setGoalStatus({ goalId: GOAL, status: "done" }, { userId: "u", writer: store.writer });
    expect(store.goals[GOAL]).toBe("done");
    expect(store.sessions[0].state).toBe("on_hold");
  });

  it("undo restores in_progress and reopens the parked session once", async () => {
    const store = memory({ [GOAL]: "on_hold" }, [
      { id: "s0", goalId: GOAL, state: "completed" },
      { id: "s1", goalId: GOAL, state: "on_hold" },
    ]);
    const deps = { userId: "u", writer: store.writer };
    const outcome = await setGoalStatus({ goalId: GOAL, status: "in_progress" }, deps);
    expect(outcome).toEqual({ status: "ok", previous: "on_hold" });
    expect(store.goals[GOAL]).toBe("in_progress");
    expect(store.sessions.map((s) => s.state)).toEqual(["completed", "open"]);
    // A second Undo (a repeated tap, or a refreshed page) opens no second session.
    store.sessions.push({ id: "s2", goalId: GOAL, state: "on_hold" });
    await setGoalStatus({ goalId: GOAL, status: "in_progress" }, deps);
    expect(store.sessions.map((s) => s.state)).toEqual(["completed", "open", "on_hold"]);
  });

  it("a Goal with no session changes its status alone", async () => {
    const store = memory({ [GOAL]: "in_progress" }, []);
    await setGoalStatus({ goalId: GOAL, status: "on_hold" }, { userId: "u", writer: store.writer });
    expect(store.calls).toEqual(["goal on_hold"]);
  });

  it("refuses a signed-out user, another account's Goal, a bad id and a bad status", async () => {
    const store = memory({ [GOAL]: "in_progress" }, [{ id: "s1", goalId: GOAL, state: "open" }]);
    const deps = { userId: "u", writer: store.writer };
    const failed = { status: "failed" };
    expect(
      await setGoalStatus({ goalId: GOAL, status: "on_hold" }, { ...deps, userId: null }),
    ).toEqual(failed);
    expect(await setGoalStatus({ goalId: OTHER, status: "on_hold" }, deps)).toEqual(failed);
    expect(await setGoalStatus({ goalId: "not-a-uuid", status: "on_hold" }, deps)).toEqual(failed);
    expect(await setGoalStatus({ goalId: GOAL, status: "planned" }, deps)).toEqual(failed);
    expect(await setGoalStatus(null, deps)).toEqual(failed);
    expect(store.calls).toEqual([]);
  });
});
