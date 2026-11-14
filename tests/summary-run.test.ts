import { describe, expect, it } from "vitest";
import { createClock, pauseClock } from "@/lib/clock";
import {
  completeStep,
  setStepCards,
  syncSession,
  type FocusSession,
} from "@/lib/prototype/session";
import { emptyPrototypeState, type PrototypeState } from "@/lib/prototype/store";
import {
  focusLabel,
  finishedRun,
  loadSummaryRecord,
  planMinutesOf,
  saveSummaryRecord,
} from "@/lib/summary/run";

// Issue #258: the finished run the summary reads from the browser.

const plan: PrototypeState = {
  ...emptyPrototypeState(),
  goal: { text: "Write the report", minutes: 30 },
  steps: [
    { title: "Outline", description: "", minutes: 10 },
    { title: "Draft", description: "Rough pass", minutes: 20 },
  ],
  storyId: "bohr-difficulties",
};

function finished(): FocusSession {
  let session = syncSession(null, plan, 1);
  session = setStepCards(session, 0, { opening: "I open the notebook.", story: ["I write."] }, 0);
  session = completeStep(session, 700_000);
  session = setStepCards(session, 1, { opening: "I sit down again.", story: [] }, 701_300);
  return completeStep(session, 701_300 + 1_500_000);
}

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("#258 AC1 AC2 the finished run", () => {
  it("is null until every Step is done", () => {
    expect(finishedRun(plan, syncSession(null, plan, 1))).toBeNull();
    expect(finishedRun(plan, null)).toBeNull();
  });

  it("is null for a session of another Plan", () => {
    const other = { ...plan, steps: [{ title: "Other", description: "", minutes: 5 }] };
    expect(finishedRun(other, finished())).toBeNull();
  });

  it("carries the story, the Steps, the real focus time and his shown cards", () => {
    const run = finishedRun(plan, finished());
    expect(run).toEqual({
      storyId: "bohr-difficulties",
      steps: plan.steps,
      focusSeconds: [700, 1500],
      earlierLines: ["I open the notebook.", "I write.", "I sit down again."],
    });
  });

  it("reads a Plan without a story as chapter 8, as the focus page does", () => {
    const old = { ...plan, storyId: undefined };
    let session = syncSession(null, old, 1);
    session = {
      ...session,
      current: 2,
      steps: session.steps.map((step) => ({
        ...step,
        clock: pauseClock(createClock(step.targetSeconds, 0), 60_000),
      })),
    };
    expect(finishedRun(old, session)?.storyId).toBe("site-search");
  });
});

describe("#258 AC2 the record shows plan length and focus time", () => {
  it("adds the Plan's minutes", () => {
    expect(planMinutesOf(plan.steps)).toBe(30);
  });

  it("labels the focus time in whole minutes", () => {
    expect(focusLabel(10)).toBe("Under 1 min");
    expect(focusLabel(40)).toBe("1 min");
    expect(focusLabel(3600)).toBe("60 min");
  });
});

describe("#258 AC4 the summary record keeps the run id and the lines", () => {
  it("stores one record per Plan and survives broken storage", () => {
    const storage = memoryStorage();
    expect(loadSummaryRecord(storage, "key")).toBeNull();
    saveSummaryRecord(storage, "key", { runId: "id-1" });
    expect(loadSummaryRecord(storage, "key")).toEqual({ runId: "id-1" });
    expect(loadSummaryRecord(storage, "other")).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(loadSummaryRecord(broken, "key")).toBeNull();
    expect(() => saveSummaryRecord(broken, "key", { runId: "id-1" })).not.toThrow();
  });
});
