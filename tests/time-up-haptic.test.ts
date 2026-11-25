import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, PREFS_KEY } from "@/lib/me/prefs";
import { timeUpHaptic } from "@/lib/me/time-up-haptic";
import {
  backFromRest,
  loadSession,
  markTimeUp,
  remainingFor,
  saveSession,
  setStepCards,
  startFromReturn,
  startRest,
  syncSession,
  timeUpDue,
  type FocusSession,
} from "@/lib/prototype/session";

// #115 (US-PLAT-3): one light haptic at 00:00 where the device supports it, and only while the
// time-up signal is on.

function storageWith(value: unknown): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: (key) => (key === PREFS_KEY ? JSON.stringify(value) : null),
    setItem: () => {},
  };
}

describe("#115 time-up haptic", () => {
  it("AC1 vibrates once, lightly, when the signal is on (the default) and the device supports it", () => {
    const vibrate = vi.fn(() => true);
    expect(timeUpHaptic({ vibrate }, null)).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("AC1 reads the stored setting when it is on", () => {
    const vibrate = vi.fn(() => true);
    expect(timeUpHaptic({ vibrate }, storageWith(DEFAULT_PREFS))).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("AC2 does nothing and does not throw when the device has no haptics", () => {
    expect(timeUpHaptic({}, null)).toBe(false);
    expect(timeUpHaptic(undefined, null)).toBe(false);
  });

  it("AC2 swallows an error from the browser", () => {
    const vibrate = vi.fn(() => {
      throw new Error("blocked");
    });
    let result: boolean | undefined;
    expect(() => {
      result = timeUpHaptic({ vibrate }, null);
    }).not.toThrow();
    expect(result).toBe(false);
  });

  it("AC3 never vibrates when the time-up signal is off", () => {
    const vibrate = vi.fn(() => true);
    const off = { ...DEFAULT_PREFS, signals: { ...DEFAULT_PREFS.signals, timeUp: false } };
    expect(timeUpHaptic({ vibrate }, storageWith(off))).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe("#115 the time-up signal is given once per Step", () => {
  const plan = {
    goal: { text: "Write the report", minutes: 15 },
    steps: [{ title: "Outline", description: "", minutes: 15 }],
  };
  const cards = { opening: "opening", story: ["story 1", "story 2"] };
  const atZero = 15 * 60_000 + 1_000;

  /** What the focus page does on each render: signal when due, then record it in the session. */
  function render(session: FocusSession, nowMs: number, fired: { count: number }) {
    if (!timeUpDue(session, 0, nowMs)) return session;
    fired.count += 1;
    return markTimeUp(session, 0);
  }

  it("fires exactly once across re-renders, a Pause and return, and a reload", () => {
    const fired = { count: 0 };
    let session = setStepCards(syncSession(null, plan, 1), 0, cards, 0);

    session = render(session, 60_000, fired);
    expect(fired.count).toBe(0);

    session = render(session, atZero, fired);
    session = render(session, atZero + 500, fired);
    session = render(session, atZero + 1_000, fired);
    expect(fired.count).toBe(1);

    // Pause at 00:00, back from rest, Start in the return pop-up: the clock is still at 00:00.
    session = startRest(session, atZero + 2_000);
    session = backFromRest(session);
    session = startFromReturn(session, atZero + 60_000);
    expect(remainingFor(session, 0, atZero + 61_000)).toBe(0);
    session = render(session, atZero + 61_000, fired);
    expect(fired.count).toBe(1);

    // A reload reads the stored session back.
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    saveSession(storage, session);
    session = render(loadSession(storage)!, atZero + 120_000, fired);
    expect(fired.count).toBe(1);
  });

  it("is not due before the clock has started", () => {
    expect(timeUpDue(syncSession(null, plan, 1), 0, atZero)).toBe(false);
  });
});
