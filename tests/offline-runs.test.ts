import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createModelGateway } from "@/lib/model-gateway";
import type { GatewayAttempt } from "@/lib/model-gateway";
import {
  BudgetStop,
  createBudget,
  DEFAULT_MAX_CALLS,
  DEFAULT_MAX_COST_USD,
  meteredFetch,
} from "@/lib/offline-runs/budget";
import { pauseMeasures, restMeasures, splitMeasures } from "@/lib/offline-runs/metrics";
import { choosePrices } from "@/lib/offline-runs/prices";
import {
  evaluate,
  parseCsv,
  renderReport,
  toCsv,
  type RunResults,
  type TargetsFile,
} from "@/lib/offline-runs/report";
import { rescore, runOffline, type RunInputs } from "@/lib/offline-runs/run";
import {
  readTimes,
  runPauseSuite,
  runRestSuite,
  runSplitSuite,
  type GoalLinesInput,
  type PauseRunsInput,
  type RestMessagesInput,
} from "@/lib/offline-runs/suites";
import { NO_SHEETS } from "@/lib/offline-runs/scoring";
import { unitGatewayFactory } from "@/lib/offline-runs/unit";
import { stubAnswer } from "../e2e/support/stub-cards.mjs";
import { STUB_ENV, stubFetch } from "../scripts/offline-runs/stub-fetch.mjs";
import { parseArgs, STOP_SIGNALS } from "../scripts/offline-runs/run.mjs";
import {
  childEnv,
  confirmationGiven,
  issueConfirmation,
} from "../scripts/offline-runs/confirm.mjs";
import { seedContent } from "./support/seed-content";
import { seedPromptSource, seedRows } from "./support/seed-prompts";

// #42 (US-AI-12): offline test runs with the real prompts. Proved with the stub model only; no
// test reaches a network or a real model.

const root = path.join(import.meta.dirname, "..");
const data = (name: string) =>
  JSON.parse(readFileSync(path.join(root, "scripts", "offline-runs", "data", name), "utf8"));
const prices = { inputPerMillion: 0.75, outputPerMillion: 3.75, source: "test" };

function deps(
  answer?: (prompt: string) => string,
  budget = createBudget({ maxCalls: 10_000, maxCostUsd: 100, prices }),
) {
  return {
    content: seedContent(),
    budget,
    concurrency: 2,
    env: STUB_ENV,
    gatewayFor: unitGatewayFactory({
      env: STUB_ENV,
      fetchImpl: stubFetch(answer) as typeof fetch,
      prompts: seedPromptSource(),
      budget,
    }),
  };
}

const isStuck = (prompt: string) => prompt.startsWith('Return JSON only: {"prop"');
const isRest = (prompt: string) => prompt.startsWith('Return JSON only: {"reply"');
const isSplit = (prompt: string) => prompt.startsWith("You split one goal");

describe("the input sets are test data in the reworded shape", () => {
  it("test_us_ai_12_ac1_four_stories_twenty_runs_five_pauses_two_arms", () => {
    const pause = data("pause-runs.json") as PauseRunsInput & { testData: boolean };
    expect(pause.testData).toBe(true);
    expect(pause.stories).toHaveLength(4);
    expect(pause.runsPerStory).toBe(20);
    expect(pause.pausesPerRun).toBe(5);
    expect(pause.arms).toEqual(["on", "off"]);
    const content = seedContent();
    for (const id of pause.stories) {
      expect(content.stories.find((story) => story.id === id)?.inputs.scene, id).toBeTruthy();
    }
  });

  it("test_us_ai_12_ac2_sixty_messages_in_six_groups_at_three_positions", () => {
    const rest = data("rest-messages.json") as RestMessagesInput & { testData: boolean };
    expect(rest.testData).toBe(true);
    expect(rest.messages).toHaveLength(60);
    const groups = new Map<string, number>();
    for (const message of rest.messages)
      groups.set(message.group, (groups.get(message.group) ?? 0) + 1);
    expect([...groups.values()]).toEqual([10, 10, 10, 10, 10, 10]);
    expect(rest.positions).toHaveLength(3);
    expect(rest.messages.length * rest.positions.length).toBe(180);
    // English only (L1): no CJK characters.
    expect(rest.messages.some((message) => /[぀-鿿]/.test(message.text))).toBe(false);
  });

  it("test_us_ai_12_ac3_sixty_to_eighty_english_goal_lines_with_ambiguous_times", () => {
    const split = data("goal-lines.json") as GoalLinesInput & { testData: boolean };
    expect(split.testData).toBe(true);
    expect(split.lines.length).toBeGreaterThanOrEqual(60);
    expect(split.lines.length).toBeLessThanOrEqual(80);
    expect(split.runsPerLine).toBe(3);
    expect(split.lines.filter((line) => line.ambiguous).length).toBeGreaterThanOrEqual(15);
    expect(split.lines.every((line) => line.kind && line.id)).toBe(true);
    expect(new Set(split.lines.map((line) => line.id)).size).toBe(split.lines.length);
  });

  it("test_us_ai_12_ac4_targets_are_one_file_marked_proposed_with_story_and_issue", () => {
    const targets = data("targets.json") as TargetsFile;
    expect(targets.status).toBe("proposed, not owner-approved");
    expect(new Set(targets.targets.map((target) => target.id)).size).toBe(targets.targets.length);
    const stories = { pause: ["US-AI-3", 56], rest: ["US-AI-6", 59], split: ["US-AI-1", 40] };
    for (const target of targets.targets) {
      expect([target.story, target.issue], target.id).toEqual(stories[target.suite]);
      expect(["max", "below", "min", "above", "equal"]).toContain(target.kind);
    }
  });
});

describe("the gateway reports every attempt", () => {
  it("test_us_ai_12_on_attempt_lists_the_rules_of_each_attempt", async () => {
    const attempts: GatewayAttempt[] = [];
    const answers = [
      "no json",
      JSON.stringify({
        title: "Read",
        steps: [{ title: "Read", description: "Read it", minutes: 30 }],
      }),
    ];
    const gateway = createModelGateway({
      prompts: seedPromptSource(),
      provider: async () => answers.shift() ?? "",
      onAttempt: (event) => attempts.push(event),
    });
    const result = await gateway.splitPlan({
      goal: "Read the paper",
      totalMinutes: 30,
      splitFiner: false,
    });
    expect(result.source).toBe("generated");
    expect(attempts).toEqual([
      { call: "plan_split", attempt: 1, rejectedRules: ["parse"] },
      { call: "plan_split", attempt: 2, rejectedRules: [] },
    ]);
  });
});

describe("AC1: the stuck moments", () => {
  const input: PauseRunsInput = {
    runsPerStory: 2,
    pausesPerRun: 5,
    arms: ["on", "off"],
    stories: ["site-search"],
  };

  it("test_us_ai_12_ac1_runs_five_pauses_per_run_in_both_arms_with_two_calls", async () => {
    const records = await runPauseSuite(input, deps());
    expect(records).toHaveLength(20);
    const on = records.filter((record) => record.arm === "on");
    const off = records.filter((record) => record.arm === "off");
    expect(on.map((record) => record.pause)).toEqual([1, 2, 3, 4, 5, 1, 2, 3, 4, 5]);
    // On: the code picks the category, never one of the last two of the run.
    const shownOn = on.filter((record) => record.status === "ok");
    expect(shownOn.length).toBeGreaterThan(0);
    expect(shownOn.every((record) => record.category && record.prop)).toBe(true);
    const run = shownOn.filter((record) => record.run === 1).map((record) => record.category);
    for (let index = 2; index < run.length; index += 1) {
      expect(run.slice(index - 2, index)).not.toContain(run[index]);
    }
    // Off: nothing offered.
    expect(off.every((record) => record.category === undefined)).toBe(true);
    for (const record of records.filter((item) => item.status === "ok")) {
      expect(record.calls.map((call) => call.call)).toEqual(["stuck_story", "pause_predicament"]);
      expect(record.inputTokens).toBeGreaterThan(0);
    }
    const measures = pauseMeasures(records, "on");
    expect(measures.messages.value).toBe(10);
    expect(measures.worried_from_third.of).toBeGreaterThan(0);
  });

  it("test_us_ai_12_ac1_counts_event_verbs_repeats_retries_and_failure_messages", async () => {
    let first = true;
    const eventOnce = (prompt: string) => {
      if (isStuck(prompt) && first) {
        first = false;
        return JSON.stringify({ prop: "notebook", story: "A man arrives and tells him the news." });
      }
      return stubAnswer(prompt) as string;
    };
    const withEvent = await runPauseSuite(
      { ...input, runsPerStory: 1, arms: ["on"], pausesPerRun: 1 },
      deps(eventOnce),
    );
    const measures = pauseMeasures(withEvent, "on");
    expect(measures.event_first_attempt.count).toBe(1);
    expect(measures.retry_rate.count).toBe(1);
    expect(measures.failure_rate.count).toBe(0);

    const alwaysBad = (prompt: string) =>
      isStuck(prompt) ? "not json" : (stubAnswer(prompt) as string);
    const failed = await runPauseSuite(
      { ...input, runsPerStory: 1, arms: ["on"], pausesPerRun: 2 },
      deps(alwaysBad),
    );
    expect(
      failed.every((record) => record.status === "failed" && record.failedReason === "checks"),
    ).toBe(true);
    expect(pauseMeasures(failed, "on").failure_rate.value).toBe(1);

    // The same message twice in a run counts as a repeat on the first attempt.
    let firstStuck: string | undefined;
    const same = (prompt: string) => {
      if (!isStuck(prompt)) return stubAnswer(prompt) as string;
      firstStuck ??= stubAnswer(prompt) as string;
      return firstStuck;
    };
    const repeats = await runPauseSuite(
      { ...input, runsPerStory: 1, arms: ["off"], pausesPerRun: 2 },
      deps(same),
    );
    expect(pauseMeasures(repeats, "off").repeat_first_attempt.count).toBeGreaterThan(0);
  });
});

describe("AC2: the rest conversation", () => {
  const input: RestMessagesInput = {
    story: "site-search",
    positions: [
      { stepIndex: 0, stepCount: 4 },
      { stepIndex: 1, stepCount: 4 },
      { stepIndex: 3, stepCount: 4 },
    ],
    messages: [
      { id: "his_world.01", group: "his_world", text: "What's the canyon like?" },
      { id: "work.01", group: "work", text: "I can't start my essay." },
    ],
  };

  it("test_us_ai_12_ac2_records_replies_retries_advising_latency_and_cost", async () => {
    let first = true;
    const adviceOnce = (prompt: string) => {
      if (isRest(prompt) && first) {
        first = false;
        return JSON.stringify({ reply: "You should take a break and start small." });
      }
      return stubAnswer(prompt) as string;
    };
    const records = await runRestSuite(input, { ...deps(adviceOnce), concurrency: 1 });
    expect(records).toHaveLength(6);
    expect(records.every((record) => record.status === "ok" && record.reply)).toBe(true);
    const measures = restMeasures(records);
    expect(measures.advising_first_attempt.count).toBe(1);
    expect(measures.retry_rate.count).toBe(1);
    expect(measures.leaks.value).toBe(0);
    expect(measures.latency_p95.value).not.toBeNull();
    expect(records.every((record) => record.outputTokens > 0)).toBe(true);
  });

  it("test_us_ai_12_ac2_a_message_the_keyword_layer_stops_makes_no_model_call", async () => {
    const budget = createBudget({ maxCalls: 100, maxCostUsd: 100, prices });
    const records = await runRestSuite(
      {
        ...input,
        positions: [input.positions[0]],
        messages: [{ id: "x", group: "feelings", text: "I want to kill myself" }],
      },
      deps(undefined, budget),
    );
    expect(records[0].status).toBe("keyword_stop");
    expect(budget.snapshot().calls).toBe(0);
  });
});

describe("AC3: the split", () => {
  const input: GoalLinesInput = {
    runsPerLine: 3,
    defaultMinutes: 30,
    lines: [
      {
        id: "g1",
        goal: "Study chemistry for one hour",
        kind: "take_in",
        expectedMinutes: 60,
        ambiguous: false,
      },
      {
        id: "g2",
        goal: "Watch a 2-hour lecture on statistics",
        kind: "take_in",
        expectedMinutes: null,
        ambiguous: true,
      },
      { id: "g3", goal: "Tidy my room", kind: "chore", expectedMinutes: null, ambiguous: false },
    ],
  };

  it("test_us_ai_12_ac3_runs_each_line_three_times_and_reads_time_locally", async () => {
    const times = readTimes(input);
    expect(times.map((time) => time.foundMinutes)).toEqual([60, null, null]);
    const records = await runSplitSuite(input, deps());
    expect(records).toHaveLength(9);
    expect(
      records
        .filter((record) => record.lineId === "g1")
        .every((record) => record.totalMinutes === 60),
    ).toBe(true);
    expect(
      records
        .filter((record) => record.lineId === "g3")
        .every((record) => record.totalMinutes === 30),
    ).toBe(true);
    const measures = splitMeasures(records, times);
    expect(measures.valid_first_attempt.value).toBe(1);
    expect(measures.time_ambiguous_wrong.value).toBe(0);
    expect(measures.time_stated_correct.value).toBe(1);
  });

  it("test_us_ai_12_ac3_an_invalid_first_answer_is_not_valid_on_the_first_attempt", async () => {
    let first = true;
    const badOnce = (prompt: string) => {
      if (isSplit(prompt) && first) {
        first = false;
        return "not json";
      }
      return stubAnswer(prompt) as string;
    };
    const records = await runSplitSuite(
      { ...input, lines: [input.lines[0]], runsPerLine: 1 },
      deps(badOnce),
    );
    const measures = splitMeasures(records, readTimes(input));
    expect(measures.valid_first_attempt.count).toBe(0);
    expect(measures.failure_rate.count).toBe(0);
  });
});

describe("the budget stop", () => {
  it("test_us_ai_12_budget_defaults_are_3100_calls_and_5_dollars", () => {
    expect(DEFAULT_MAX_CALLS).toBe(3_100);
    expect(DEFAULT_MAX_COST_USD).toBe(5);
  });

  it("test_us_ai_12_budget_stops_at_the_most_calls", async () => {
    const budget = createBudget({ maxCalls: 4, maxCostUsd: 100, prices });
    const records = await runSplitSuite(
      {
        runsPerLine: 3,
        defaultMinutes: 30,
        lines: [
          { id: "a", goal: "Tidy my room", kind: "chore", expectedMinutes: null, ambiguous: false },
          {
            id: "b",
            goal: "Read chapter 3",
            kind: "take_in",
            expectedMinutes: null,
            ambiguous: false,
          },
        ],
      },
      { ...deps(undefined, budget), concurrency: 1 },
    );
    expect(budget.stopped).toBe("calls");
    expect(budget.snapshot().calls).toBe(4);
    expect(records).toHaveLength(4);
  });

  it("test_us_ai_12_budget_stops_before_a_call_that_could_pass_the_cost", () => {
    // One worst-case call: 400 chars = 100 tokens in, 1024 out at $3.75 per M ≈ $0.0039.
    const budget = createBudget({ maxCalls: 100, maxCostUsd: 0.005, prices });
    const ticket = budget.reserve(400);
    budget.settle(ticket, { inputTokens: 100, outputTokens: 500, estimated: false });
    expect(() => budget.reserve(400)).toThrow(BudgetStop);
    expect(budget.stopped).toBe("cost");
    expect(budget.snapshot().calls).toBe(1);
  });

  it("test_us_ai_12_metered_fetch_uses_the_provider_usage_or_estimates", async () => {
    const budget = createBudget({ maxCalls: 10, maxCostUsd: 10, prices });
    const body = JSON.stringify({ messages: [{ content: "x".repeat(40) }] });
    const withUsage = meteredFetch(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "hi" } }],
            usage: { prompt_tokens: 7, completion_tokens: 3 },
          }),
        ),
      budget,
    );
    await withUsage("http://stub.invalid", { method: "POST", body });
    const without = meteredFetch(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "x".repeat(8) } }] })),
      budget,
    );
    await without("http://stub.invalid", { method: "POST", body });
    const snapshot = budget.snapshot();
    expect(snapshot.inputTokens).toBe(7 + 10);
    expect(snapshot.outputTokens).toBe(3 + 2);
    expect(snapshot.estimatedUsageCalls).toBe(1);
  });
});

describe("AC4: results against the targets", () => {
  const targets = data("targets.json") as TargetsFile;
  const inputs: RunInputs = {
    pause: { runsPerStory: 1, pausesPerRun: 3, arms: ["on", "off"], stories: ["site-search"] },
    rest: {
      ...(data("rest-messages.json") as RestMessagesInput),
      messages: (data("rest-messages.json") as RestMessagesInput).messages.slice(0, 2),
      positions: [{ stepIndex: 0, stepCount: 4 }],
    },
    split: {
      ...(data("goal-lines.json") as GoalLinesInput),
      lines: (data("goal-lines.json") as GoalLinesInput).lines.slice(0, 3),
      runsPerLine: 1,
    },
    targets,
  };

  it("test_us_ai_12_ac4_end_to_end_with_the_stub_writes_report_sheets_and_results", async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "wp-offline-"));
    const results = await runOffline({
      mode: "stub",
      suites: ["split", "rest", "pause"],
      env: STUB_ENV,
      fetchImpl: stubFetch() as typeof fetch,
      content: seedContent(),
      promptRows: seedRows(),
      inputs,
      maxCalls: 2_600,
      maxCostUsd: 5,
      prices,
      concurrency: 2,
      outDir,
    });
    for (const file of [
      "results.json",
      "report.md",
      "scoring-rest.csv",
      "scoring-pause.csv",
      "targets.json",
    ]) {
      expect(existsSync(path.join(outDir, file)), file).toBe(true);
    }
    expect(results.meta.prompts.find((prompt) => prompt.key === "plan_split")?.version).toBe(2);
    const report = readFileSync(path.join(outDir, "report.md"), "utf8");
    // The summary table comes first, after the title and the test-data line.
    expect(report.indexOf("## Summary")).toBeLessThan(report.indexOf("## All measures"));
    expect(report).toContain("TEST DATA");
    expect(report).toContain("proposed, not owner-approved");
    expect(report).toContain("| PENDING SCORING | US-AI-6 | #59 | `rest.relevance`");
    // The scoring sheet has blank columns for relevance, in-character and advising.
    const sheet = parseCsv(readFileSync(path.join(outDir, "scoring-rest.csv"), "utf8"));
    expect(sheet).toHaveLength(2);
    expect(
      sheet.every((row) => row.relevance === "" && row.in_character === "" && row.advising === ""),
    ).toBe(true);

    // Scoring: filled sheets turn the person measures into PASS or FAIL.
    writeFileSync(
      path.join(outDir, "scoring-rest.csv"),
      toCsv(
        Object.keys(sheet[0]),
        sheet.map((row, at) => ({
          ...row,
          relevance: at === 0 ? "5" : "2",
          in_character: "yes",
          advising: "no",
        })),
      ),
    );
    const pauseSheet = parseCsv(readFileSync(path.join(outDir, "scoring-pause.csv"), "utf8"));
    writeFileSync(
      path.join(outDir, "scoring-pause.csv"),
      toCsv(
        Object.keys(pauseSheet[0] ?? { id: "" }),
        pauseSheet.map((row) => ({ ...row, event: "no" })),
      ),
    );
    const scored = rescore(outDir);
    expect(scored).toContain("| FAIL | US-AI-6 | #59 | `rest.relevance`");
    expect(scored).toContain("| PASS | US-AI-6 | #59 | `rest.in_character`");
    expect(scored).toContain("Failed: ");
  });

  it("test_us_ai_12_ac4_each_target_is_pass_or_fail_against_its_kind", () => {
    const empty: RunResults = {
      meta: {
        mode: "stub",
        model: "stub",
        startedAt: "2026-11-24T00:00:00Z",
        endedAt: "2026-11-24T00:00:00Z",
        suites: ["split"],
        prompts: [],
        promptSource: "test",
        testData: true,
        incomplete: null,
      },
      budget: createBudget({ maxCalls: 1, maxCostUsd: 1, prices }).snapshot(),
      pause: [],
      rest: [],
      split: [],
      times: [
        {
          lineId: "a",
          goal: "Watch a 2-hour lecture",
          ambiguous: true,
          expectedMinutes: null,
          foundMinutes: 120,
        },
        {
          lineId: "b",
          goal: "Study for one hour",
          ambiguous: false,
          expectedMinutes: 60,
          foundMinutes: 60,
        },
      ],
    };
    const rows = evaluate(empty, targets, NO_SHEETS);
    const status = (id: string) => rows.find((row) => row.id === id)?.status;
    expect(status("split.time_ambiguous_wrong")).toBe("FAIL");
    expect(status("split.time_stated_correct")).toBe("PASS");
    expect(status("split.valid_first_attempt")).toBe("NO DATA");
    expect(status("rest.relevance")).toBe("NO DATA");
    const report = renderReport(empty, targets, NO_SHEETS);
    expect(report).toContain("`split.time_ambiguous_wrong` (US-AI-1, #40)");
  });
});

describe("the runner settings", () => {
  it("test_us_ai_12_runner_defaults_to_the_stub_and_confirm_is_never_a_setting", () => {
    expect(parseArgs([])).toEqual({ settings: { OFFLINE_RUN_MODE: "stub" }, confirm: false });
    expect(parseArgs(["--real", "--confirm", "--max-calls", "100", "--max-cost", "2"])).toEqual({
      settings: {
        OFFLINE_RUN_MODE: "real",
        OFFLINE_RUN_MAX_CALLS: "100",
        OFFLINE_RUN_MAX_COST_USD: "2",
      },
      confirm: true,
    });
    expect(() => parseArgs(["--max-cost"])).toThrow();
    expect(() => parseArgs(["--nope"])).toThrow();
  });

  it("test_us_ai_12_i1_confirmation_from_the_environment_is_dropped_and_refused", () => {
    // An OFFLINE_RUN_CONFIRM from the shell or .env never reaches the runner.
    const env = childEnv(
      {
        OFFLINE_RUN_CONFIRM: "1",
        OFFLINE_RUN_CONFIRM_FILE: "/tmp/x",
        MODEL_API_KEY: "k",
        PATH: "p",
      },
      { OFFLINE_RUN_MODE: "real" },
    );
    expect(env).toEqual({ MODEL_API_KEY: "k", PATH: "p", OFFLINE_RUN_MODE: "real" });
    // And a value alone is refused by the runner's guard.
    expect(confirmationGiven({ OFFLINE_RUN_CONFIRM: "1" })).toBe(false);
    expect(confirmationGiven({ OFFLINE_RUN_CONFIRM: "a".repeat(64) })).toBe(false);
    const issued = issueConfirmation(mkdtempSync(path.join(tmpdir(), "wp-confirm-")));
    expect(confirmationGiven(issued.settings)).toBe(true);
    // Reading the token consumes it (#420): the same token never opens a second run.
    expect(existsSync(issued.settings.OFFLINE_RUN_CONFIRM_FILE)).toBe(false);
    expect(confirmationGiven(issued.settings)).toBe(false);
    issued.cleanup();
  });

  it("test_420_n2_a_closed_terminal_asks_for_the_same_stop_as_ctrl_c", () => {
    expect(STOP_SIGNALS).toEqual(["SIGINT", "SIGTERM", "SIGHUP"]);
  });

  it("test_us_ai_12_i1_a_real_run_with_the_env_set_but_no_flag_refuses", () => {
    // The model address is a closed local port, so nothing could reach a real model either way.
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "offline-runs", "run.mjs"), "--real", "--suite", "split"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 120_000,
        env: {
          PATH: process.env.PATH,
          OFFLINE_RUN_CONFIRM: "1",
          MODEL_API_KEY: "not-a-key",
          MODEL_API_URL: "http://127.0.0.1:9/v1/chat/completions",
          MODEL_NAME: "none",
          NODE_ENV: "test",
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("needs the flag --confirm");
  });

  it("test_us_ai_12_prices_from_settings_model_name_or_the_highest", () => {
    const config = data("../../live-generation-benchmark.config.json");
    expect(
      choosePrices(
        { OFFLINE_RUN_INPUT_PRICE_PER_M: "1", OFFLINE_RUN_OUTPUT_PRICE_PER_M: "2" },
        config,
      ),
    ).toMatchObject({ inputPerMillion: 1, outputPerMillion: 2 });
    expect(choosePrices({ MODEL_NAME: "deepseek-flash" }, config)).toMatchObject({
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
    });
    expect(choosePrices({ MODEL_NAME: "stub" }, config)).toMatchObject({
      inputPerMillion: 0.75,
      outputPerMillion: 3.75,
    });
  });
});
