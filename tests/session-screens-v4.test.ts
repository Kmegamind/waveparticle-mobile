import { describe, expect, it } from "vitest";
import { cardLabel } from "@/app/_session/card-label";

describe("#238 AC3 the label inside his card (prototype v4)", () => {
  it("names the first card of Step 1 Where I am", () => {
    expect(cardLabel(0, 0, 1)).toBe("Where I am");
    expect(cardLabel(0, 0, 3)).toBe("Where I am");
  });

  it("names the newest card Right now", () => {
    expect(cardLabel(0, 2, 3)).toBe("Right now");
    expect(cardLabel(1, 0, 1)).toBe("Right now");
  });

  it("names the older cards How I got here", () => {
    expect(cardLabel(0, 1, 3)).toBe("How I got here");
    expect(cardLabel(2, 0, 2)).toBe("How I got here");
  });
});
