import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AccountProgress, ProgressSession } from "@/lib/progress/account-progress";
import {
  accountSessionKey,
  applyFocusSnapshot,
  openFocusSession,
  seedFocusSession,
  snapshotOf,
  type AccountFocusPlan,
} from "@/lib/progress/focus-session";
import {
  accountPauseMessage,
  accountRestReply,
  accountReturnLine,
  accountStepCards,
} from "@/lib/progress/account-lines";
import {
} from "@/lib/prototype/config";
import { isSessionPath } from "@/app/try/session-paths";
import {
  completeStep,
  setStepCards,
  startRest,
  addFirstRestMessage,
  backFromRest,
  setReturnLine,
  syncSession,
  tick,
  undoDone,
  visibleCards,
} from "@/lib/prototype/session";

const read = (path: string) => readFileSync(path, "utf8");
const NOW = "2026-11-13T10:00:00.000Z";

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
          { id: "step-b", position: 1, title: "Draft", description: null, minutes: 15 },
          { id: "step-a", position: 0, title: "Outline", description: "List it.", minutes: 10 },
        ],
      },
    ],
    sessions: [],
  };
}

function opened(progress = account()) {
  const result = openFocusSession(progress, "goal-1", { storyId: "site-search", newId: ids() });
  if (!result) throw new Error("no session");
  return { ...progress, sessions: [...progress.sessions, ...result.writes] } as AccountProgress;
}

describe("#257 AC3 opening /focus uses the Goal's open session or creates one", () => {
  it("creates one open session with a session step per Step, in Step order", () => {
    const result = openFocusSession(account(), "goal-1", {
      storyId: "site-search",
      newId: ids(),
    });
    expect(result).not.toBeNull();
    expect(result!.writes).toHaveLength(1);
    const session = result!.writes[0];
    expect(session.state).toBe("open");
    expect(session.goalId).toBe("goal-1");
    expect(session.companionId).toBe("oppenheimer");
    expect(session.storyId).toBe("site-search");
    expect(session.steps.map((step) => [step.position, step.stepId])).toEqual([
      [0, "step-a"],
      [1, "step-b"],
    ]);
    expect(result!.plan.steps.map((step) => step.title)).toEqual(["Outline", "Draft"]);
    expect(result!.plan.goal).toEqual({ text: "Write the report", minutes: 25 });
    expect(result!.plan.done).toEqual([false, false]);
    expect(result!.plan.cards).toEqual([[], []]);
  });

  it("reuses the open session and writes nothing", () => {
    const progress = opened();
    const again = openFocusSession(progress, "goal-1", { storyId: "site-search", newId: ids() });
    expect(again!.writes).toEqual([]);
    expect(again!.plan.sessionId).toBe(progress.sessions[0].id);
  });

  it("without a Goal id it continues the Goal of the open session", () => {
    const progress = opened();
    const again = openFocusSession(progress, null, { storyId: "site-search", newId: ids() });
    expect(again!.plan.goalId).toBe("goal-1");
  });

  it("a session for an older Plan of the Goal is marked restarted before a new one opens", () => {
    const progress = opened();
    progress.goals[0].steps = [
      { id: "step-c", position: 0, title: "Only", description: null, minutes: 20 },
    ];
    const again = openFocusSession(progress, "goal-1", { storyId: "site-search", newId: ids() });
    expect(again!.writes.map((session) => session.state)).toEqual(["restarted", "open"]);
    expect(again!.writes[1].steps.map((step) => step.stepId)).toEqual(["step-c"]);
  });

  it("refuses an unknown Goal, a Goal without Steps and a done Goal", () => {
    const deps = { storyId: "site-search", newId: ids() };
    expect(openFocusSession(account(), "nope", deps)).toBeNull();
    expect(openFocusSession(account(), null, deps)).toBeNull();
    const empty = account();
    empty.goals[0].steps = [];
    expect(openFocusSession(empty, "goal-1", deps)).toBeNull();
    const done = account();
    done.goals[0].status = "done";
    expect(openFocusSession(done, "goal-1", deps)).toBeNull();
  });
});

function planOf(progress: AccountProgress): AccountFocusPlan {
  return openFocusSession(progress, "goal-1", { storyId: "site-search", newId: ids() })!.plan;
}

function runningSession(plan: AccountFocusPlan, at = 0) {
  const base = syncSession(null, { goal: plan.goal, steps: plan.steps, storyId: plan.storyId }, 1);
  return setStepCards(base, 0, { opening: "Background.", story: ["One.", "Two."] }, at);
}

describe("#257 AC3 and AC4 progress is recorded on the account", () => {
  it("the snapshot holds only lines that were shown, never a prefetched Step", () => {
    const plan = planOf(opened());
    let session = runningSession(plan);
    session = setStepCards(session, 1, { opening: "Next.", story: ["Later."] }, 0);
    // Half of a 10 minute Step: the first of two story cards is due.
    session = tick(session, 5 * 60_000);
    expect(visibleCards(session, 0, 5 * 60_000)).toEqual(["Background.", "One."]);
    const snapshot = snapshotOf(plan.sessionId, session);
    expect(snapshot.current).toBe(0);
    expect(snapshot.opened).toEqual([true, false]);
    expect(snapshot.lines).toEqual([
      { step: 0, kind: "background", seq: 0, text: "Background.", pauseNumber: null },
      { step: 0, kind: "story_card", seq: 1, text: "One.", pauseNumber: null },
    ]);
  });

  it("Done sets done_at once, Undo clears it, and lines are written once", () => {
    const progress = opened();
    const plan = planOf(progress);
    let session = runningSession(plan);
    session = completeStep(session, 1_000);

    const first = applyFocusSnapshot(progress, snapshotOf(plan.sessionId, session), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    expect(first).not.toBeNull();
    expect(first!.session.steps[0].doneAt).toBe(NOW);
    expect(first!.session.steps[0].openedAt).toBe(NOW);
    expect(first!.session.steps[1].doneAt).toBeNull();
    expect(first!.session.lines.map((line) => line.text)).toEqual(["Background."]);

    // The same snapshot again adds nothing and keeps the first time.
    const stored = { ...progress, sessions: [first!.session] };
    const again = applyFocusSnapshot(stored, snapshotOf(plan.sessionId, session), {
      now: "2026-11-13T11:00:00.000Z",
      newId: ids(),
      userId: "user-1",
    });
    expect(again!.session.lines).toHaveLength(1);
    expect(again!.session.steps[0].doneAt).toBe(NOW);

    const undone = undoDone(session, 2_000);
    const back = applyFocusSnapshot(stored, snapshotOf(plan.sessionId, undone), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    expect(back!.session.steps[0].doneAt).toBeNull();
  });

  it("the last Done completes the session and the Goal; Undo reopens both", () => {
    const progress = opened();
    const plan = planOf(progress);
    let session = runningSession(plan);
    session = completeStep(session, 1_000);
    session = setStepCards(session, 1, { opening: "Next.", story: [] }, 1_000);
    session = completeStep(session, 5_000);
    const done = applyFocusSnapshot(progress, snapshotOf(plan.sessionId, session), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    expect(done!.session.state).toBe("completed");
    expect(done!.goal.status).toBe("done");

    const stored = { ...progress, sessions: [done!.session] };
    const undone = undoDone(session, 6_000);
    const back = applyFocusSnapshot(stored, snapshotOf(plan.sessionId, undone), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    expect(back!.session.state).toBe("open");
    expect(back!.goal.status).toBe("in_progress");
  });

  it("the pause message keeps its pause number and the return pop-up is written once", () => {
    const progress = opened();
    const plan = planOf(progress);
    let session = startRest(runningSession(plan), 1_000);
    session = addFirstRestMessage(session, "The film will not dry.");
    const paused = applyFocusSnapshot(progress, snapshotOf(plan.sessionId, session), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    const pause = paused!.session.lines.find((line) => line.kind === "pause_message");
    expect(pause).toMatchObject({ pauseNumber: 1, text: "The film will not dry." });

    session = setReturnLine(backFromRest(session), "It took a while.");
    const stored = { ...progress, sessions: [paused!.session] };
    const returned = applyFocusSnapshot(stored, snapshotOf(plan.sessionId, session), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    const kinds = returned!.session.lines.map((line) => line.kind);
    expect(kinds.filter((kind) => kind === "return_popup")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "pause_message")).toHaveLength(1);
  });

  it("refuses a session that is not this account's open or completed session", () => {
    const progress = opened();
    const plan = planOf(progress);
    const snapshot = snapshotOf(plan.sessionId, runningSession(plan));
    const deps = { now: NOW, newId: ids(), userId: "user-1" };
    expect(applyFocusSnapshot(progress, { ...snapshot, sessionId: "other" }, deps)).toBeNull();
    expect(applyFocusSnapshot(progress, snapshot, { ...deps, userId: "user-2" })).toBeNull();
    const restarted = {
      ...progress,
      sessions: progress.sessions.map((s): ProgressSession => ({ ...s, state: "restarted" })),
    };
    expect(applyFocusSnapshot(restarted, snapshot, deps)).toBeNull();
  });

  it("drops malformed lines from the browser", () => {
    const progress = opened();
    const plan = planOf(progress);
    const snapshot = snapshotOf(plan.sessionId, runningSession(plan));
    const result = applyFocusSnapshot(
      progress,
      {
        ...snapshot,
        lines: [
          ...snapshot.lines,
          { step: 9, kind: "story_card", seq: 1, text: "Out of range.", pauseNumber: null },
          { step: 0, kind: "closing", seq: 0, text: "Not here.", pauseNumber: null },
          { step: 0, kind: "story_card", seq: 2, text: "", pauseNumber: null },
          { step: 0, kind: "story_card", seq: 3, text: "x".repeat(5_000), pauseNumber: null },
        ],
      },
      { now: NOW, newId: ids(), userId: "user-1" },
    );
    expect(result!.session.lines.map((line) => line.text)).toEqual(["Background."]);
  });
});

describe("#257 AC4 and AC6 a reopened page shows the stored lines again", () => {
  it("rebuilds the session from the account when this device has none", () => {
    const progress = opened();
    const plan = planOf(progress);
    let session = runningSession(plan);
    session = tick(session, 5 * 60_000);
    session = completeStep(session, 5 * 60_000);
    const recorded = applyFocusSnapshot(progress, snapshotOf(plan.sessionId, session), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    const reopened = planOf({ ...progress, sessions: [recorded!.session] });
    expect(reopened.done).toEqual([true, false]);
    expect(reopened.cards[0]).toEqual(["Background.", "One."]);

    const seeded = seedFocusSession(reopened, 1, 10_000);
    expect(seeded.current).toBe(1);
    expect(seeded.steps[0].cards).toEqual({ opening: "Background.", story: ["One."] });
    // Step 2 has no stored card yet, so its cards are asked for; nothing is invented here.
    expect(seeded.steps[1].cards).toBeNull();
  });

  it("the current Step's stored cards are shown again, never regenerated", () => {
    const progress = opened();
    const plan = planOf(progress);
    const session = tick(runningSession(plan), 5 * 60_000);
    const recorded = applyFocusSnapshot(progress, snapshotOf(plan.sessionId, session), {
      now: NOW,
      newId: ids(),
      userId: "user-1",
    });
    const reopened = planOf({ ...progress, sessions: [recorded!.session] });
    const seeded = seedFocusSession(reopened, 1, 10_000);
    expect(visibleCards(seeded, 0, 10_000)).toEqual(["Background.", "One."]);
    // AC6: the clock starts again from the Step's full time on another device.
    expect(seeded.steps[0].clock).not.toBeNull();
  });

  it("each account session has its own browser key", () => {
    expect(accountSessionKey("abc")).toBe("waveparticle.session.abc");
    expect(accountSessionKey("abc")).not.toBe("waveparticle.prototype.session");
  });
});

describe("#257 AC5 the signed-in pages never show test data", () => {
  it("every line fails without the model instead of using stored text", async () => {
    await expect(
      accountStepCards(
        { storyId: "site-search", index: 0, planMinutes: [10], earlierCards: [] },
        null,
      ),
    ).resolves.toEqual({ status: "failed" });
    await expect(accountReturnLine({ trigger: "rest", awayMinutes: 3 }, null)).resolves.toEqual({
      status: "failed",
    });
    await expect(
      accountPauseMessage({ pauseNumber: 1, stepTitle: "Draft" }, null),
    ).resolves.toEqual({ status: "failed" });
    await expect(
      accountRestReply({ message: "Hello", history: [], replyIndex: 0 }, null),
    ).resolves.toEqual({ status: "failed" });
  });

  it("a malformed card request fails", async () => {
    await expect(accountStepCards({ index: 3, planMinutes: [10] }, null)).resolves.toEqual({
      status: "failed",
    });
  });
});

describe("#257 AC1 the signed-in pages", () => {
  it("/focus and /rest exist in every environment, like /goal (#278)", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).not.toContain("accountSessionPathIsHidden");
    for (const file of ["src/app/focus/page.tsx", "src/app/rest/page.tsx"]) {
      expect(read(file), file).not.toContain("isPrototypeEnabled");
      expect(read(file), file).toContain('redirect("/auth/sign-in")');
    }
  });

  it("use the Oppenheimer skin as session pages", () => {
    expect(isSessionPath("/focus")).toBe(true);
    expect(isSessionPath("/rest")).toBe(true);
  });

  it("Start on /goal opens /focus for the saved Goal", () => {
    expect(read("src/app/goal/page.tsx")).toContain('focusPath="/focus"');
  });

  it("#257 AC2 /try and the signed-in pages render the same screens", () => {
    for (const file of ["src/app/try/focus/focus-screen.tsx", "src/app/focus/account-focus.tsx"]) {
      expect(read(file), file).toContain("<FocusBody");
    }
    for (const file of ["src/app/try/rest/rest-screen.tsx", "src/app/rest/account-rest.tsx"]) {
      expect(read(file), file).toContain("<RestBody");
    }
  });
});
