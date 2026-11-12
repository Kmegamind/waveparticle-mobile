import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@/lib/model-gateway";
import {
  MAX_MESSAGE_CHARS,
  pauseMessageFor,
  restReplyFor,
  returnLineFor,
  stuckFacts,
} from "@/lib/prototype/rest-lines";
import { loadTestStory } from "@/lib/prototype/test-story";

const story = loadTestStory();

function gateway(result: unknown) {
  const call = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return {
    gateway: {
      writeStuckStory: call,
      writeRestReply: call,
      writeReturnPopup: call,
    } as unknown as ModelGateway,
    call,
  };
}

const failures = [
  { source: "authored", text: "a stored line" },
  { source: "failed", reason: "checks" },
  { source: "generated", text: "" },
  new Error("network"),
];

describe("#66 AC1 his first message on the rest page", () => {
  it("uses the labelled test pause message without the model", async () => {
    expect(await pauseMessageFor({ pauseNumber: 1, stepTitle: "Outline" }, null)).toEqual({
      status: "ok",
      isTestData: true,
      text: story.pauseMessage,
    });
  });

  it("asks the gateway with the pause number and shows only a generated line", async () => {
    const { gateway: g, call } = gateway({ source: "generated", text: "My map is wrong." });
    const result = await pauseMessageFor({ pauseNumber: 2, stepTitle: "Outline" }, g);
    expect(result).toEqual({ status: "ok", isTestData: false, text: "My map is wrong." });
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({ pauseNumber: 2, stepTitle: "Outline" }),
    );
  });

  it("FAIL-SCREEN and NO-BACKUP: anything that is not generated is a failure", async () => {
    for (const outcome of failures) {
      const { gateway: g } = gateway(outcome);
      expect(await pauseMessageFor({ pauseNumber: 1, stepTitle: "Outline" }, g)).toEqual({
        status: "failed",
      });
    }
  });
});

describe("#28 AC3 and PAUSE-3 the pause number reaches the prompt", () => {
  it("passes the number of this pause in the facts", () => {
    expect(stuckFacts(1)).toContain("pause number 1");
  });

  it("makes the snag much harder from the third pause, with worry, never an instruction", () => {
    for (const n of [1, 2]) expect(stuckFacts(n)).not.toMatch(/much harder/);
    for (const n of [3, 4, 9]) {
      const facts = stuckFacts(n);
      expect(facts).toMatch(/much harder/);
      expect(facts).toMatch(/worried he may fail/);
      expect(facts).toMatch(/never gives the person an instruction/);
      expect(facts).toMatch(/never asks the person to stop pausing/);
    }
  });
});

describe("#67 AC2 and AC4 his replies in the rest conversation", () => {
  it("cycles through the labelled test replies without the model", async () => {
    const replies = [];
    for (let i = 0; i < story.restReplies.length + 1; i += 1) {
      replies.push(await restReplyFor({ message: "hey", history: [], replyIndex: i }, null));
    }
    expect(replies[0]).toEqual({ status: "ok", isTestData: true, text: story.restReplies[0] });
    expect(replies.at(-1)).toEqual(replies[0]);
  });

  it("sends a crisis message to no one, not even the test data", async () => {
    const { gateway: g, call } = gateway({ source: "generated", text: "x." });
    const result = await restReplyFor(
      { message: "I want to kill myself", history: [], replyIndex: 0 },
      g,
    );
    expect(result).toEqual({ status: "crisis" });
    expect(call).not.toHaveBeenCalled();
  });

  it("sends the message and recent history, and drops crisis text from the history", async () => {
    const { gateway: g, call } = gateway({ source: "generated", text: "I hear the creek." });
    const result = await restReplyFor(
      {
        message: "what are you doing",
        history: [
          { from: "you", text: "I want to kill myself" },
          { from: "him", text: "My boots are dusty." },
        ],
        replyIndex: 0,
      },
      g,
    );
    expect(result).toEqual({ status: "ok", isTestData: false, text: "I hear the creek." });
    const sent = JSON.stringify(call.mock.calls);
    expect(sent).toContain("what are you doing");
    expect(sent).toContain("My boots are dusty.");
    expect(sent).not.toContain("kill myself");
  });

  it("ERA-ANSWER: tells him to answer as a person of his own time would", async () => {
    const { gateway: g, call } = gateway({ source: "generated", text: "I do not know." });
    await restReplyFor({ message: "what is a phone", history: [], replyIndex: 0 }, g);
    const input = (call.mock.calls[0] as unknown[])[0] as { facts: string };
    expect(input.facts).toMatch(/person of his own time/);
  });

  it("silently limits the length of a message sent to the model", async () => {
    const { gateway: g, call } = gateway({ source: "generated", text: "I see." });
    await restReplyFor({ message: "a".repeat(5_000), history: [], replyIndex: 0 }, g);
    const input = (call.mock.calls[0] as unknown[])[0] as { userMessage: string };
    expect(input.userMessage.length).toBe(MAX_MESSAGE_CHARS);
  });

  it("FAIL-SCREEN: anything that is not generated is a failure", async () => {
    for (const outcome of failures) {
      const { gateway: g } = gateway(outcome);
      expect(await restReplyFor({ message: "hey", history: [], replyIndex: 0 }, g)).toEqual({
        status: "failed",
      });
    }
  });
});

describe("#69 AC4, #57 and #61 his return line", () => {
  it("uses the labelled test return line without the model", async () => {
    expect(await returnLineFor({ trigger: "rest", awayMinutes: 3 }, null)).toEqual({
      status: "ok",
      isTestData: true,
      text: story.returnLine,
    });
  });

  it("passes the trigger rest or absence to the gateway", async () => {
    for (const trigger of ["rest", "absence"] as const) {
      const { gateway: g, call } = gateway({ source: "generated", text: "I walked the line." });
      await returnLineFor({ trigger, awayMinutes: 12 }, g);
      expect(call).toHaveBeenCalledWith(expect.objectContaining({ trigger }));
    }
  });

  it("TIME-WORDS and #69 AC7: a line with clock numbers is not shown", async () => {
    const { gateway: g } = gateway({ source: "generated", text: "I waited 12 long minutes." });
    expect(await returnLineFor({ trigger: "absence", awayMinutes: 12 }, g)).toEqual({
      status: "failed",
    });
  });

  it("FAIL-SCREEN: anything that is not generated is a failure", async () => {
    for (const outcome of failures) {
      const { gateway: g } = gateway(outcome);
      expect(await returnLineFor({ trigger: "rest", awayMinutes: 1 }, g)).toEqual({
        status: "failed",
      });
    }
  });
});
