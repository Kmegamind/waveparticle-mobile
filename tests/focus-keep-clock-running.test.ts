import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  leaveSession,
  loadSession,
  remainingFor,
  returnOnOpen,
  saveSession,
  setStepCards,
  syncSession,
  visibleCards,
  type FocusSession,
} from "@/lib/prototype/session";

// US-FOC-11 (#71): the Signals setting "Keep the clock running when I leave" (F2, T10, FLOW 3.1).

const MIN = 60_000;

const plan = {
  goal: { text: "Write the report", minutes: 15 },
  steps: [{ title: "Outline", description: "", minutes: 15 }],
};

/** Step 1 (15 minutes, three story cards at 5, 10 and 15 foreground minutes) started at t = 0. */
function started(): FocusSession {
  return setStepCards(
    syncSession(null, plan, 1),
    0,
    { opening: "opening", story: ["story 1", "story 2", "story 3"] },
    0,
  );
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("#71 AC1 with the setting off (the default) leaving freezes the clock", () => {
  it("test_us_foc_11_ac1_off_freezes_the_clock_and_resumes_from_the_frozen_value", () => {
    const away = leaveSession(started(), 1 * MIN, false);
    expect(remainingFor(away, 0, 3 * MIN)).toBe(14 * 60);
    const back = returnOnOpen(away, 3 * MIN);
    expect(back.returnPending).toBeNull();
    expect(remainingFor(back, 0, 4 * MIN)).toBe(13 * 60);
  });

  it("test_us_foc_11_ac1_off_opens_the_return_pop_up_after_5_minutes_away", () => {
    const away = leaveSession(started(), 1 * MIN, false);
    expect(returnOnOpen(away, 6 * MIN).returnPending).toBe("absence");
  });
});

describe("#71 AC2 with the setting on the clock keeps running from timestamps", () => {
  it("test_us_foc_11_ac2_on_counts_the_time_away_on_the_clock", () => {
    const away = leaveSession(started(), 1 * MIN, true);
    expect(remainingFor(away, 0, 4 * MIN)).toBe(11 * 60);
    const back = returnOnOpen(away, 4 * MIN);
    expect(remainingFor(back, 0, 4 * MIN)).toBe(11 * 60);
  });

  it("test_us_foc_11_ac2_on_opens_no_return_pop_up_however_long_the_absence", () => {
    const back = returnOnOpen(leaveSession(started(), 1 * MIN, true), 40 * MIN);
    expect(back.returnPending).toBeNull();
    expect(back.paused).toBe(false);
  });

  it("test_us_foc_11_ac2_on_never_shows_a_negative_value_or_a_count_up", () => {
    const back = returnOnOpen(leaveSession(started(), 1 * MIN, true), 60 * MIN);
    expect(remainingFor(back, 0, 60 * MIN)).toBe(0);
    expect(remainingFor(back, 0, 90 * MIN)).toBe(0);
  });

  it("test_us_foc_11_ac2_on_cards_count_foreground_time_only", () => {
    // Away from 1 to 10 minutes: 1 foreground minute so far, so no story card yet.
    const away = leaveSession(started(), 1 * MIN, true);
    expect(visibleCards(away, 0, 10 * MIN)).toEqual(["opening"]);
    const back = returnOnOpen(away, 10 * MIN);
    expect(visibleCards(back, 0, 10 * MIN)).toEqual(["opening"]);
    // 5 foreground minutes at 14 minutes, 10 at 19 minutes.
    expect(visibleCards(back, 0, 14 * MIN - 1_000)).toEqual(["opening"]);
    expect(visibleCards(back, 0, 14 * MIN)).toEqual(["opening", "story 1"]);
    expect(visibleCards(back, 0, 19 * MIN)).toHaveLength(3);
  });

  it("test_us_foc_11_ac2_on_cards_keep_their_pace_after_the_clock_reached_00_00_away", () => {
    // Away from 2 to 30 minutes: the clock shows 00:00, the cards have seen 2 minutes.
    const back = returnOnOpen(leaveSession(started(), 2 * MIN, true), 30 * MIN);
    expect(remainingFor(back, 0, 30 * MIN)).toBe(0);
    expect(visibleCards(back, 0, 33 * MIN)).toEqual(["opening", "story 1"]);
    expect(visibleCards(back, 0, 43 * MIN)).toHaveLength(4);
  });

  it("test_us_foc_11_ac2_on_a_second_leave_signal_does_not_restart_the_absence", () => {
    // visibilitychange and pagehide both fire when the page is closed.
    const away = leaveSession(leaveSession(started(), 1 * MIN, true), 3 * MIN, true);
    const back = returnOnOpen(away, 10 * MIN);
    expect(visibleCards(back, 0, 14 * MIN)).toEqual(["opening", "story 1"]);
  });

  it("test_us_foc_11_ac2_on_the_absence_survives_a_reload", () => {
    const storage = memoryStorage();
    saveSession(storage, leaveSession(started(), 1 * MIN, true), "key");
    const back = returnOnOpen(loadSession(storage, "key")!, 10 * MIN);
    expect(back.returnPending).toBeNull();
    expect(remainingFor(back, 0, 10 * MIN)).toBe(5 * 60);
    expect(visibleCards(back, 0, 14 * MIN)).toEqual(["opening", "story 1"]);
  });
});

describe("#71 AC3 a change of the setting applies the next time I leave", () => {
  it("test_us_foc_11_ac3_each_leave_uses_the_setting_of_that_moment", () => {
    const first = returnOnOpen(leaveSession(started(), 1 * MIN, false), 3 * MIN);
    expect(remainingFor(first, 0, 3 * MIN)).toBe(14 * 60);
    const second = returnOnOpen(leaveSession(first, 3 * MIN, true), 6 * MIN);
    expect(remainingFor(second, 0, 6 * MIN)).toBe(11 * 60);
    expect(second.returnPending).toBeNull();
  });

  it("test_us_foc_11_ac3_the_focus_page_reads_the_saved_setting_on_each_load", () => {
    const page = readFileSync("src/app/focus/page.tsx", "utf8");
    expect(page).toMatch(/readProfile\(/);
    expect(page).toMatch(/keepClockRunning=\{/);
    const account = readFileSync("src/app/focus/account-focus.tsx", "utf8");
    expect(account).toMatch(/keepClockRunning,?\n/);
    const body = readFileSync("src/app/_session/focus-body.tsx", "utf8");
    expect(body).toMatch(
      /leaveSession\([^)]*host\.keepClockRunning|leaveSession\([^)]*keepClockRunning/,
    );
    expect(body).not.toMatch(/visibilityState === "hidden"\s*\?\s*pauseSession/);
  });
});
