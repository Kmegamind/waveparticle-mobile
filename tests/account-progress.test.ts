import { describe, expect, it } from "vitest";
import {
  createMemoryProgressStore,
  deleteAccountProgress,
  loadAccountProgress,
  saveAccountProgress,
  screenState,
  undoStepDone,
  type AccountProgress,
} from "@/lib/progress/account-progress";

const shownAt = "2026-11-05T16:00:00.000Z";

function sample(userId: string, goalId = `${userId}-goal`): AccountProgress {
  return {
    userId,
    goals: [
      {
        id: goalId,
        title: `${userId} goal`,
        text: "Read the chapter",
        status: "in_progress",
        steps: [
          {
            id: `${goalId}-step`,
            position: 0,
            title: "Read",
            description: "Read the first section",
            minutes: 25,
          },
        ],
      },
    ],
    sessions: [
      {
        id: `${userId}-session`,
        goalId,
        companionId: "oppenheimer",
        storyId: "bohr-difficulties",
        state: "open",
        backgroundCard: "He is at the blackboard.",
        backgroundCardSource: "generated",
        mergedKeyMoments: [2],
        closingLine: null,
        steps: [
          {
            id: `${userId}-session-step`,
            stepId: `${goalId}-step`,
            position: 0,
            openedAt: shownAt,
            doneAt: shownAt,
          },
        ],
        lines: [
          {
            id: `${userId}-line`,
            sessionStepId: null,
            seq: 0,
            kind: "background",
            cardId: null,
            source: "generated",
            text: "He is at the blackboard.",
            pauseNumber: null,
            shownAt,
          },
        ],
      },
    ],
  };
}

describe("US-ACC-2 save and load account progress", () => {
  it("stops user A from reading or writing user B's rows", async () => {
    const store = createMemoryProgressStore();
    await saveAccountProgress(store, "user-a", sample("user-a"));
    await saveAccountProgress(store, "user-b", sample("user-b"));

    await expect(loadAccountProgress(store, "user-a", "user-b")).rejects.toThrow(/another account/);
    await expect(saveAccountProgress(store, "user-a", sample("user-b"))).rejects.toThrow(
      /another account/,
    );

    const own = await loadAccountProgress(store, "user-b", "user-b");
    expect(own.goals.map((goal) => goal.title)).toEqual(["user-b goal"]);
  });

  it("removes steps, sessions and lines when the account is deleted", async () => {
    const store = createMemoryProgressStore();
    await saveAccountProgress(store, "user-a", sample("user-a"));

    await deleteAccountProgress(store, "user-a", "user-a");

    const progress = await loadAccountProgress(store, "user-a", "user-a");
    expect(progress).toEqual({ userId: "user-a", goals: [], sessions: [] });
    await expect(deleteAccountProgress(store, "user-b", "user-a")).rejects.toThrow(
      /another account/,
    );
  });

  it("allows one open session for a goal", async () => {
    const store = createMemoryProgressStore();
    const progress = sample("user-a");
    progress.sessions.push({
      ...progress.sessions[0],
      id: "second-open",
      lines: [],
      steps: [],
    });

    await expect(saveAccountProgress(store, "user-a", progress)).rejects.toThrow(
      /one open session/,
    );
  });

  it("clears done_at when Done is undone and keeps the shown line unchanged", async () => {
    const store = createMemoryProgressStore();
    await saveAccountProgress(store, "user-a", sample("user-a"));
    const saved = await loadAccountProgress(store, "user-a", "user-a");
    const undone = undoStepDone(saved, "user-a-session", "user-a-session-step");
    undone.sessions[0].lines[0].text = "A different line";

    await expect(saveAccountProgress(store, "user-a", undone)).rejects.toThrow(/shown line/);

    undone.sessions[0].lines[0].text = "He is at the blackboard.";
    await saveAccountProgress(store, "user-a", undone);
    const loaded = await loadAccountProgress(store, "user-a", "user-a");
    expect(loaded.sessions[0].steps[0].doneAt).toBeNull();
    expect(loaded.sessions[0].lines[0].text).toBe("He is at the blackboard.");
  });

  it("shows the same Home, Goals and Life Path state on another device", async () => {
    const store = createMemoryProgressStore();
    const progress = sample("user-a");
    progress.sessions[0].state = "completed";
    progress.sessions[0].closingLine = "The afternoon stays with him.";
    await saveAccountProgress(store, "user-a", progress);

    const phone = screenState(await loadAccountProgress(store, "user-a", "user-a"));
    const tablet = screenState(await loadAccountProgress(store, "user-a", "user-a"));

    expect(tablet).toEqual(phone);
    expect(phone.home).toEqual(["user-a goal"]);
    expect(phone.goals).toEqual([{ title: "user-a goal", steps: ["Read"] }]);
    expect(phone.lifePath).toEqual([{ companionId: "oppenheimer", storyId: "bohr-difficulties" }]);
  });

  it("does not count a restarted session as story progress", async () => {
    const store = createMemoryProgressStore();
    const progress = sample("user-a");
    progress.sessions[0].state = "restarted";
    await saveAccountProgress(store, "user-a", progress);

    expect(screenState(await loadAccountProgress(store, "user-a", "user-a")).lifePath).toEqual([]);
  });
});
