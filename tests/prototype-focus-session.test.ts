import { describe, expect, it } from "vitest";
import {
  HOLD_MS,
  SESSION_KEY,
  UNDO_MS,
  canUndo,
  completeStep,
  isHolding,
  loadSession,
  maxStoryCards,
  pauseSession,
  planKey,
  remainingFor,
  resumeSession,
  saveSession,
  setStepCards,
  syncSession,
  tick,
  undoDone,
  visibleCards,
  type FocusSession,
} from "@/lib/prototype/session";

const plan = {
  goal: { text: "Write the report", minutes: 45 },
  steps: [
    { title: "Outline", description: "List the sections.", minutes: 15 },
    { title: "Draft", description: "", minutes: 20 },
    { title: "Check", description: "Read it once.", minutes: 10 },
  ],
};

const cards = (step: number, story = 3) => ({
  opening: `opening ${step}`,
  story: Array.from({ length: story }, (_, i) => `story ${step}.${i + 1}`),
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

/** A session whose Step 1 cards arrived at t = 0, so the Step 1 clock starts at 0. */
function started(speed = 1): FocusSession {
  const fresh = syncSession(null, plan, speed);
  return setStepCards(fresh, 0, cards(1), 0);
}

describe("#24 AC1 and AC4 the clock counts down the Step's minutes from timestamps", () => {
  it("starts at the full target before the cards arrive and does not run", () => {
    const fresh = syncSession(null, plan, 1);
    expect(remainingFor(fresh, 0, 0)).toBe(15 * 60);
    expect(remainingFor(fresh, 0, 600_000)).toBe(15 * 60);
  });

  it("counts down from the moment the Step's cards are ready", () => {
    const session = started();
    expect(remainingFor(session, 0, 60_000)).toBe(14 * 60);
  });

  it("uses the test speed-up: at speed 60 one minute lasts one second", () => {
    const session = started(60);
    expect(remainingFor(session, 0, 0)).toBe(15);
    expect(remainingFor(session, 0, 5_000)).toBe(10);
  });
});

describe("#24 AC2 and AC3 the clock stays at 00:00 and only Done ends the Step", () => {
  it("never goes below 00:00 and never counts up", () => {
    const session = started();
    expect(remainingFor(session, 0, 15 * 60_000)).toBe(0);
    expect(remainingFor(session, 0, 60 * 60_000)).toBe(0);
  });

  it("keeps the same Step current at 00:00 until Done", () => {
    const session = tick(started(), 60 * 60_000);
    expect(session.current).toBe(0);
    expect(completeStep(session, 60 * 60_000).current).toBe(1);
  });
});

describe("#24 leaving freezes the clock (foreground time only)", () => {
  it("does not count the time while paused or away, and resumes from the frozen value", () => {
    const away = pauseSession(started(), 60_000);
    expect(remainingFor(away, 0, 600_000)).toBe(14 * 60);
    const back = resumeSession(away, 600_000);
    expect(remainingFor(back, 0, 660_000)).toBe(13 * 60);
  });

  it("delivers no card while the clock is frozen", () => {
    const away = pauseSession(started(), 1_000);
    expect(visibleCards(away, 0, 60 * 60_000)).toEqual(["opening 1"]);
  });
});

describe("#15 AC1 to AC3 how many cards a Step has and when they arrive", () => {
  it("allows 1 to 5 story cards with at least 5 minutes between them", () => {
    expect(maxStoryCards(1)).toBe(1);
    expect(maxStoryCards(4)).toBe(1);
    expect(maxStoryCards(10)).toBe(2);
    expect(maxStoryCards(15)).toBe(3);
    expect(maxStoryCards(60)).toBe(5);
  });

  it("ignores extra cards beyond the limit for the Step's minutes", () => {
    const fresh = syncSession(null, plan, 1);
    const session = setStepCards(fresh, 2, cards(3, 5), 0);
    expect(session.steps[2].cards?.story).toEqual(["story 3.1", "story 3.2"]);
  });

  it("delivers n cards at y/n, 2y/n ... y minutes, the last one at 00:00", () => {
    const session = started();
    expect(visibleCards(session, 0, 4 * 60_000 + 59_000)).toEqual(["opening 1"]);
    expect(visibleCards(session, 0, 5 * 60_000)).toEqual(["opening 1", "story 1.1"]);
    expect(visibleCards(session, 0, 10 * 60_000)).toHaveLength(3);
    expect(visibleCards(session, 0, 15 * 60_000 - 1_000)).toHaveLength(3);
    expect(visibleCards(session, 0, 15 * 60_000)).toHaveLength(4);
  });
});

describe("#12 AC1 and AC2 a Step opens with exactly one card and has its own stack", () => {
  it("shows only the opening card when the Step starts", () => {
    expect(visibleCards(started(), 0, 0)).toEqual(["opening 1"]);
  });

  it("starts the next Step's stack again with its one opening card", () => {
    let session = setStepCards(started(), 1, cards(2), 1_000);
    session = completeStep(tick(session, 15 * 60_000), 15 * 60_000);
    expect(visibleCards(session, 1, 15 * 60_000)).toEqual(["opening 2"]);
  });
});

describe("#12 AC4 a shown card never changes", () => {
  it("keeps the first cards stored for a Step and ignores later ones", () => {
    const session = setStepCards(started(), 0, cards(9), 5_000);
    expect(session.steps[0].cards?.opening).toBe("opening 1");
  });

  it("keeps cards already shown after Undo even though their time has not come again", () => {
    let session = setStepCards(started(), 1, cards(2), 0);
    session = completeStep(session, 1_000);
    session = tick(session, 1_000 + HOLD_MS + 7 * 60_000);
    expect(visibleCards(session, 1, 1_000 + HOLD_MS + 7 * 60_000)).toHaveLength(2);
    session = undoDone(session, 1_000 + HOLD_MS + 7 * 60_000);
    expect(session.steps[1].shownStory).toBe(1);
  });
});

describe("#26 AC1 and AC2 Done opens the next Step after a 1.2 second hold", () => {
  it("moves to the next Step, shows its full target and holds it for 1.2 seconds", () => {
    const ready = setStepCards(started(), 1, cards(2), 0);
    const done = completeStep(ready, 120_000);
    expect(done.current).toBe(1);
    expect(isHolding(done, 120_000)).toBe(true);
    expect(isHolding(done, 120_000 + HOLD_MS - 1)).toBe(true);
    expect(isHolding(done, 120_000 + HOLD_MS)).toBe(false);
    expect(remainingFor(done, 1, 120_000 + HOLD_MS)).toBe(20 * 60);
    expect(remainingFor(done, 1, 120_000 + HOLD_MS + 60_000)).toBe(19 * 60);
  });

  it("ignores a second Done during the hold so a double tap cannot skip a Step", () => {
    const ready = setStepCards(started(), 1, cards(2), 0);
    const done = completeStep(ready, 120_000);
    expect(completeStep(done, 120_500)).toBe(done);
  });

  it("does not start the next Step's clock until its cards are ready", () => {
    const done = completeStep(started(), 120_000);
    expect(remainingFor(done, 1, 300_000)).toBe(20 * 60);
    const later = setStepCards(done, 1, cards(2), 300_000);
    expect(remainingFor(later, 1, 360_000)).toBe(19 * 60);
  });
});

describe("#26 AC3 Done on the last Step finishes the Goal", () => {
  it("marks every Step done and offers Undo", () => {
    let session = setStepCards(started(), 1, cards(2), 0);
    session = setStepCards(session, 2, cards(3), 0);
    session = completeStep(session, 10_000);
    session = completeStep(session, 20_000);
    session = completeStep(session, 30_000);
    expect(session.current).toBe(3);
    expect(canUndo(session, 30_000)).toBe(true);
  });
});

describe("#27 AC1 and AC2 every Done can be undone", () => {
  it("offers Undo for the stated time only", () => {
    const done = completeStep(started(), 120_000);
    expect(canUndo(done, 120_000 + UNDO_MS - 1)).toBe(true);
    expect(canUndo(done, 120_000 + UNDO_MS)).toBe(false);
    expect(undoDone(done, 120_000 + UNDO_MS)).toEqual(done);
  });

  it("returns to the previous Step at the value it had at Done, after the hold", () => {
    const ready = setStepCards(started(), 1, cards(2), 0);
    const done = completeStep(ready, 120_000);
    const undone = undoDone(done, 125_000);
    expect(undone.current).toBe(0);
    expect(remainingFor(undone, 0, 125_000 + HOLD_MS)).toBe(13 * 60);
    expect(remainingFor(undone, 0, 125_000 + HOLD_MS + 60_000)).toBe(12 * 60);
    expect(isHolding(undone, 125_000)).toBe(true);
    expect(canUndo(undone, 125_000)).toBe(false);
  });

  it("brings back the previous Step's own cards", () => {
    const ready = tick(setStepCards(started(), 1, cards(2), 0), 6 * 60_000);
    const undone = undoDone(completeStep(ready, 6 * 60_000), 6 * 60_000 + 1_000);
    expect(visibleCards(undone, 0, 6 * 60_000 + 1_000)).toEqual(["opening 1", "story 1.1"]);
  });

  it("undoes the last Done from the end", () => {
    let session = setStepCards(started(), 1, cards(2), 0);
    session = setStepCards(session, 2, cards(3), 0);
    session = completeStep(completeStep(session, 10_000), 20_000);
    session = completeStep(session, 30_000);
    expect(undoDone(session, 31_000).current).toBe(2);
  });
});

describe("#12 the session survives a reload", () => {
  it("saves and restores the session from its own storage key", () => {
    const storage = memoryStorage();
    const session = started();
    saveSession(storage, session);
    expect(storage.data.has(SESSION_KEY)).toBe(true);
    expect(SESSION_KEY).not.toBe("waveparticle.prototype");
    expect(loadSession(storage)).toEqual(session);
  });

  it("keeps the stored session for the same plan and speed", () => {
    const session = started();
    expect(syncSession(session, plan, 1)).toBe(session);
  });

  it("starts a new session when the plan or the speed changes", () => {
    const session = started();
    const other = { ...plan, steps: plan.steps.slice(0, 2) };
    expect(syncSession(session, other, 1).planKey).toBe(planKey(other));
    expect(syncSession(session, other, 1).steps).toHaveLength(2);
    expect(syncSession(session, plan, 60).speed).toBe(60);
  });

  it("falls back to no session for broken data or blocked storage", () => {
    expect(loadSession(memoryStorage({ [SESSION_KEY]: "{oops" }))).toBeNull();
    expect(loadSession(memoryStorage({ [SESSION_KEY]: '{"version":0}' }))).toBeNull();
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(loadSession(blocked)).toBeNull();
    expect(() => saveSession(blocked, started())).not.toThrow();
  });
});
