import { describe, expect, it } from "vitest";
import { seededRunTime } from "../e2e/support/stub-ai-runs.mjs";
import { runState, todayCounts } from "@/lib/ai-runs/log";
import { todayWindow } from "@/lib/ai-runs/spend";

// #528: the Runs page counts "today" as the UTC day, so the e2e stub's seeded runs must fall on it
// whatever the clock, in the same order, and the run that never ended must read "End not recorded".

const OFFSETS = [2, 4, 6, 30];
const clocks = [
  "2026-11-27T00:00:00.000Z",
  "2026-11-27T00:00:01.000Z",
  "2026-11-27T00:03:01.000Z",
  "2026-11-27T00:11:00.000Z",
  "2026-11-27T00:29:59.999Z",
  "2026-11-27T00:30:00.000Z",
  "2026-11-27T12:00:00.000Z",
  "2026-11-27T23:59:59.999Z",
];

describe("seeded runs land on the page's UTC today (#528)", () => {
  it.each(clocks)("at %s all four seeded runs are today and newest first", (iso) => {
    const now = new Date(iso);
    const times = OFFSETS.map((m) => seededRunTime(m, now.getTime()) as string);
    const window = todayWindow(now);
    for (const t of times) {
      expect(Date.parse(t)).toBeGreaterThanOrEqual(Date.parse(window.from));
      expect(Date.parse(t)).toBeLessThan(Date.parse(window.to));
      expect(Date.parse(t)).toBeLessThanOrEqual(now.getTime());
    }
    expect(times).toEqual([...times].sort().reverse());
    const rows = times.map((run_at) => ({ run_at, stub: true }));
    expect(todayCounts(rows, now)).toEqual({ runs: 4, stub: 4, real: 0 });
  });

  it.each(clocks.slice(2))("at %s the unfinished run reads End not recorded", (iso) => {
    const now = new Date(iso);
    const run_at = seededRunTime(30, now.getTime()) as string;
    expect(runState({ status: "running", run_at }, now)).toBe("not-recorded");
  });

  it("keeps the old spacing when the day is at least 30 minutes old", () => {
    const now = Date.parse("2026-11-27T12:00:00.000Z");
    expect(seededRunTime(30, now)).toBe("2026-11-27T11:30:00.000Z");
    expect(seededRunTime(2, now)).toBe("2026-11-27T11:58:00.000Z");
  });
});
