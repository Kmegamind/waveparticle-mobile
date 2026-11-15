import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway, type ModelProvider } from "@/lib/model-gateway";
import { checkCompanionLine } from "@/lib/model-gateway/checks";
import { cardNouns, checkRunList, similarity } from "@/lib/model-gateway/run-list";
import { MODEL_GATEWAY_ENV_NAMES, createServerModelGateway } from "@/lib/model-gateway/server";
import { seedPromptSource, seedLineLimits } from "./support/seed-prompts";
import type { CompanionKind } from "@/lib/model-gateway/types";

// #282: the length limits are data in the prompt rows; tests use the seed's.
const checkLine = (text: string, kind: CompanionKind, forbidTerms: string[] = []) =>
  checkCompanionLine(text, kind, forbidTerms, seedLineLimits(kind));

const root = path.resolve(import.meta.dirname, "..");
const goal = "SECRET_GOAL_TEXT";
const userMessage = "SECRET_USER_MESSAGE";
const apiKey = "SECRET_API_KEY";

const planJson = JSON.stringify({
  title: "Read chapter",
  steps: [
    {
      title: "Read the chapter",
      description: "Read the assigned pages and mark the hard ones.",
      minutes: 25,
    },
  ],
});

const card = "I keep the papers flat on the table. The room is quiet around me.";
// Distinct cards: a run rejects exact repeats, shared three-word openings and near repeats (#44).
const distinctCards = [
  card,
  "My pencil needs a sharper point, so I turn it slowly.",
  "Outside the window, wind pushes dust against my boots.",
  "Somewhere below me a truck engine coughs and dies.",
  "Coffee has gone cold in my tin cup.",
  "Bright light from the lamp falls across my notes.",
];
const cardsJson = (count: number) =>
  JSON.stringify({
    cards: distinctCards.slice(0, count),
  });
const stuckJson = JSON.stringify({ story: "I am held on a small snag in my work." });
const replyJson = JSON.stringify({ reply: "I stay with my own work." });
const returnJson = JSON.stringify({
  returnLine:
    "I kept my eyes on the papers in front of me. The room stayed as I had left it a moment before. My hands returned to the work on the table.",
});

/** Narrows a gateway result to the generated case; fails the test on a failure result. */
function generated<T extends { source: string }>(result: T): Extract<T, { source: "generated" }> {
  if (result.source !== "generated") throw new Error(`expected generated, got ${result.source}`);
  return result as Extract<T, { source: "generated" }>;
}

function provider(reply: (attempt: number) => Promise<string> | string): {
  calls: string[];
  impl: ModelProvider;
} {
  const calls: string[] = [];
  return {
    calls,
    impl: async ({ prompt }) => {
      calls.push(prompt);
      return reply(calls.length);
    },
  };
}

describe("model gateway", () => {
  it("returns a checked plan from a successful provider", async () => {
    const fake = provider(async () => planJson);
    const logs: unknown[] = [];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: fake.impl,
      log: (event) => logs.push(event),
    });

    const plan = await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: true });

    expect(plan.source).toBe("generated");
    expect(generated(plan).title).toBe("Read chapter");
    expect(generated(plan).steps).toEqual([
      {
        title: "Read the chapter",
        description: "Read the assigned pages and mark the hard ones.",
        minutes: 25,
      },
    ]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toContain(goal);
    expect(JSON.stringify(logs)).not.toContain(goal);
    expect(JSON.stringify(logs)).not.toContain(apiKey);
  });

  it("returns checked step cards, a stuck story, a rest reply and a return pop-up", async () => {
    const replies = [cardsJson(2), stuckJson, replyJson, returnJson];
    const fake = provider(async () => replies.shift() ?? "");
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });

    const cards = await gateway.writeStepCards({
      minutes: 25,
      facts: "He is at a table.",
    });
    const stuck = await gateway.writeStuckStory({
      pauseNumber: 1,
      facts: "He is at a table.",
    });
    const reply = await gateway.writeRestReply({
      userMessage,
      facts: "He is at a table.",
    });
    const popup = await gateway.writeReturnPopup({
      trigger: "rest",
      facts: "He is at a table.",
      awayMinutes: 12,
    });

    expect(cards).toEqual({ source: "generated", cards: distinctCards.slice(0, 2) });
    expect(stuck.source).toBe("generated");
    expect(generated(stuck).text).toMatch(/\.$/);
    expect(reply).toEqual({ source: "generated", text: "I stay with my own work." });
    expect(popup.source).toBe("generated");
    expect(generated(popup).text.endsWith(".")).toBe(true);
    expect(fake.calls[2]).toContain(userMessage);
  });

  it("drops story cards past the fifth", async () => {
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: provider(async () => cardsJson(6)).impl,
    });
    const cards = await gateway.writeStepCards({
      minutes: 40,
      facts: "He is at a table.",
    });
    expect(generated(cards).cards).toHaveLength(5);
    expect(cards.source).toBe("generated");
  });

  it("retries after invalid JSON with the failure reason and then uses the second answer", async () => {
    const fake = provider(async (attempt) => (attempt === 1 ? "not json" : planJson));
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
    const plan = await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: false });
    expect(plan.source).toBe("generated");
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1]?.startsWith(fake.calls[0] ?? "-")).toBe(true);
    expect(fake.calls[1]).toContain("The last answer was rejected");
  });

  it("returns an explicit failure, not a stored plan, when every answer is invalid JSON", async () => {
    const fake = provider(async () => '{"steps":[]}');
    const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
    const plan = await gateway.splitPlan({ goal, totalMinutes: 40, splitFiner: false });
    expect(plan).toEqual({ source: "failed", reason: "checks" });
    expect(fake.calls).toHaveLength(3);
  });

  it("returns a timeout failure, not a stored line, when the provider is too slow", async () => {
    let calls = 0;
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      timeLimitMs: 20,
      provider: ({ signal }) => {
        calls += 1;
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        });
      },
    });
    const started = Date.now();
    const popup = await gateway.writeReturnPopup({
      trigger: "absence",
      facts: "A quiet room.",
      awayMinutes: 8,
    });
    expect(Date.now() - started).toBeLessThan(500);
    expect(calls).toBe(1);
    expect(popup).toEqual({ source: "failed", reason: "timeout" });
  });

  it("returns a request failure when the provider fails, and logs neither user text nor the key", async () => {
    const logs: unknown[] = [];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      log: (event) => logs.push(event),
      provider: async () => {
        throw new Error(`provider failed for ${userMessage} with ${apiKey}`);
      },
    });
    const reply = await gateway.writeRestReply({ userMessage, facts: "A quiet room." });
    expect(reply).toEqual({ source: "failed", reason: "request" });
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain(userMessage);
    expect(logged).not.toContain(apiKey);
    expect(logged).not.toContain("provider failed");
  });

  it("retries a line that fails the check, then fails without showing the rejected line", async () => {
    const rejected = "You should close your eyes.";
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: async () => JSON.stringify({ reply: rejected }),
    });
    const reply = await gateway.writeRestReply({
      userMessage: "I am tired.",
      facts: "A quiet room.",
    });
    expect(reply).toEqual({ source: "failed", reason: "checks" });
    expect(JSON.stringify(reply)).not.toContain(rejected);
  });

  it("reads only the server model settings and skips the network when they are missing", async () => {
    expect([...MODEL_GATEWAY_ENV_NAMES]).toEqual(["MODEL_API_KEY", "MODEL_API_URL", "MODEL_NAME"]);
    for (const name of MODEL_GATEWAY_ENV_NAMES) {
      expect(name.startsWith("NEXT_PUBLIC_")).toBe(false);
    }

    let called = false;
    const gateway = createServerModelGateway({
      prompts: seedPromptSource(),
      env: {
        NEXT_PUBLIC_MODEL_API_KEY: apiKey,
        MODEL_API_URL: "https://models.example/v1/chat/completions",
        MODEL_NAME: "example-model",
      },
      fetchImpl: async () => {
        called = true;
        throw new Error("should not be called");
      },
    });
    const plan = await gateway.splitPlan({ goal, totalMinutes: 15, splitFiner: false });
    expect(called).toBe(false);
    expect(plan).toEqual({ source: "failed", reason: "request" });
  });

  it("sends the key only in the server request header", async () => {
    const logs: unknown[] = [];
    let seenUrl = "";
    let seenAuth = "";
    const gateway = createServerModelGateway({
      prompts: seedPromptSource(),
      env: {
        MODEL_API_KEY: apiKey,
        MODEL_API_URL: "https://models.example/v1/chat/completions",
        MODEL_NAME: "example-model",
      },
      log: (event) => logs.push(event),
      fetchImpl: async (url, init) => {
        seenUrl = String(url);
        const headers = new Headers(init?.headers);
        seenAuth = headers.get("authorization") ?? "";
        return new Response(JSON.stringify({ choices: [{ message: { content: planJson } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const plan = await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: true });
    expect(plan.source).toBe("generated");
    expect(seenUrl).toBe("https://models.example/v1/chat/completions");
    expect(seenUrl).not.toContain(apiKey);
    expect(seenAuth).toBe(`Bearer ${apiKey}`);
    expect(JSON.stringify(logs)).not.toContain(apiKey);
    expect(JSON.stringify(logs)).not.toContain(goal);
  });

  it("keeps the gateway out of client code and out of public env names", () => {
    const gatewayDir = path.join(root, "src/lib/model-gateway");
    const gatewaySource = readdirSync(gatewayDir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(path.join(gatewayDir, name), "utf8"))
      .join("\n");
    expect(gatewaySource).not.toContain("NEXT_PUBLIC_");
    expect(gatewaySource).not.toContain("DEEPSEEK_API_KEY");
    expect(gatewaySource).not.toContain("GEMINI_API_KEY");
    expect(gatewaySource).not.toMatch(/console\.(log|info|debug|warn|error)/);

    const clientFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry)) {
          const source = readFileSync(full, "utf8");
          if (source.includes('"use client"') || source.includes("'use client'")) {
            clientFiles.push(source);
          }
        }
      }
    };
    walk(path.join(root, "src"));
    for (const source of clientFiles) {
      expect(source).not.toContain("model-gateway");
      expect(source).not.toContain("MODEL_API_KEY");
    }
  });

  describe("rules per line kind (#201)", () => {
    const chatWithQuestion = "Do you see the wind on the mesa? I keep my notes dry under my coat.";
    const oneWayKinds = ["step_card", "stuck_story", "return_popup"] as const;

    it("test_201_ac1_rest_reply_allows_a_question_and_you", () => {
      const checked = checkLine(chatWithQuestion, "rest_reply");
      expect(checked).toEqual({ ok: true, text: chatWithQuestion });
    });

    it("test_201_ac1_rest_reply_allows_at_most_one_question", () => {
      const checked = checkLine(
        "Do you see it? Do you hear it? I keep my notes dry.",
        "rest_reply",
      );
      expect(checked).toEqual({ ok: false, rejectedRules: ["question"] });
    });

    it("test_215_ac1_rest_reply_may_end_on_its_question", () => {
      const text = "I keep my notes dry under my coat. Do you see the wind on the mesa?";
      expect(checkLine(text, "rest_reply")).toEqual({ ok: true, text });
    });

    it("test_215_ac2_rest_reply_without_a_full_stop_or_question_mark_is_rejected", () => {
      const checked = checkLine("I keep my notes dry under my coat", "rest_reply");
      expect(checked.ok).toBe(false);
      if (!checked.ok) expect(checked.rejectedRules).toContain("form");
    });

    it("test_215_ac3_one_way_lines_ending_on_a_question_are_still_rejected", () => {
      for (const kind of oneWayKinds) {
        const checked = checkLine("I keep my notes dry. Is the wind on the mesa?", kind);
        expect(checked.ok, kind).toBe(false);
        if (!checked.ok) expect(checked.rejectedRules, kind).toContain("form");
      }
    });

    it("test_201_ac1_rest_reply_still_applies_the_other_rules", () => {
      const cases: [string, string][] = [
        ["Do you see it? I wait for the 5:30 signal.", "clock"],
        ["Do you see it? I watch the gadget rise from the tower.", "leak"],
        ["Do you see it? I keep my notes dry, bro.", "ban"],
        ["Do you see it? I keep my notes dry. I keep them dry. I keep them close.", "len"],
        ["Do you see the wind on the mesa? I keep my notes dry", "form"],
        ["Do you see it? You should close your eyes, I think.", "cmd"],
      ];
      for (const [text, rule] of cases) {
        const checked = checkLine(text, "rest_reply", ["gadget"]);
        expect(checked.ok, text).toBe(false);
        if (!checked.ok) expect(checked.rejectedRules, text).toContain(rule);
      }
    });

    it("test_201_ac2_one_way_lines_still_reject_a_question_and_you", () => {
      for (const kind of oneWayKinds) {
        const question = checkLine("Is the wind on the mesa? I keep my notes dry.", kind);
        expect(question.ok, kind).toBe(false);
        if (!question.ok) expect(question.rejectedRules, kind).toContain("question");

        const addressed = checkLine("I keep my notes dry for you.", kind);
        expect(addressed.ok, kind).toBe(false);
        if (!addressed.ok) expect(addressed.rejectedRules, kind).toEqual(["you"]);
      }
    });

    it("test_201_ac3_gateway_returns_a_rest_reply_with_a_question", async () => {
      const gateway = createModelGateway({
        prompts: seedPromptSource(),
        provider: async () => JSON.stringify({ reply: chatWithQuestion }),
      });
      const reply = await gateway.writeRestReply({ userMessage, facts: "A quiet room." });
      expect(reply).toEqual({ source: "generated", text: chatWithQuestion });
    });
  });

  describe("pause number and return trigger in the prompts (#202)", () => {
    const stepName = "SECRET_STEP_NAME";
    const goalText = "SECRET_GOAL_NAME";
    const worry = /worried he may fail/i;
    const noOrder = /never (?:tell|give) the person (?:what to do|an instruction)/i;
    const noStopAsk = /never ask the person to stop pausing/i;

    async function stuckPromptFor(pauseNumber: number): Promise<string> {
      const fake = provider(async () => stuckJson);
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      await gateway.writeStuckStory({ pauseNumber, facts: "He is at a table." });
      return fake.calls[0] ?? "";
    }

    async function returnPromptFor(trigger: "rest" | "absence"): Promise<string> {
      const fake = provider(async () => returnJson);
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      await gateway.writeReturnPopup({ trigger, facts: "He is at a table.", awayMinutes: 12 });
      return fake.calls[0] ?? "";
    }

    it("test_202_ac1_stuck_prompt_carries_the_pause_number", async () => {
      for (const pauseNumber of [1, 2, 3, 4]) {
        expect(await stuckPromptFor(pauseNumber)).toContain(`Pause number: ${pauseNumber}`);
      }
    });

    it("test_202_ac1_first_and_second_pause_get_the_ordinary_snag", async () => {
      for (const pauseNumber of [1, 2]) {
        const prompt = await stuckPromptFor(pauseNumber);
        expect(prompt).not.toMatch(worry);
        expect(prompt).toMatch(noOrder);
        expect(prompt).toMatch(noStopAsk);
      }
    });

    it("test_202_ac1_from_the_third_pause_the_snag_is_much_harder_and_he_is_worried", async () => {
      for (const pauseNumber of [3, 4, 9]) {
        const prompt = await stuckPromptFor(pauseNumber);
        expect(prompt).toMatch(/much harder/i);
        expect(prompt).toMatch(/remembers the earlier setbacks/i);
        expect(prompt).toMatch(worry);
        expect(prompt).toMatch(noOrder);
        expect(prompt).toMatch(noStopAsk);
      }
    });

    it("test_202_ac1_an_invalid_pause_number_is_read_as_the_first_pause", async () => {
      for (const pauseNumber of [0, -2, 2.5, Number.NaN]) {
        const prompt = await stuckPromptFor(pauseNumber);
        expect(prompt).toContain("Pause number: 1");
        expect(prompt).not.toMatch(worry);
      }
    });

    it("test_202_ac2_return_prompt_carries_the_trigger_and_differs_by_trigger", async () => {
      const rest = await returnPromptFor("rest");
      const absence = await returnPromptFor("absence");
      expect(rest).toContain("Return trigger: rest");
      expect(absence).toContain("Return trigger: absence");
      expect(rest).toMatch(/rest conversation/i);
      expect(absence).toMatch(/away from the app/i);
      expect(rest).not.toBe(absence);
    });

    it("test_202_ac2_return_prompt_allows_time_words_but_no_clock_numbers", async () => {
      for (const trigger of ["rest", "absence"] as const) {
        const prompt = await returnPromptFor(trigger);
        expect(prompt).toMatch(/how the time felt in his own words/i);
        expect(prompt).toMatch(/no clock times? and no numbers/i);
      }
    });

    it("test_202_ac3_stuck_and_return_prompts_carry_no_goal_or_step_text", async () => {
      const fake = provider(async (attempt) => (attempt === 1 ? stuckJson : returnJson));
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      await gateway.writeStuckStory({
        pauseNumber: 3,
        facts: "He is at a table.",
        forbidTerms: [stepName, goalText],
      });
      await gateway.writeReturnPopup({
        trigger: "absence",
        facts: "He is at a table.",
        awayMinutes: 90,
        forbidTerms: [stepName, goalText],
      });
      expect(fake.calls).toHaveLength(2);
      for (const prompt of fake.calls) {
        expect(prompt).not.toContain(stepName);
        expect(prompt).not.toContain(goalText);
      }
    });
  });

  describe("one check-and-fail pipeline for every line (#44)", () => {
    const facts = "He is at a table.";
    const goodStory = "I am held on a small snag in my work.";
    const story = (text: string) => JSON.stringify({ story: text });

    it("test_44_ac1_retries_with_the_failure_reason_and_returns_the_passing_line", async () => {
      const fake = provider(async (attempt) =>
        attempt === 1 ? story("Is the ink dry? I wait at my desk.") : story(goodStory),
      );
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      const result = await gateway.writeStuckStory({ pauseNumber: 1, facts });
      expect(result).toEqual({ source: "generated", text: goodStory });
      expect(fake.calls).toHaveLength(2);
      expect(fake.calls[1]?.startsWith(fake.calls[0] ?? "-")).toBe(true);
      expect(fake.calls[1]).toContain("The last answer was rejected");
      expect(fake.calls[1]).toMatch(/no question/i);
    });

    it("test_44_ac1_regenerates_until_a_line_passes_within_the_attempt_limit", async () => {
      const fake = provider(async (attempt) =>
        attempt < 3 ? story("You see the snag.") : story(goodStory),
      );
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      const result = await gateway.writeStuckStory({ pauseNumber: 2, facts });
      expect(result).toEqual({ source: "generated", text: goodStory });
      expect(fake.calls).toHaveLength(3);
    });

    it("test_44_ac1_every_call_returns_an_explicit_failure_and_no_stored_text", async () => {
      const logs: { source: string; reason?: string }[] = [];
      const gateway = createModelGateway({
        prompts: seedPromptSource(),
        provider: async () => {
          throw new Error("network down");
        },
        log: (event) => logs.push(event),
      });
      const results = [
        await gateway.splitPlan({ goal, totalMinutes: 25, splitFiner: false }),
        await gateway.writeStepCards({ minutes: 25, facts }),
        await gateway.writeStuckStory({ pauseNumber: 1, facts }),
        await gateway.writeRestReply({ userMessage, facts }),
        await gateway.writeReturnPopup({ trigger: "absence", facts, awayMinutes: 90 }),
      ];
      for (const result of results) {
        expect(result).toEqual({ source: "failed", reason: "request" });
      }
      expect(logs.map((event) => [event.source, event.reason])).toEqual(
        Array.from({ length: 5 }, () => ["failed", "request"]),
      );
    });

    it("test_44_ac1_the_gateway_holds_no_stored_user_visible_lines", () => {
      const gatewayDir = path.join(root, "src/lib/model-gateway");
      expect(readdirSync(gatewayDir)).not.toContain("fallbacks.ts");
      const source = readdirSync(gatewayDir)
        .map((name) => readFileSync(path.join(gatewayDir, name), "utf8"))
        .join("\n");
      expect(source).not.toMatch(/"authored"/);
      expect(source).not.toContain("I keep at the work in front of me");
    });

    it("test_44_ac2_similarity_is_the_content_word_jaccard_index", () => {
      expect(similarity("I fold the map.", "I fold the map.")).toBe(1);
      expect(similarity("I fold the old map.", "My map is old.")).toBeCloseTo(2 / 3);
      expect(similarity("I fold the map.", "My pencil is blunt.")).toBe(0);
      expect(similarity("I am.", "I am.")).toBe(0);
    });

    it("test_44_ac2_rejects_an_exact_repeat_of_any_earlier_line", () => {
      const earlier = ["I fold the map twice.", "A", "B", "C", "D", "E"].map((line, index) =>
        index === 0 ? line : `Line number ${line} sits in my notebook.`,
      );
      expect(checkRunList("I fold the map twice.", earlier)).toContain("repeat");
      expect(checkRunList("i fold  the map twice", earlier)).toContain("repeat");
    });

    it("test_44_ac2_rejects_a_three_word_opening_shared_with_the_last_four_lines", () => {
      const earlier = [
        "I keep the gate shut tight.",
        "Wind rattles my window.",
        "Dust settles on my desk.",
        "Ink stains my thumb.",
        "Coffee cools in my cup.",
      ];
      expect(checkRunList("Coffee cools in the pot beside me.", earlier)).toContain("opening");
      expect(checkRunList("I keep the papers flat beside me.", earlier)).not.toContain("opening");
    });

    it("test_44_ac2_rejects_a_line_with_similarity_of_half_or_more", () => {
      const earlier = ["My boots are wet from the river crossing."];
      expect(checkRunList("The river crossing left my boots wet.", earlier)).toContain("similar");
      expect(checkRunList("Fresh bread waits on my plate.", earlier)).toEqual([]);
    });

    it("test_44_ac2_the_gateway_checks_lines_against_the_run_and_against_each_other", async () => {
      const repeat = "I am held on a small snag in my work.";
      const fake = provider(async () => story(repeat));
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      const result = await gateway.writeStuckStory({
        pauseNumber: 1,
        facts,
        earlierLines: [repeat],
      });
      expect(result).toEqual({ source: "failed", reason: "checks" });
      expect(fake.calls[1]).toMatch(/already shown/i);

      const cards = await createModelGateway({
        prompts: seedPromptSource(),
        provider: async () => JSON.stringify({ cards: [card, card] }),
      }).writeStepCards({ minutes: 25, facts });
      expect(cards).toEqual({ source: "failed", reason: "checks" });

      const popup = await createModelGateway({
        prompts: seedPromptSource(),
        provider: async () => returnJson,
      }).writeReturnPopup({
        trigger: "rest",
        facts,
        awayMinutes: 5,
        earlierLines: [JSON.parse(returnJson).returnLine as string],
      });
      expect(popup).toEqual({ source: "failed", reason: "checks" });
    });

    it("test_44_ac3_card_nouns_uses_the_words_after_a_determiner", () => {
      expect(cardNouns("I keep the papers flat on the table. My old lamp hums.")).toEqual([
        "paper",
        "flat",
        "table",
        "old",
        "lamp",
      ]);
    });

    it("test_44_ac3_a_rest_moment_may_not_reuse_the_nouns_of_the_last_card", async () => {
      const lastCard = "I keep the papers flat on the table.";
      const reuse = "My table wobbles under my elbow.";
      const fresh = "My pencil snapped at the tip.";
      const fake = provider(async (attempt) => story(attempt === 1 ? reuse : fresh));
      const gateway = createModelGateway({ prompts: seedPromptSource(), provider: fake.impl });
      const result = await gateway.writeStuckStory({ pauseNumber: 1, facts, lastCard });
      expect(result).toEqual({ source: "generated", text: fresh });
      expect(fake.calls[1]).toMatch(/last card/i);
    });

    it("test_44_ac4_a_line_is_checked_before_it_is_returned_and_never_after", async () => {
      const rejected = "I keep the papers flat on the table.";
      const gateway = createModelGateway({
        prompts: seedPromptSource(),
        provider: async () => story(rejected),
      });
      const result = await gateway.writeStuckStory({
        pauseNumber: 1,
        facts,
        earlierLines: [rejected],
      });
      expect(result.source).toBe("failed");
      expect(JSON.stringify(result)).not.toContain(rejected);
    });
  });
});
