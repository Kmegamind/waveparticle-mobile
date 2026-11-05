import { describe, expect, it } from "vitest";
import {
  createClock,
  formatClock,
  holdAfterDone,
  leaveClock,
  pauseClock,
  remainingSeconds,
  resumeClock,
  returnFromLeave,
} from "@/lib/clock";

describe("formatClock", () => {
  it("formats minutes and seconds with two digits", () => {
    expect(formatClock(754)).toBe("12:34");
  });

  it("stays at 00:00 when the target time has passed", () => {
    expect(formatClock(-30)).toBe("00:00");
  });

  it("rounds fractional seconds", () => {
    expect(formatClock(59.6)).toBe("01:00");
  });
});

describe("timestamp clock", () => {
  it("uses foreground timestamps and freezes while paused", () => {
    const started = createClock(600, 1_000);
    const paused = pauseClock(started, 61_000);

    expect(remainingSeconds(started, 31_000)).toBe(570);
    expect(remainingSeconds(paused, 121_000)).toBe(540);
  });

  it("resumes from the paused position without counting the pause", () => {
    const paused = pauseClock(createClock(600, 1_000), 61_000);
    const resumed = resumeClock(paused, 121_000);

    expect(remainingSeconds(resumed, 151_000)).toBe(510);
  });

  it("holds the clock for 1.2 seconds after Done", () => {
    const clock = createClock(600, 1_000);
    const held = holdAfterDone(clock, 31_000);

    expect(remainingSeconds(held, 32_199)).toBe(570);
    expect(remainingSeconds(held, 33_200)).toBe(569);
  });

  it("freezes on leaving and resumes from the return timestamp by default", () => {
    const left = leaveClock(createClock(600, 1_000), 31_000);
    const returned = returnFromLeave(left, 91_000);

    expect(remainingSeconds(left, 61_000)).toBe(570);
    expect(remainingSeconds(returned, 121_000)).toBe(540);
  });

  it("keeps counting across leave and return when enabled", () => {
    const left = leaveClock(createClock(600, 1_000, true), 31_000);
    const returned = returnFromLeave(left, 91_000);

    expect(remainingSeconds(returned, 121_000)).toBe(480);
  });
});
