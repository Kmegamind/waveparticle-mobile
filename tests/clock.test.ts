import { describe, expect, it } from "vitest";
import { formatClock } from "@/lib/clock";

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
