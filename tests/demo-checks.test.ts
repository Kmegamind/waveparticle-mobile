import { describe, expect, it } from "vitest";
import { checkCard, checkChatReply, nextAttemptNeeded } from "../scripts/demo-checks.mjs";

const ctx = { forbidden: ["Manhattan Project"], banned: ["mesa"], seen: [] as string[] };

describe("checkCard", () => {
  it("accepts a plain first-person card", () => {
    expect(checkCard("The canyon floor is a thin snake of ground.", ctx).ok).toBe(true);
  });
  it("rejects questions, addressing the reader and missing full stop", () => {
    expect(checkCard("Is the canyon wide enough?", ctx).ok).toBe(false);
    expect(checkCard("You would not believe the wind.", ctx).ok).toBe(false);
    expect(checkCard("The wind is rising", ctx).ok).toBe(false);
  });
  it("rejects dashes, durations and clock times", () => {
    expect(checkCard("The wind is rising — slowly.", ctx).ok).toBe(false);
    expect(checkCard("We argued for 15 minutes.", ctx).ok).toBe(false);
    expect(checkCard("It was 4 pm and cold.", ctx).ok).toBe(false);
  });
  it("rejects forbidden and not-yet-known terms", () => {
    expect(checkCard("The Manhattan Project waits.", ctx).ok).toBe(false);
    expect(checkCard("I think of the Mesa.", ctx).ok).toBe(false);
  });
  it("rejects a repeated three-word opener inside one set", () => {
    const seen = ["The ground is thin."];
    expect(checkCard("The ground is wet.", { ...ctx, seen }).ok).toBe(false);
  });
});

describe("repeated phrases and narration", () => {
  it("rejects a four-word phrase already used in the set", () => {
    const seen = ["I measured a thin snake of ground."];
    expect(checkCard("The thin snake of ground is all there is.", { ...ctx, seen }).ok).toBe(false);
  });
  it("rejects narrating his own thinking", () => {
    expect(checkCard("I am mulling the width of the floor.", ctx).ok).toBe(false);
  });
});

describe("checkChatReply", () => {
  const base = { ...ctx, userTerm: "" };
  it("accepts a short in-world reply with a valid scope", () => {
    const r = checkChatReply({ scope: "his_world", reply: "A thin snake of flat ground." }, base);
    expect(r.ok).toBe(true);
  });
  it("rejects advice, character-breaking words and an unknown scope", () => {
    expect(checkChatReply({ scope: "task", reply: "You should start early." }, base).ok).toBe(
      false,
    );
    expect(checkChatReply({ scope: "meta", reply: "As an AI I cannot say." }, base).ok).toBe(false);
    expect(checkChatReply({ scope: "weather", reply: "Cold." }, base).ok).toBe(false);
  });
  it("does not echo a term it could not know", () => {
    const r = checkChatReply(
      { scope: "knowledge", reply: "DiD is beyond me." },
      { ...base, userTerm: "DiD" },
    );
    expect(r.ok).toBe(false);
  });
});

describe("nextAttemptNeeded", () => {
  it("retries while attempts remain and a check failed", () => {
    expect(nextAttemptNeeded({ ok: false }, 1)).toBe(true);
    expect(nextAttemptNeeded({ ok: false }, 3)).toBe(false);
    expect(nextAttemptNeeded({ ok: true }, 1)).toBe(false);
  });
});
