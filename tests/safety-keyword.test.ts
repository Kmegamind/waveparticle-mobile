import { describe, expect, it } from "vitest";
import { checkSafetyText } from "../src/lib/safety/keyword";

describe("checkSafetyText", () => {
  it("flags clear self-harm intent as crisis without returning the input", () => {
    const result = checkSafetyText("I want to kill myself tonight");

    expect(result).toEqual({ tier: "crisis", flagged: true });
    expect(result).not.toHaveProperty("text");
  });

  it("flags clear harm-to-others intent as crisis", () => {
    expect(checkSafetyText("I am going to hurt him")).toEqual({
      tier: "crisis",
      flagged: true,
    });
  });

  it("does not flag a standalone negated harm statement", () => {
    expect(checkSafetyText("I would never hurt myself")).toEqual({
      tier: "none",
      flagged: false,
    });
  });

  it("flags hopelessness without intent as low mood", () => {
    expect(checkSafetyText("I feel worthless and cannot cope")).toEqual({
      tier: "low_mood",
      flagged: true,
    });
  });

  it("does not flag ordinary pressure or figurative language", () => {
    expect(checkSafetyText("This deadline is killing me")).toEqual({
      tier: "none",
      flagged: false,
    });
  });

  it("normalizes case, punctuation, and repeated whitespace", () => {
    expect(checkSafetyText("I   WANT TO END IT!!!")).toEqual({
      tier: "crisis",
      flagged: true,
    });
  });

  it("recognizes indirect current-danger phrasing", () => {
    expect(checkSafetyText("I do not want to be here anymore")).toEqual({
      tier: "crisis",
      flagged: true,
    });
  });
});
