import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { remainingSeconds } from "@/lib/clock";
import type { AccountProgress } from "@/lib/progress/account-progress";
import { applyFocusSnapshot, openFocusSession, snapshotOf } from "@/lib/progress/focus-session";
import { HOLD_MS, UNDO_MS, completeStep, setStepCards, syncSession } from "@/lib/prototype/session";
import { summaryUndo, summaryUndoOpen } from "@/lib/summary/end-undo";

// #27 AC4: the summary after the last Done shows the same Undo toast, and Undo reopens the run.

const NOW = "2026-11-20T10:00:00.000Z";

function ids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

function account(): AccountProgress {
  return {
    userId: "user-1",
    goals: [
      {
        id: "goal-1",
        title: "Write the report",
        text: "Write the report",
        status: "in_progress",
        steps: [
          { id: "step-a", position: 0, title: "Outline", description: null, minutes: 10 },
          { id: "step-b", position: 1, title: "Draft", description: null, minutes: 15 },
        ],
      },
    ],
    sessions: [],
  };
}

/** The account with its open session, and this device's session after the last Done at 70 s. */
function finishedRun() {
  const base = account();
  const opened = openFocusSession(base, "goal-1", { storyId: "site-search", newId: ids() })!;
  const progress: AccountProgress = { ...base, sessions: opened.writes };
  const plan = opened.plan;
  let device = syncSession(null, { goal: plan.goal, steps: plan.steps, storyId: plan.storyId }, 1);
  device = setStepCards(device, 0, { opening: "Background.", story: [] }, 0);
  device = completeStep(device, 10_000);
  device = setStepCards(device, 1, { opening: "Next.", story: [] }, 10_000);
  device = completeStep(device, 70_000);
  const done = applyFocusSnapshot(progress, snapshotOf(plan.sessionId, device), {
    now: NOW,
    newId: ids(),
    userId: "user-1",
  })!;
  const stored: AccountProgress = { ...progress, goals: [done.goal], sessions: [done.session] };
  return { plan, device, stored };
}

describe("#27 AC4 the summary's Undo toast", () => {
  it("test_27_ac4_the_toast_shows_for_the_same_eight_seconds_after_the_last_done", () => {
    const { device } = finishedRun();
    expect(summaryUndoOpen(device, 70_000)).toBe(true);
    expect(summaryUndoOpen(device, 70_000 + UNDO_MS - 1)).toBe(true);
    expect(summaryUndoOpen(device, 70_000 + UNDO_MS)).toBe(false);
    expect(summaryUndoOpen(null, 70_000)).toBe(false);
  });

  it("test_27_ac4_a_held_toast_keeps_its_time", () => {
    const { device } = finishedRun();
    // Held with 3 seconds left, then Undo long after its first end.
    expect(summaryUndo(device, 70_000 + UNDO_MS + 60_000, 3_000)).not.toBeNull();
    expect(summaryUndo(device, 70_000 + UNDO_MS + 60_000, null)).toBeNull();
  });

  it("test_27_ac4_undo_brings_the_last_step_back_with_its_clock_after_the_hold", () => {
    const { device } = finishedRun();
    const at = 75_000;
    const back = summaryUndo(device, at, null)!;
    expect(back.current).toBe(1);
    expect(back.undo).toBeNull();
    const clock = back.steps[1].clock!;
    const atDone = remainingSeconds(device.steps[1].clock!, 70_000);
    expect(atDone).toBeLessThan(15 * 60);
    // The time on the summary is not counted, and the clock waits 1.2 s before it runs again.
    expect(remainingSeconds(clock, at)).toBe(atDone);
    expect(remainingSeconds(clock, at + HOLD_MS)).toBe(atDone);
    expect(remainingSeconds(clock, at + HOLD_MS + 5_000)).toBe(atDone - 5);
  });

  it("test_27_ac4_undo_reopens_the_finished_run_and_the_goal_on_the_account", () => {
    const { plan, device, stored } = finishedRun();
    expect(stored.sessions[0].state).toBe("completed");
    expect(stored.goals[0].status).toBe("done");
    const back = summaryUndo(device, 75_000, null)!;
    const reopened = applyFocusSnapshot(stored, snapshotOf(plan.sessionId, back), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    })!;
    expect(reopened.session.state).toBe("open");
    expect(reopened.goal.status).toBe("in_progress");
    expect(reopened.session.steps.map((step) => step.doneAt !== null)).toEqual([true, false]);
    // The reopened session is the one /focus continues (no new session, nothing restarted).
    const again = openFocusSession(
      { ...stored, goals: [reopened.goal], sessions: [reopened.session] },
      "goal-1",
      { storyId: "site-search", newId: ids() },
    )!;
    expect(again.writes).toEqual([]);
    expect(again.plan.sessionId).toBe(plan.sessionId);
  });

  it("test_27_ac4_no_undo_for_a_run_that_is_not_finished_or_already_undone", () => {
    const { device } = finishedRun();
    const back = summaryUndo(device, 75_000, null)!;
    expect(summaryUndoOpen(back, 75_000)).toBe(false);
    expect(summaryUndo(back, 75_000, null)).toBeNull();
  });

  it("test_27_ac4_the_summary_page_shows_the_toast_and_opens_the_focus_page_after_undo", () => {
    const screen = readFileSync("src/app/end/end-screen.tsx", "utf8");
    expect(screen).toContain('role="status"');
    expect(screen).toContain("Step done");
    expect(screen).toContain("summaryUndo(");
  });
});
