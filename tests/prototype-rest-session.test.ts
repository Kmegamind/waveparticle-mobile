import { describe, expect, it } from "vitest";
import {
  AWAY_MS,
  addFirstRestMessage,
  addRestMessage,
  backFromRest,
  completeStep,
  leaveRest,
  loadSession,
  pauseNumberFor,
  pauseSession,
  remainingFor,
  returnOnOpen,
  saveSession,
  setRestDraft,
  setReturnLine,
  setStepCards,
  startFromReturn,
  startRest,
  syncSession,
  visibleCards,
  type FocusSession,
} from "@/lib/prototype/session";

const plan = {
  goal: { text: "Write the report", minutes: 45 },
  steps: [
    { title: "Outline", description: "", minutes: 15 },
    { title: "Draft", description: "", minutes: 20 },
  ],
};

const cards = { opening: "opening", story: ["story 1", "story 2", "story 3"] };

/** Step 1 cards arrived at t = 0, so the Step 1 clock starts at 0. */
function started(speed = 1): FocusSession {
  return setStepCards(syncSession(null, plan, speed), 0, cards, 0);
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe("#28 AC1 Pause freezes the clock and opens a rest", () => {
  it("freezes the clock at the moment of Pause and opens an empty conversation", () => {
    const rest = startRest(started(), 60_000);
    expect(rest.paused).toBe(true);
    expect(remainingFor(rest, 0, 30 * 60_000)).toBe(14 * 60);
    expect(rest.rest).toEqual({ pauseNumber: 1, messages: [], draft: "" });
  });

  it("delivers no card while resting", () => {
    const rest = startRest(started(), 1_000);
    expect(visibleCards(rest, 0, 60 * 60_000)).toEqual(["opening"]);
  });
});

describe("#28 AC3 and #29 AC1 and AC3 every Pause counts for the current Step only", () => {
  it("numbers the pauses of a Step 1, 2, 3 and never limits them or resets the clock", () => {
    let session = started();
    for (let n = 1; n <= 4; n += 1) {
      session = startRest(session, n * 60_000);
      expect(pauseNumberFor(session)).toBe(n);
      expect(session.rest?.pauseNumber).toBe(n);
      session = startFromReturn(backFromRest(session), n * 60_000);
      expect(session.paused).toBe(false);
    }
    // Four minutes ran between the pauses; no Pause reset the clock to the full 15.
    expect(remainingFor(session, 0, 4 * 60_000)).toBe(11 * 60);
  });

  it("starts the count again in the next Step", () => {
    let session = startFromReturn(backFromRest(startRest(started(), 1_000)), 1_000);
    session = completeStep(session, 2_000);
    session = startRest(session, 5_000);
    expect(pauseNumberFor(session)).toBe(1);
  });
});

describe("#66 AC1 and #67 AC1 the rest conversation is kept", () => {
  it("adds his first message, the user's messages and his replies in order", () => {
    let session = startRest(started(), 1_000);
    session = addRestMessage(session, { from: "him", text: "My map is wrong." });
    session = addRestMessage(session, { from: "you", text: "hey" });
    session = addRestMessage(session, { from: "him", text: "I am still here." });
    expect(session.rest?.messages.map((message) => message.from)).toEqual(["him", "you", "him"]);
  });

  it("has no limit on the number of messages", () => {
    let session = startRest(started(), 1_000);
    for (let i = 0; i < 100; i += 1) {
      session = addRestMessage(session, { from: i % 2 ? "him" : "you", text: `line ${i}` });
    }
    expect(session.rest?.messages).toHaveLength(100);
  });

  it("keeps an unsent draft and restores the conversation from storage", () => {
    const storage = memoryStorage();
    let session = addRestMessage(startRest(started(), 1_000), { from: "him", text: "first" });
    session = setRestDraft(session, "half a thought");
    saveSession(storage, session);
    const loaded = loadSession(storage);
    expect(loaded?.rest).toEqual({
      pauseNumber: 1,
      messages: [{ from: "him", text: "first" }],
      draft: "half a thought",
    });
  });

  it("puts his first message first even when the user wrote before it arrived", () => {
    let session = startRest(started(), 1_000);
    session = addRestMessage(session, { from: "you", text: "hello" });
    session = addRestMessage(session, { from: "him", text: "a reply that came first" });
    session = addFirstRestMessage(session, "My map is wrong.");
    session = addFirstRestMessage(session, "a second first message");
    expect(session.rest?.messages).toEqual([
      { from: "him", text: "My map is wrong." },
      { from: "you", text: "hello" },
      { from: "him", text: "a reply that came first" },
    ]);
  });

  it("does nothing to a session that is not resting", () => {
    const session = started();
    expect(addRestMessage(session, { from: "you", text: "x" })).toBe(session);
    expect(setRestDraft(session, "x")).toBe(session);
  });
});

describe("#68 AC1 and AC2 Back to step brings the return pop-up, Start continues the clock", () => {
  it("ends the rest, keeps the clock frozen and asks for the rest pop-up", () => {
    const back = backFromRest(startRest(started(), 60_000));
    expect(back.rest).toBeNull();
    expect(back.paused).toBe(true);
    expect(back.returnPending).toBe("rest");
    expect(remainingFor(back, 0, 90 * 60_000)).toBe(14 * 60);
  });

  it("keeps the pop-up when the focus page opens, however soon", () => {
    const back = backFromRest(startRest(started(), 60_000));
    expect(returnOnOpen(back, 61_000).returnPending).toBe("rest");
    expect(returnOnOpen(back, 61_000).paused).toBe(true);
  });

  it("Start closes the pop-up and the clock continues from where it stopped", () => {
    const back = setReturnLine(backFromRest(startRest(started(), 60_000)), "I walked the line.");
    const running = startFromReturn(back, 600_000);
    expect(running.returnPending).toBeNull();
    expect(running.returnLine).toBeNull();
    expect(running.paused).toBe(false);
    expect(remainingFor(running, 0, 660_000)).toBe(13 * 60);
  });

  it("treats arriving on the focus page from an open rest as Back to step", () => {
    const opened = returnOnOpen(startRest(started(), 60_000), 70_000);
    expect(opened.rest).toBeNull();
    expect(opened.returnPending).toBe("rest");
  });
});

describe("#57 AC3 the return line is stored once and never regenerated", () => {
  it("keeps the first line it is given", () => {
    let back = backFromRest(startRest(started(), 60_000));
    back = setReturnLine(back, "first line");
    back = setReturnLine(back, "second line");
    expect(back.returnLine).toBe("first line");
    expect(returnOnOpen(back, 120_000).returnLine).toBe("first line");
  });
});

describe("#19 AC2 and AC3 and #69 AC2 the absence rule", () => {
  it("resumes with no pop-up after less than 5 minutes away", () => {
    const away = pauseSession(started(), 60_000);
    const back = returnOnOpen(away, 60_000 + AWAY_MS - 1);
    expect(back.paused).toBe(false);
    expect(back.returnPending).toBeNull();
  });

  it("asks for the absence pop-up after 5 minutes or more and keeps the clock frozen", () => {
    const away = pauseSession(started(), 60_000);
    const back = returnOnOpen(away, 60_000 + AWAY_MS);
    expect(back.paused).toBe(true);
    expect(back.returnPending).toBe("absence");
    expect(remainingFor(back, 0, 60_000 + AWAY_MS * 3)).toBe(14 * 60);
  });

  it("uses the test speed-up for the 5 minutes", () => {
    const away = pauseSession(started(60), 1_000);
    expect(returnOnOpen(away, 1_000 + AWAY_MS / 60).returnPending).toBe("absence");
  });

  it("#19 AC4 and #69 AC6 works the same after any length of absence and loses nothing", () => {
    const away = pauseSession(started(), 60_000);
    const back = startFromReturn(returnOnOpen(away, 60_000 + 30 * 24 * 3_600_000), 1e12);
    expect(back.current).toBe(0);
    expect(remainingFor(back, 0, 1e12)).toBe(14 * 60);
  });

  it("counts from the first freeze, not from a later hidden page", () => {
    const away = pauseSession(started(), 60_000);
    const again = pauseSession(away, 60_000 + AWAY_MS - 10);
    expect(again.pausedAtMs).toBe(60_000);
  });

  it("leaves a running or finished session alone", () => {
    const running = started();
    expect(returnOnOpen(running, AWAY_MS * 10)).toBe(running);
  });
});

describe("Home from the rest page keeps the Step paused (#66 AC4)", () => {
  it("ends the rest without a pop-up; the absence rule decides on return", () => {
    const left = leaveRest(startRest(started(), 60_000));
    expect(left.rest).toBeNull();
    expect(left.paused).toBe(true);
    expect(left.returnPending).toBeNull();
    expect(returnOnOpen(left, 61_000).paused).toBe(false);
    expect(returnOnOpen(left, 60_000 + AWAY_MS).returnPending).toBe("absence");
  });
});

describe("stored sessions from before the rest page", () => {
  it("loads a version 1 session without the new fields", () => {
    const storage = memoryStorage();
    const old = { ...started() } as Partial<FocusSession>;
    delete old.rest;
    delete old.returnPending;
    delete old.returnLine;
    delete old.pausedAtMs;
    delete old.pauses;
    storage.setItem("waveparticle.prototype.session", JSON.stringify(old));
    const loaded = loadSession(storage);
    expect(loaded?.rest).toBeNull();
    expect(loaded?.returnPending).toBeNull();
    expect(loaded?.pauses).toEqual([0, 0]);
  });
});
