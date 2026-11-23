import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ModelGateway } from "@/lib/model-gateway";
import { takeTurn } from "@/lib/goal-dialogue/turns";
import { renameGoal, type GoalEditWriter } from "@/lib/goals/goal-edits";
import { startGoal, type GoalWriter } from "@/lib/goals/start-goal";
import { accountRestReply } from "@/lib/progress/account-lines";
import { restReplyFor } from "@/lib/prototype/rest-lines";
import { splitGoal } from "@/lib/prototype/split-goal";
import {
  addFirstRestMessage,
  addRestMessage,
  dropFlaggedRestMessage,
  setStepCards,
  startRest,
  syncSession,
} from "@/lib/prototype/session";
import type { SafetyCheck, SafetyContext, SafetyGate } from "@/lib/safety/check";
import { seedContent } from "./support/seed-content";

// US-SAF-4 (#117): every free-text field with a server-side check asks the classifier before any
// model call or save (owner decision of 2026-11-22, G5), and an ordinary message still gets his
// reply in character (AC4).

const seed = seedContent();
const USER = "11111111-1111-4111-8111-111111111111";
const GOAL_ID = "22222222-2222-4222-8222-222222222222";

/** A classifier-backed check that calls one marker phrase a crisis, as an indirect message. */
const INDIRECT = "I have given my things away and said goodbye";

function safety() {
  const calls: { text: string; context: SafetyContext }[] = [];
  const check = vi.fn<SafetyCheck>(async (text, context) => {
    calls.push({ text, context });
    const crisis = text.includes(INDIRECT);
    return {
      action: crisis ? "crisis-page" : "continue",
      tier: crisis ? "crisis" : "stress",
      layer: "classifier",
    } satisfies SafetyGate;
  });
  return { check, calls };
}

function restGateway() {
  const writeRestReply = vi.fn(async () => ({
    source: "generated" as const,
    text: "I know that feeling too well.",
  }));
  return { gateway: { writeRestReply } as unknown as ModelGateway, writeRestReply };
}

describe("#117 the rest chat (R1-C)", () => {
  it("test_117_an_indirect_crisis_is_caught_before_his_reply_is_asked", async () => {
    const { check } = safety();
    const { gateway, writeRestReply } = restGateway();
    const result = await restReplyFor(
      seed,
      { message: INDIRECT, history: [], replyIndex: 0 },
      gateway,
      check,
    );
    expect(result).toEqual({ status: "crisis" });
    expect(writeRestReply).not.toHaveBeenCalled();
  });

  it("test_117_the_context_is_the_earlier_user_messages_of_this_chat_only", async () => {
    // The check itself keeps the last two (tests/safety-classifier-117.test.ts); his messages
    // never go in.
    const { check, calls } = safety();
    const { gateway } = restGateway();
    await restReplyFor(
      seed,
      {
        message: "now",
        history: [
          { from: "you", text: "first" },
          { from: "him", text: "his words" },
          { from: "you", text: "second" },
          { from: "you", text: "third" },
        ],
        replyIndex: 0,
      },
      gateway,
      check,
    );
    expect(calls.find((call) => call.text === "now")).toEqual({
      text: "now",
      context: { position: "rest_chat", previous: ["first", "second", "third"] },
    });
  });

  it("test_117_ac4_ordinary_stress_passes_and_he_answers_in_character", async () => {
    const { check } = safety();
    const { gateway, writeRestReply } = restGateway();
    const result = await restReplyFor(
      seed,
      { message: "This deadline is killing me", history: [], replyIndex: 0 },
      gateway,
      check,
    );
    expect(result).toMatchObject({ status: "ok", text: "I know that feeling too well." });
    expect(writeRestReply).toHaveBeenCalledTimes(1);
  });

  it("test_117_the_signed_in_rest_chat_asks_once_and_never_the_reply_model_on_crisis", async () => {
    const { check } = safety();
    const { gateway, writeRestReply } = restGateway();
    const raw = { message: INDIRECT, history: [], replyIndex: 0 };
    expect(await accountRestReply(seed, raw, gateway, check)).toEqual({ status: "crisis" });
    expect(writeRestReply).not.toHaveBeenCalled();
    const ok = { message: "so tired", history: [], replyIndex: 0 };
    check.mockClear();
    expect(await accountRestReply(seed, ok, gateway, check)).toMatchObject({ status: "ok" });
    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe("#117 fix round 1 C1: a flagged rest message never reaches the reply model later", () => {
  it("test_117_c1_after_a_classifier_crisis_and_back_the_next_reply_prompt_lacks_the_text", async () => {
    const { check } = safety();
    const { gateway, writeRestReply } = restGateway();
    // Turn 1: the classifier (not the keyword layer) flags the message.
    const first = await restReplyFor(
      seed,
      { message: INDIRECT, history: [{ from: "him", text: "His pause message." }], replyIndex: 0 },
      gateway,
      check,
    );
    expect(first).toEqual({ status: "crisis" });
    // Turn 2 after Back: an old browser still sends the flagged message in its history.
    const second = await restReplyFor(
      seed,
      {
        message: "ok, back to it",
        history: [
          { from: "him", text: "His pause message." },
          { from: "you", text: INDIRECT },
        ],
        replyIndex: 0,
      },
      gateway,
      check,
    );
    expect(second).toMatchObject({ status: "ok" });
    expect(JSON.stringify(writeRestReply.mock.calls)).not.toContain(INDIRECT);
  });

  it("test_117_c1_an_answered_message_stays_in_the_reply_history", async () => {
    const { check } = safety();
    const { gateway, writeRestReply } = restGateway();
    await restReplyFor(
      seed,
      {
        message: "and now",
        history: [
          { from: "him", text: "His pause message." },
          { from: "you", text: "I am stuck on chapter two" },
          { from: "him", text: "I know that feeling too well." },
        ],
        replyIndex: 1,
      },
      gateway,
      check,
    );
    expect(JSON.stringify(writeRestReply.mock.calls)).toContain("I am stuck on chapter two");
  });

  it("test_117_c1_the_browser_drops_the_flagged_message_from_the_session", () => {
    const plan = {
      goal: { text: "Write the report", minutes: 30 },
      steps: [{ title: "Outline", description: "", minutes: 30 }],
    };
    const started = setStepCards(
      syncSession(null, plan, 1),
      0,
      { opening: "opening", story: ["story 1"] },
      0,
    );
    const session = addRestMessage(addFirstRestMessage(startRest(started, 0), "h"), {
      from: "you",
      text: INDIRECT,
    });
    const after = dropFlaggedRestMessage(session, INDIRECT);
    expect(after.rest?.messages).toEqual([{ from: "him", text: "h" }]);
    // Only the last message, and only if it is that same text.
    expect(dropFlaggedRestMessage(after, INDIRECT).rest?.messages).toEqual([
      { from: "him", text: "h" },
    ]);
  });
});

describe("#117 the goal dialogue (GD1) and the split", () => {
  const SECRET = Buffer.from("a test secret that is long enough to sign with");

  it("test_117_the_goal_turn_shows_the_crisis_page_on_a_classifier_crisis", async () => {
    const { check, calls } = safety();
    const outcome = await takeTurn(
      { kind: "goal", goal: INDIRECT },
      {
        secret: SECRET,
        now: () => 0,
        newId: () => "id",
        split: async () => ({ status: "failed" }),
        safety: check,
      },
    );
    expect(outcome).toEqual({ status: "crisis" });
    expect(calls[0].context).toEqual({ position: "goal_input" });
  });

  it("test_117_the_split_never_calls_the_model_on_a_classifier_crisis", async () => {
    const { check } = safety();
    const createGateway = vi.fn();
    const outcome = await splitGoal(
      { goal: INDIRECT, totalMinutes: 30, splitFiner: false },
      {
        env: {},
        today: "2026-11-22",
        readCounter: () => undefined,
        writeCounter: () => undefined,
        createGateway,
        safety: check,
      },
    );
    expect(outcome).toEqual({ status: "crisis" });
    expect(createGateway).not.toHaveBeenCalled();
  });
});

describe("#117 saving the Goal and its Plan", () => {
  function goalWriter() {
    const writer: GoalWriter = {
      goalExists: vi.fn(async () => false),
      insertGoal: vi.fn(async () => {}),
      updateGoal: vi.fn(async () => {}),
      replaceSteps: vi.fn(async () => {}),
      deleteGoal: vi.fn(async () => {}),
    };
    return writer;
  }

  const base = {
    goalId: GOAL_ID,
    goalText: "Write the report",
    title: "Report",
    splitFiner: false,
    steps: [
      { title: "Outline", description: "List the sections.", minutes: 10 },
      { title: "Draft", description: "", minutes: 20 },
    ],
  };

  it("test_117_start_checks_the_goal_the_title_and_the_plan_and_saves_nothing_on_crisis", async () => {
    for (const changed of [
      { goalText: INDIRECT },
      { title: INDIRECT },
      { steps: [{ title: "Outline", description: INDIRECT, minutes: 10 }] },
    ]) {
      const { check } = safety();
      const writer = goalWriter();
      const outcome = await startGoal(
        { ...base, ...changed },
        { userId: USER, writer, safety: check },
      );
      expect(outcome).toEqual({ status: "crisis" });
      expect(writer.insertGoal).not.toHaveBeenCalled();
      expect(writer.replaceSteps).not.toHaveBeenCalled();
    }
  });

  it("test_117_start_saves_when_every_field_passes", async () => {
    const { check, calls } = safety();
    const outcome = await startGoal(base, { userId: USER, writer: goalWriter(), safety: check });
    expect(outcome.status).toBe("saved");
    expect(calls.map((call) => call.context.position).sort()).toEqual([
      "goal_input",
      "goal_title",
      "plan_edit",
    ]);
  });

  it("test_117_rename_saves_nothing_on_a_classifier_crisis", async () => {
    const { check, calls } = safety();
    const writer: GoalEditWriter = {
      rename: vi.fn(async () => {}),
      setKind: vi.fn(async () => {}),
      newestSessionIn: vi.fn(async () => null),
    };
    expect(
      await renameGoal(
        { goalId: GOAL_ID, title: INDIRECT },
        { userId: USER, writer, safety: check },
      ),
    ).toEqual({ status: "crisis" });
    expect(writer.rename).not.toHaveBeenCalled();
    expect(calls[0].context).toEqual({ position: "goal_rename" });
  });
});

describe("#117 every server action passes the server's classifier check", () => {
  const app = path.join(import.meta.dirname, "..", "src", "app");
  const read = (file: string) => readFileSync(path.join(app, file), "utf8");

  it("test_117_the_actions_with_free_text_use_serverSafetyCheck", () => {
    for (const file of [
      "goal/actions.ts",
      "try/goal/actions.ts",
      "goals/actions.ts",
      "rest/actions.ts",
      "try/rest/actions.ts",
    ]) {
      expect(read(file), file).toMatch(/serverSafetyCheck\(\)/);
    }
    // The goal dialogue's turns get it through their shared server deps.
    const turns = readFileSync(
      path.join(import.meta.dirname, "..", "src", "lib", "goal-dialogue", "server.ts"),
      "utf8",
    );
    expect(turns).toMatch(/serverSafetyCheck\(\)/);
  });
});
