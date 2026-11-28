import { describe, expect, it, vi } from "vitest";
import { createModelGateway } from "@/lib/model-gateway";
import { REST_LAST_ROUND_INSTRUCTION, REST_ROUNDS } from "@/lib/model-gateway/rest-round";
import type { ModelGateway, RestReplyInput } from "@/lib/model-gateway/types";
import type { PromptRow, PromptSource } from "@/lib/prompts/repository";
import { accountRestEnded, accountRestReply } from "@/lib/progress/account-lines";
import { supabaseRestRounds } from "@/lib/progress/rest-rounds";
import { normaliseRestRequest } from "@/lib/prototype/line-requests";
import {
  restReplyFor,
  restReplyInRound,
  roundsFromHistory,
  type RestReplyResponse,
  type RestRounds,
} from "@/lib/prototype/rest-lines";
import {
  endRest,
  startRest,
  withPauseKey,
  type FocusSession,
  type RestMessage,
} from "@/lib/prototype/session";
import type { SafetyCheck } from "@/lib/safety/check";
import { OPPENHEIMER } from "./support/companion";
import { seedContent } from "./support/seed-content";
import { seedPromptSource } from "./support/seed-prompts";

// #518 (REST-ROUND-10, R1-C10): in one Pause, his reply to the tenth message says his own work is
// going to fail, and then he stops replying. The count is kept where it cannot be reset by a
// reload (the account), a failed reply is not counted (its retry keeps the round), and every Pause
// starts at round 1. Every model here is a fake (an in-test function): no real model.

const seed = seedContent();
const SESSION = "00000000-0000-4000-8000-000000000518";
const PAUSE = "00000000-0000-4000-9000-000000000518";
const ENDING = "This piece of my work is going to fail, and I know it now.";
const noCrisis: SafetyCheck = async () => ({ action: "continue", tier: "none", layer: "keyword" });
const crisis: SafetyCheck = async () => ({
  action: "crisis-page",
  tier: "crisis",
  layer: "keyword",
});
const reply = (text: string) => JSON.stringify({ reply: text });

const REVIEW_ROW: PromptRow = {
  key: "rest_reply_review",
  version: 1,
  body: [
    'Return JSON only: {"reply":"..."}',
    "Invented review prompt for tests.",
    "Facts already known: {{facts}}",
    "The person wrote: {{userMessage}}",
    "Draft: {{draft}}",
  ].join("\n"),
  params: { checks: { max_sentences: 3, max_words: 80, min_sentences: 1 } },
};

function prompts(review: PromptRow | null): PromptSource {
  const source = seedPromptSource();
  return async (key) => (key === "rest_reply_review" ? review : source(key));
}

/** A fake model that answers the ending only when the instruction is in the prompt. */
function fakeModel(review: PromptRow | null) {
  const sent: string[] = [];
  const gateway = createModelGateway({
    prompts: prompts(review),
    timeLimitMs: 60_000,
    log: () => {},
    provider: async ({ prompt }) => {
      sent.push(prompt);
      if (prompt.startsWith("Invented review prompt") || prompt.includes("Draft:")) {
        // The review keeps a good draft as it is.
        const draft = /Draft: (.*)$/m.exec(prompt)?.[1] ?? "";
        return reply(draft);
      }
      return reply(
        prompt.includes(REST_LAST_ROUND_INSTRUCTION) ? ENDING : "I keep my notes dry here.",
      );
    },
  });
  return { gateway, sent };
}

const INPUT: RestReplyInput = {
  companionName: OPPENHEIMER,
  facts: "He is at a table.",
  userMessage: "hello",
};

/** A count kept in memory, as the account's table keeps it. */
function memoryRounds() {
  const counts = new Map<string, number>();
  const factory = (sessionId: string, pauseKey: string): RestRounds => {
    const key = `${sessionId}/${pauseKey}`;
    return {
      answered: async () => counts.get(key) ?? 0,
      record: async (round) => {
        if (round === (counts.get(key) ?? 0) + 1) counts.set(key, round);
      },
    };
  };
  return { factory, counts };
}

/** The account's rest page: each message with the history the page would send. */
async function chat(
  gateway: ModelGateway,
  rounds: ReturnType<typeof memoryRounds>["factory"],
  count: number,
  pauseKey = PAUSE,
) {
  const history: RestMessage[] = [{ from: "him", text: "His first message." }];
  const answers: RestReplyResponse[] = [];
  for (let index = 1; index <= count; index += 1) {
    const message = `Message ${index}`;
    const answer = await accountRestReply(
      seed,
      { message, history, replyIndex: index - 1, sessionId: SESSION, pauseKey },
      gateway,
      noCrisis,
      rounds,
    );
    answers.push(answer);
    history.push({ from: "you", text: message });
    if (answer.status === "ok") history.push({ from: "him", text: answer.text });
  }
  return answers;
}

describe("#518 the tenth reply gets the added instruction in call one (both modes)", () => {
  it("test_518_ac1_round_ten_adds_the_instruction_to_rest_reply_with_one_call", async () => {
    const { gateway, sent } = fakeModel(null);
    expect(await gateway.writeRestReply(INPUT)).toEqual({
      source: "generated",
      text: "I keep my notes dry here.",
    });
    expect(sent[0]).not.toContain(REST_LAST_ROUND_INSTRUCTION);
    expect(await gateway.writeRestReply({ ...INPUT, lastRound: true })).toEqual({
      source: "generated",
      text: ENDING,
    });
    expect(sent).toHaveLength(2);
    // After the prompt, the person's message included before it.
    expect(sent[1].endsWith(`\n\n${REST_LAST_ROUND_INSTRUCTION}`)).toBe(true);
    expect(sent[1]).toContain("The person wrote: hello");
  });

  it("test_518_ac1_with_the_review_active_call_one_gets_it_and_call_two_reads_the_draft", async () => {
    const { gateway, sent } = fakeModel(REVIEW_ROW);
    expect(await gateway.writeRestReply({ ...INPUT, lastRound: true })).toEqual({
      source: "generated",
      text: ENDING,
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]).toContain(REST_LAST_ROUND_INSTRUCTION);
    // Call two is unchanged: it reads the ending as its draft, without the instruction.
    expect(sent[1]).not.toContain(REST_LAST_ROUND_INSTRUCTION);
    expect(sent[1]).toContain(`Draft: ${ENDING}`);
  });

  it("test_518_the_instruction_says_his_work_fails_and_never_sends_the_person_back", () => {
    expect(REST_ROUNDS).toBe(10);
    expect(REST_LAST_ROUND_INSTRUCTION).toMatch(/tenth message/);
    expect(REST_LAST_ROUND_INSTRUCTION).toMatch(/his own work here is going to fail/);
    expect(REST_LAST_ROUND_INSTRUCTION).toMatch(/only about his own side/);
    expect(REST_LAST_ROUND_INSTRUCTION).toMatch(/does not tell the person to go back/);
  });
});

describe("#518 AC1 the tenth message gets the ending reply, then no reply comes", () => {
  it("test_518_ac1_the_tenth_reply_is_the_ending_and_ends_the_chat", async () => {
    const { gateway, sent } = fakeModel(null);
    const { factory } = memoryRounds();
    const answers = await chat(gateway, factory, 10);
    for (const answer of answers.slice(0, 9)) {
      expect(answer).toEqual({
        status: "ok",
        isTestData: false,
        text: "I keep my notes dry here.",
      });
    }
    expect(answers[9]).toEqual({ status: "ok", isTestData: false, text: ENDING, ended: true });
    // Only the tenth rest_reply prompt carries the instruction; nothing warns before it.
    const restPrompts = sent.filter((prompt) => prompt.startsWith('Return JSON only: {"reply"'));
    expect(restPrompts.filter((prompt) => prompt.includes(REST_LAST_ROUND_INSTRUCTION))).toEqual([
      restPrompts[9],
    ]);
  });

  it("test_518_ac1_an_eleventh_message_gets_no_model_call", async () => {
    const { gateway, sent } = fakeModel(null);
    const { factory } = memoryRounds();
    await chat(gateway, factory, 10);
    const calls = sent.length;
    const after = await accountRestReply(
      seed,
      { message: "Are you there?", history: [], sessionId: SESSION, pauseKey: PAUSE },
      gateway,
      noCrisis,
      factory,
    );
    expect(after).toEqual({ status: "ended" });
    expect(sent).toHaveLength(calls);
  });

  it("test_518_a_crisis_message_after_round_ten_still_opens_the_safety_page", async () => {
    const { gateway } = fakeModel(null);
    const { factory } = memoryRounds();
    await chat(gateway, factory, 10);
    expect(
      await accountRestReply(
        seed,
        { message: "x", history: [], sessionId: SESSION, pauseKey: PAUSE },
        gateway,
        crisis,
        factory,
      ),
    ).toEqual({ status: "crisis" });
  });
});

describe("#518 AC2 a new Pause starts at round 1", () => {
  it("test_518_ac2_a_new_pause_key_counts_from_one", async () => {
    const { gateway, sent } = fakeModel(null);
    const { factory } = memoryRounds();
    await chat(gateway, factory, 10);
    const before = sent.length;
    const next = await chat(gateway, factory, 1, "00000000-0000-4000-9000-000000000519");
    expect(next).toEqual([{ status: "ok", isTestData: false, text: "I keep my notes dry here." }]);
    expect(sent.slice(before).some((prompt) => prompt.includes(REST_LAST_ROUND_INSTRUCTION))).toBe(
      false,
    );
  });

  it("test_518_ac2_every_pause_gets_its_own_key", () => {
    const session = {
      steps: [{}],
      pauses: [0],
      current: 0,
      rest: null,
    } as unknown as FocusSession;
    const first = startRest({ ...session, finished: false } as FocusSession, 0);
    const second = startRest({ ...first, rest: null }, 0);
    expect(first.rest?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.rest?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.rest?.key).not.toBe(first.rest?.key);
    expect(second.rest?.pauseNumber).toBe(2);
  });

  it("test_518_a_rest_stored_before_518_gets_a_key_once", () => {
    const old = {
      rest: { pauseNumber: 1, messages: [], draft: "" },
    } as unknown as FocusSession;
    const keyed = withPauseKey(old);
    expect(keyed.rest?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(withPauseKey(keyed)).toBe(keyed);
  });
});

describe("#518 AC3 the count is kept where a reload cannot reset it", () => {
  it("test_518_ac3_the_account_count_says_ended_after_round_ten", async () => {
    const { gateway } = fakeModel(null);
    const { factory } = memoryRounds();
    const request = { sessionId: SESSION, pauseKey: PAUSE };
    expect(await accountRestEnded(request, factory)).toEqual({ status: "ok", ended: false });
    await chat(gateway, factory, 9);
    expect(await accountRestEnded(request, factory)).toEqual({ status: "ok", ended: false });
    await chat(gateway, factory, 1);
    expect(await accountRestEnded(request, factory)).toEqual({ status: "ok", ended: true });
    // The count, not the history the page sends, decides: an empty history is still round 11.
    expect(
      await accountRestReply(
        seed,
        { message: "again", history: [], ...request },
        gateway,
        noCrisis,
        factory,
      ),
    ).toEqual({ status: "ended" });
  });

  it("test_518_ac3_without_the_session_or_the_pause_no_reply_and_no_model_call", async () => {
    const { gateway, sent } = fakeModel(null);
    const { factory } = memoryRounds();
    expect(
      await accountRestReply(seed, { message: "hello", history: [] }, gateway, noCrisis, factory),
    ).toEqual({ status: "failed" });
    expect(await accountRestEnded({ pauseKey: PAUSE }, factory)).toEqual({ status: "failed" });
    expect(sent).toEqual([]);
  });

  it("test_518_ac3_a_count_that_cannot_be_read_or_written_fails_with_retry", async () => {
    const { gateway } = fakeModel(null);
    const broken = (): RestRounds => ({
      answered: async () => {
        throw new Error("down");
      },
      record: async () => {},
    });
    expect(
      await accountRestReply(
        seed,
        { message: "hello", history: [], sessionId: SESSION, pauseKey: PAUSE },
        gateway,
        noCrisis,
        broken,
      ),
    ).toEqual({ status: "failed" });
    const unwritten = (): RestRounds => ({
      answered: async () => 0,
      record: async () => {
        throw new Error("down");
      },
    });
    expect(
      await restReplyInRound(
        unwritten(),
        async () => ({ status: "ok", isTestData: false, text: "x" }),
        async () => ({ status: "ended" }),
      ),
    ).toEqual({ status: "failed" });
  });

  it("test_518_ac3_the_supabase_count_calls_the_two_functions", async () => {
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      void args;
      return { data: name === "rest_round" ? 10 : 3, error: null };
    });
    const rounds = supabaseRestRounds({ rpc })(SESSION, PAUSE);
    expect(await rounds.answered()).toBe(10);
    expect(rpc).toHaveBeenCalledWith("rest_round", {
      target_session: SESSION,
      target_pause: PAUSE,
    });
    await rounds.record(3);
    expect(rpc).toHaveBeenLastCalledWith("record_rest_round", {
      target_session: SESSION,
      target_pause: PAUSE,
      shown_round: 3,
    });
    // A write that was not counted (the count stayed lower) is a failure.
    await expect(rounds.record(4)).rejects.toThrow();
    const failing = supabaseRestRounds({
      rpc: async () => ({ data: null, error: { message: "no" } }),
    })(SESSION, PAUSE);
    await expect(failing.answered()).rejects.toThrow();
  });

  it("test_518_ac3_the_request_keeps_only_uuids_for_the_session_and_the_pause", () => {
    expect(
      normaliseRestRequest({ message: "m", sessionId: SESSION.toUpperCase(), pauseKey: PAUSE }),
    ).toMatchObject({ sessionId: SESSION, pauseKey: PAUSE });
    const bad = normaliseRestRequest({ message: "m", sessionId: "x; drop", pauseKey: 4 });
    expect(bad.sessionId).toBeUndefined();
    expect(bad.pauseKey).toBeUndefined();
  });
});

describe("#518 AC4 a failed tenth reply, retried, still ends the chat", () => {
  it("test_518_ac4_the_retry_keeps_round_ten", async () => {
    const { factory, counts } = memoryRounds();
    const { gateway: working } = fakeModel(null);
    await chat(working, factory, 9);
    const history: RestMessage[] = [{ from: "him", text: "His first message." }];
    const request = { message: "Message 10", history, sessionId: SESSION, pauseKey: PAUSE };
    // The tenth reply fails (the model is down): nothing is counted.
    const failing = createModelGateway({
      prompts: prompts(null),
      timeLimitMs: 200,
      log: () => {},
      provider: async () => {
        throw new Error("down");
      },
    });
    expect(await accountRestReply(seed, request, failing, noCrisis, factory)).toEqual({
      status: "failed",
    });
    expect(counts.get(`${SESSION}/${PAUSE}`)).toBe(9);
    // Try again: still round ten, so the instruction and the end.
    const { gateway, sent } = fakeModel(null);
    expect(await accountRestReply(seed, request, gateway, noCrisis, factory)).toEqual({
      status: "ok",
      isTestData: false,
      text: ENDING,
      ended: true,
    });
    expect(sent[0]).toContain(REST_LAST_ROUND_INSTRUCTION);
    expect(counts.get(`${SESSION}/${PAUSE}`)).toBe(10);
  });

  it("test_518_ac4_on_the_test_path_the_round_comes_from_the_history", async () => {
    const history: RestMessage[] = [{ from: "him", text: "First." }];
    for (let index = 1; index <= 9; index += 1) {
      history.push({ from: "you", text: `m${index}` }, { from: "him", text: `r${index}` });
    }
    expect(await roundsFromHistory(history).answered()).toBe(9);
    // A retry sends the history without its unanswered message: still round ten.
    const { gateway, sent } = fakeModel(null);
    const answer = await restReplyInRound(
      roundsFromHistory(history),
      (round) =>
        restReplyFor(seed, { message: "m10", history, replyIndex: 9, round }, gateway, noCrisis),
      async () => ({ status: "ended" }),
    );
    expect(answer).toMatchObject({ status: "ok", text: ENDING, ended: true });
    expect(sent[0]).toContain(REST_LAST_ROUND_INSTRUCTION);
    history.push({ from: "you", text: "m10" }, { from: "him", text: ENDING });
    expect(await roundsFromHistory(history).answered()).toBe(10);
  });
});

describe("#518 the ended state on the phone", () => {
  it("test_518_end_rest_marks_the_rest_ended_and_drops_an_unanswered_message", () => {
    const session = {
      rest: {
        pauseNumber: 1,
        draft: "",
        key: PAUSE,
        messages: [
          { from: "him", text: "a" },
          { from: "you", text: "b" },
        ],
      },
    } as unknown as FocusSession;
    const ended = endRest(session);
    expect(ended.rest?.ended).toBe(true);
    expect(ended.rest?.messages).toEqual([{ from: "him", text: "a" }]);
  });
});
