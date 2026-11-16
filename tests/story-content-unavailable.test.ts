import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@/lib/model-gateway";
import {
  accountPauseMessage,
  accountRestReply,
  accountReturnLine,
  accountStepCards,
} from "@/lib/progress/account-lines";
import type { ProgressStore } from "@/lib/progress/account-progress";
import { cardsForStep, normaliseStepCardsRequest } from "@/lib/prototype/focus-cards";
import { pauseMessageFor, restReplyFor, returnLineFor } from "@/lib/prototype/rest-lines";
import { finishAccountRun } from "@/lib/summary/finish-run";
import type { RunWriter } from "@/lib/summary/run-writer";
import { StoryContentUnavailable } from "@/lib/content/repository";
import { seedContent } from "./support/seed-content";

// #284: when the story content cannot be read, his lines fail (FAIL-SCREEN) and no other story or
// stored line stands in; the safety gate still runs first.

const gateway = new Proxy({} as ModelGateway, {
  get: () =>
    vi.fn(async () => ({ source: "generated", text: "I hold the pen.", cards: ["I sit."] })),
});
const STEP = { storyId: "site-search", index: 0, planMinutes: [20], earlierCards: [] };

describe("story content unavailable (#284)", () => {
  it("test_284_step_cards_fail_without_content", async () => {
    expect(normaliseStepCardsRequest(null, STEP)).toBeNull();
    expect(await accountStepCards(null, STEP, gateway)).toEqual({ status: "failed" });
    // The same request is accepted once the content is there.
    expect(normaliseStepCardsRequest(seedContent(), STEP)).not.toBeNull();
    expect((await cardsForStep(seedContent(), STEP, gateway)).status).toBe("ok");
  });

  it("test_284_pause_rest_and_return_lines_fail_without_content_even_on_the_test_path", async () => {
    const pause = { storyId: "site-search", pauseNumber: 1, stepTitle: "Draft" };
    const rest = {
      storyId: "site-search",
      message: "How is it going?",
      history: [],
      replyIndex: 0,
    };
    const back = { storyId: "site-search", trigger: "rest" as const, awayMinutes: 5 };
    expect(await pauseMessageFor(null, pause, null)).toEqual({ status: "failed" });
    expect(await restReplyFor(null, rest, null)).toEqual({ status: "failed" });
    expect(await returnLineFor(null, back, null)).toEqual({ status: "failed" });
    expect(await accountPauseMessage(null, pause, gateway)).toEqual({ status: "failed" });
    expect(await accountRestReply(null, rest, gateway)).toEqual({ status: "failed" });
    expect(await accountReturnLine(null, back, gateway)).toEqual({ status: "failed" });
  });

  it("test_284_a_crisis_message_still_reaches_the_crisis_page_without_content", async () => {
    const crisis = {
      storyId: "site-search",
      message: "I want to kill myself",
      history: [],
      replyIndex: 0,
    };
    expect(await restReplyFor(null, crisis, gateway)).toEqual({ status: "crisis" });
    expect(await accountRestReply(null, crisis, gateway)).toEqual({ status: "crisis" });
  });

  it("test_284_a_crisis_message_never_waits_for_the_content_read", async () => {
    // Review finding: during an outage the read takes up to its time limit; the gate comes first.
    const crisis = {
      storyId: "site-search",
      message: "I want to kill myself",
      history: [],
      replyIndex: 0,
    };
    const load = vi.fn(async () => seedContent());
    expect(await restReplyFor(load, crisis, gateway)).toEqual({ status: "crisis" });
    expect(await accountRestReply(load, crisis, gateway)).toEqual({ status: "crisis" });
    expect(load).not.toHaveBeenCalled();
    const calm = { ...crisis, message: "How is the work going?" };
    expect((await restReplyFor(load, calm, gateway)).status).toBe("ok");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("test_284_finishing_a_run_fails_without_content_and_calls_no_model", async () => {
    const read = vi.fn();
    const writeClosingLine = vi.fn();
    const outcome = await finishAccountRun(
      { sessionId: "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f" },
      {
        userId: "u",
        store: { read } as unknown as ProgressStore,
        writer: {} as RunWriter,
        gateway: { writeClosingLine } as unknown as ModelGateway,
        nowIso: "2026-11-16T00:00:00.000Z",
        loadContent: async () => {
          throw new StoryContentUnavailable();
        },
      },
    );
    expect(outcome).toEqual({ status: "failed" });
    expect(writeClosingLine).not.toHaveBeenCalled();
  });
});
