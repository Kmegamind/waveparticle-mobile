import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ModelGateway, PlanSplitResult } from "@/lib/model-gateway";
import { MODEL_CALL_LIMIT, takeModelCall } from "@/lib/prototype/cost-cap";
import {
  FIRST_OPENING,
  NOT_SURE_LINE,
  PLAN_INTRO,
  READ_STATUS,
  RETURNING_OPENINGS,
  SPLIT_QUESTION,
  TIME_QUESTION,
  SPLIT_FAILED_TITLE,
  splitFailedLine,
  timeQuestionSlip,
  classifyGoalShape,
  pickReturningOpening,
  reactionFor,
  REACTIONS,
} from "@/lib/prototype/goal-lines";
import {
  TIME_HINT,
  findTimeInGoal,
  goalTimeWasCapped,
  formatMinutes,
  minutesLabel,
  parseTypedTime,
  SLIDER_MAX_MINUTES,
  SLIDER_STEP_MINUTES,
  SLIDER_ZERO_HINT,
  sliderStart,
  sliderValueText,
} from "@/lib/prototype/goal-time";
import {
  addStep,
  canRemove,
  changeMinutes,
  commitTitle,
  countLine,
  fromPlan,
  MAX_MINUTES,
  MINUTES_CEILING_HINT,
  MINUTES_FLOOR_HINT,
  moveStep,
  planTitleFor,
  setMinutes,
  removeStep,
  setDescription,
  totalMinutes,
} from "@/lib/prototype/plan-edit";
import { splitGoal, type SplitDeps } from "@/lib/prototype/split-goal";
import { SPLIT_FAILURE_TOKEN, splitWithTestData } from "@/lib/prototype/test-splitter";

const sentences = (text: string) => text.split(/(?<=[.?!])\s+/).filter(Boolean);
const words = (text: string) => text.split(/\s+/).filter(Boolean);

describe("#35 AC1 the typed time box accepts only a time", () => {
  it.each([
    ["45", 45],
    ["45 min", 45],
    ["45 minutes", 45],
    ["1.5 hours", 90],
    ["1 hour", 60],
    ["2h", 120],
    ["90", 90],
    ["50", 45],
    ["5", 15],
    ["300", 300],
  ])("reads %s as %i minutes, rounded to 15", (text, minutes) => {
    expect(parseTypedTime(text)).toBe(minutes);
  });

  it.each(["", "soon", "a while", "4", "301", "6 hours", "-30", "45 apples"])(
    "refuses %s",
    (text) => {
      expect(parseTypedTime(text)).toBeNull();
    },
  );

  it("has the hint for anything that is not a time", () => {
    expect(TIME_HINT).toBe("Type a time like 45 or 1.5 hours");
  });

  it("formats minutes for the count line and the understood time", () => {
    expect(formatMinutes(30)).toBe("30 min");
    expect(formatMinutes(60)).toBe("1 hour");
    expect(formatMinutes(90)).toBe("1 hour 30 min");
    expect(formatMinutes(120)).toBe("2 hours");
  });
});

describe("TIME-SLIDER the time slider runs from 0 to 3 hours", () => {
  it("has the range, the step and the zero hint", () => {
    expect(SLIDER_MAX_MINUTES).toBe(180);
    expect(SLIDER_STEP_MINUTES).toBe(5);
    expect(SLIDER_ZERO_HINT).toBe("Choose a time above 0");
  });

  it("starts at 0, or at an understood time capped at 3 hours", () => {
    expect(sliderStart(null)).toBe(0);
    expect(sliderStart(60)).toBe(60);
    expect(sliderStart(240)).toBe(180);
  });

  it("reads its value as words", () => {
    expect(sliderValueText(0)).toBe("No time chosen");
    expect(sliderValueText(75)).toBe("1 hour 15 min");
    expect(sliderValueText(5)).toBe("5 min");
  });
});

describe("GOAL-TIME a goal that states a length skips the time question", () => {
  it.each([
    ["study chemistry for one hour", 60],
    ["Write the report for 45 minutes", 45],
    ["read for half an hour", 30],
    ["2 hours of revision", 120],
    ["practise piano for 1.5 hours", 90],
  ])("understands %s as %i minutes", (goal, minutes) => {
    expect(findTimeInGoal(goal)).toBe(minutes);
  });

  it("#351 knows when the goal text states more than 3 hours", () => {
    expect(goalTimeWasCapped("study for 4 hours")).toBe(true);
    expect(goalTimeWasCapped("study for 3 hours")).toBe(false);
    expect(goalTimeWasCapped("study for 45 minutes")).toBe(false);
    expect(goalTimeWasCapped("finish chapter 3")).toBe(false);
  });

  it.each(["Write the methods section", "finish chapter 3", "read 20 pages"])(
    "finds no time in %s",
    (goal) => {
      expect(findTimeInGoal(goal)).toBeNull();
    },
  );
});

describe("#30 AC1 his first opening", () => {
  it("is at most three sentences and 45 words and ends with one question", () => {
    expect(sentences(FIRST_OPENING).length).toBeLessThanOrEqual(3);
    expect(words(FIRST_OPENING).length).toBeLessThanOrEqual(45);
    expect(FIRST_OPENING.trim().endsWith("?")).toBe(true);
    expect(FIRST_OPENING.match(/\?/g)).toHaveLength(1);
  });

  it("speaks from inside his situation in the canyon", () => {
    expect(FIRST_OPENING).toMatch(/canyon|Dudley|McMillan/);
  });

  it("is marked as a draft written line, not read by Yue", () => {
    expect(READ_STATUS).toBe("written");
    const source = readFileSync(
      path.join(__dirname, "..", "src/lib/prototype/goal-lines.ts"),
      "utf8",
    );
    expect(source).toContain("READ-STATUS: written");
    expect(source).toMatch(/draft prototype lines, not read by Yue/);
  });
});

describe("#30 AC2 the returning opening", () => {
  it("has at least five one-sentence questions", () => {
    expect(RETURNING_OPENINGS.length).toBeGreaterThanOrEqual(5);
    for (const line of RETURNING_OPENINGS) {
      expect(sentences(line)).toHaveLength(1);
      expect(line.endsWith("?")).toBe(true);
    }
  });

  it("never says welcome back or mentions time", () => {
    for (const line of RETURNING_OPENINGS) {
      expect(line).not.toMatch(/welcome/i);
      expect(line).not.toMatch(
        /\b(again|now|today|tonight|yesterday|days?|hours?|minutes?|while|since|ago|last)\b/i,
      );
    }
  });

  it("never repeats the previous line", () => {
    for (let previous = 0; previous < RETURNING_OPENINGS.length; previous += 1) {
      for (const random of [0, 0.2, 0.5, 0.8, 0.9999]) {
        expect(pickReturningOpening(previous, () => random)).not.toBe(previous);
      }
    }
  });

  it("picks any line when there is no previous one", () => {
    expect(pickReturningOpening(null, () => 0)).toBe(0);
    expect(pickReturningOpening(null, () => 0.9999)).toBe(RETURNING_OPENINGS.length - 1);
  });
});

describe("#34 his reaction to the shape of the Goal", () => {
  it("classifies specific, vague and very large Goals", () => {
    expect(classifyGoalShape("Write the methods section of my lab report")).toBe("specific");
    expect(classifyGoalShape("stuff")).toBe("vague");
    expect(classifyGoalShape("work on things")).toBe("vague");
    expect(classifyGoalShape("learn organic chemistry")).toBe("big");
    expect(classifyGoalShape("master the whole of calculus")).toBe("big");
  });

  it("#34 AC1 is one sentence that does not repeat the Goal's words", () => {
    const goal = "Write the methods section of my lab report";
    const line = reactionFor(classifyGoalShape(goal), () => 0);
    expect(sentences(line)).toHaveLength(1);
    for (const noun of ["methods", "section", "lab", "report"]) {
      expect(line.toLowerCase()).not.toContain(noun);
    }
  });

  it("#34 AC2 AC3 asks no follow-up question for a vague or very large Goal", () => {
    for (const shape of ["vague", "big", "specific"] as const) {
      for (const line of REACTIONS[shape]) {
        expect(line).not.toContain("?");
        expect(sentences(line)).toHaveLength(1);
      }
    }
  });

  it("#34 AC4 contains no encouragement, diagnosis or method", () => {
    const all = Object.values(REACTIONS).flat();
    for (const line of all) {
      expect(line).not.toMatch(
        /!|great|good job|you can|you've got|don't worry|sounds like you|try to|start by|first,|break it/i,
      );
    }
  });
});

describe("#35 the time lines", () => {
  it("asks how long in one question", () => {
    expect(TIME_QUESTION.match(/\?/g)).toHaveLength(1);
  });

  it("#35 AC2 Not sure sets 30 minutes with one short reason and no comfort", () => {
    expect(NOT_SURE_LINE).toMatch(/thirty minutes|30 min/i);
    expect(sentences(NOT_SURE_LINE).length).toBeLessThanOrEqual(2);
    expect(NOT_SURE_LINE).not.toMatch(/worry|okay|fine|it's alright|no problem/i);
  });

  it("#235 AC1 his reaction and the time question share one slip", () => {
    expect(REACTIONS.specific[0]).toBe("That has a clear edge to it.");
    expect(timeQuestionSlip("That has a clear edge to it.")).toBe(
      "That has a clear edge to it. How long do you have?",
    );
  });

  it("#235 Not sure reads as the prototype", () => {
    expect(NOT_SURE_LINE).toBe("Then thirty minutes. Long enough to start, short enough to keep.");
  });

  it("#236 AC1 a time answer reads N min", () => {
    expect(minutesLabel(60)).toBe("60 min");
    expect(minutesLabel(95)).toBe("95 min");
  });
});

describe("#33 AC1 the split question and #36 the plan introduction", () => {
  it("asks one question about finer Steps", () => {
    expect(SPLIT_QUESTION.match(/\?/g)).toHaveLength(1);
  });

  it("keeps the line about arguing in ink", () => {
    expect(PLAN_INTRO.toLowerCase()).toContain("argue with it now, in ink, where it’s cheap");
  });

  it("#236 AC1 #237 AC5 the split question and the plan introduction read as the prototype", () => {
    expect(SPLIT_QUESTION).toBe("Do you want it cut fine, or kept in a few broad pieces?");
    expect(PLAN_INTRO).toBe(
      "Here is how I would cut it. Argue with it now, in ink, where it’s cheap.",
    );
  });

  it("GD-F the failed split keeps the goal in words", () => {
    expect(SPLIT_FAILED_TITLE).toBe("That one wouldn’t split.");
    expect(splitFailedLine("Methods")).toBe("Nothing is lost. Your words are kept: “Methods”.");
  });

  it("NO-STEP-COUNT none of his lines states a number of Steps", () => {
    const all = [FIRST_OPENING, ...RETURNING_OPENINGS, TIME_QUESTION, SPLIT_QUESTION, PLAN_INTRO];
    for (const line of all) expect(line).not.toMatch(/\d+\s+steps?\b/i);
  });
});

describe("#39 the test-data splitter (used only when no model keys are set)", () => {
  it("#39 AC1 gives each Step a title and a one or two sentence description", () => {
    const plan = splitWithTestData({
      goal: "Write the report",
      totalMinutes: 60,
      splitFiner: false,
    });
    expect(plan.source).toBe("test-data");
    for (const step of plan.steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(sentences(step.description).length).toBeGreaterThanOrEqual(1);
      expect(sentences(step.description).length).toBeLessThanOrEqual(2);
    }
  });

  it.each([30, 45, 60, 120, 300])("uses 15-minute units that add up to %i", (total) => {
    for (const splitFiner of [false, true]) {
      const plan = splitWithTestData({ goal: "Write the report", totalMinutes: total, splitFiner });
      expect(plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(total);
      plan.steps.forEach((step) => expect(step.minutes % 15).toBe(0));
    }
  });

  it.each([5, 20, 95, 175])(
    "TIME-SLIDER adds up to a slider time of %i that is not a multiple of 15",
    (total) => {
      for (const splitFiner of [false, true]) {
        const plan = splitWithTestData({
          goal: "Write the report",
          totalMinutes: total,
          splitFiner,
        });
        expect(plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(total);
        plan.steps.forEach((step) => expect(step.minutes).toBeGreaterThanOrEqual(1));
      }
    },
  );

  it("#33 AC2 Split it finer gives more Steps than Keep it broad", () => {
    const broad = splitWithTestData({ goal: "Write", totalMinutes: 60, splitFiner: false });
    const finer = splitWithTestData({ goal: "Write", totalMinutes: 60, splitFiner: true });
    expect(finer.steps.length).toBeGreaterThan(broad.steps.length);
  });

  it("names the Goal from the user's words", () => {
    expect(
      splitWithTestData({ goal: "  Write the report ", totalMinutes: 30, splitFiner: false }).title,
    ).toBe("Write the report");
  });

  it("fails on the test-only failure token", () => {
    expect(() =>
      splitWithTestData({
        goal: `Write ${SPLIT_FAILURE_TOKEN}`,
        totalMinutes: 30,
        splitFiner: false,
      }),
    ).toThrow();
  });
});

describe("cost cap: real model calls per browser per day", () => {
  it(`allows ${MODEL_CALL_LIMIT} calls a day and refuses the next`, () => {
    expect(MODEL_CALL_LIMIT).toBe(20);
    let cookie: string | undefined;
    for (let call = 0; call < MODEL_CALL_LIMIT; call += 1) {
      const result = takeModelCall(cookie, "2026-11-12");
      expect(result.allowed).toBe(true);
      if (result.allowed) cookie = result.cookie;
    }
    expect(takeModelCall(cookie, "2026-11-12").allowed).toBe(false);
  });

  it("starts again on a new day and ignores a broken cookie", () => {
    expect(takeModelCall("2026-11-12:20", "2026-11-13")).toEqual({
      allowed: true,
      cookie: "2026-11-13:1",
    });
    expect(takeModelCall("junk", "2026-11-12")).toEqual({
      allowed: true,
      cookie: "2026-11-12:1",
    });
  });
});

function fakeGateway(result: () => Promise<PlanSplitResult>): ModelGateway {
  return { splitPlan: vi.fn(result) } as unknown as ModelGateway;
}

const keys = { MODEL_API_KEY: "k", MODEL_API_URL: "https://model.invalid", MODEL_NAME: "m" };

function deps(overrides: Partial<SplitDeps> = {}): SplitDeps & { written: string[] } {
  const written: string[] = [];
  return {
    env: {},
    today: "2026-11-12",
    readCounter: () => undefined,
    writeCounter: (value) => void written.push(value),
    written,
    ...overrides,
  };
}

const generated: PlanSplitResult = {
  source: "generated",
  title: "Report",
  steps: [
    { title: "Outline", description: "List the sections.", minutes: 15 },
    { title: "Draft", description: "Write the methods.", minutes: 15 },
  ],
};

describe("split server logic", () => {
  const input = { goal: "Write the report", totalMinutes: 30, splitFiner: false };

  it("uses labelled test data when the model keys are not set", async () => {
    const result = await splitGoal(input, deps());
    expect(result.status).toBe("plan");
    if (result.status === "plan") expect(result.plan.source).toBe("test-data");
  });

  it("SLIDER-RANGE refuses more than the slider's maximum and accepts exactly the maximum", async () => {
    const gateway = fakeGateway(async () => generated);
    const over = deps({ env: keys, createGateway: () => gateway });
    expect(await splitGoal({ ...input, totalMinutes: SLIDER_MAX_MINUTES + 1 }, over)).toEqual({
      status: "failed",
    });
    expect(gateway.splitPlan).not.toHaveBeenCalled();
    expect(over.written).toEqual([]);
    const result = await splitGoal({ ...input, totalMinutes: SLIDER_MAX_MINUTES }, deps());
    expect(result.status).toBe("plan");
  });

  it("calls the model gateway when the keys are set and counts the call", async () => {
    const gateway = fakeGateway(async () => generated);
    const d = deps({ env: keys, createGateway: () => gateway });
    const result = await splitGoal(input, d);
    expect(result).toEqual({ status: "plan", plan: generated });
    expect(gateway.splitPlan).toHaveBeenCalledWith(input);
    expect(d.written).toEqual(["2026-11-12:1"]);
  });

  it("#38 AC3 treats a stored fallback plan as a failure", async () => {
    // A stored fallback is no longer in the gateway's types (#219), but the answer is untyped
    // at runtime, so an unexpected source must still count as a failure.
    const gateway = fakeGateway(
      async () => ({ ...generated, source: "authored" }) as unknown as PlanSplitResult,
    );
    const result = await splitGoal(input, deps({ env: keys, createGateway: () => gateway }));
    expect(result).toEqual({ status: "failed" });
  });

  it("#38 AC1 treats a thrown error or an invalid plan as a failure", async () => {
    const thrown = fakeGateway(async () => {
      throw new Error("down");
    });
    expect(await splitGoal(input, deps({ env: keys, createGateway: () => thrown }))).toEqual({
      status: "failed",
    });
    const wrongSum = fakeGateway(async () => ({
      ...generated,
      steps: [{ title: "Outline", description: "List.", minutes: 10 }],
    }));
    expect(await splitGoal(input, deps({ env: keys, createGateway: () => wrongSum }))).toEqual({
      status: "failed",
    });
  });

  it("refuses beyond the daily cap without calling the model", async () => {
    const gateway = fakeGateway(async () => generated);
    const result = await splitGoal(
      input,
      deps({ env: keys, createGateway: () => gateway, readCounter: () => "2026-11-12:20" }),
    );
    expect(result).toEqual({ status: "failed" });
    expect(gateway.splitPlan).not.toHaveBeenCalled();
  });

  it("a crisis goal never reaches the model", async () => {
    const gateway = fakeGateway(async () => generated);
    const d = deps({ env: keys, createGateway: () => gateway });
    const result = await splitGoal({ ...input, goal: "I want to kill myself" }, d);
    expect(result).toEqual({ status: "crisis" });
    expect(gateway.splitPlan).not.toHaveBeenCalled();
    expect(d.written).toEqual([]);
  });

  it("the failure token fails the test-data split", async () => {
    expect(await splitGoal({ ...input, goal: `Write ${SPLIT_FAILURE_TOKEN}` }, deps())).toEqual({
      status: "failed",
    });
  });

  it("rejects input that is not a Goal and a time", async () => {
    expect(await splitGoal({ ...input, goal: "   " }, deps())).toEqual({ status: "failed" });
    expect(await splitGoal({ ...input, totalMinutes: 0 }, deps())).toEqual({ status: "failed" });
    expect(await splitGoal({ ...input, totalMinutes: 301 }, deps())).toEqual({
      status: "failed",
    });
  });

  it("never logs the goal text", async () => {
    const spies = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
    ];
    const thrown = fakeGateway(async () => {
      throw new Error("down");
    });
    await splitGoal(
      { ...input, goal: "secret goal words" },
      deps({ env: keys, createGateway: () => thrown }),
    );
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain("secret");
      spy.mockRestore();
    }
  });
});

describe("#37 editing the Plan", () => {
  const start = () =>
    fromPlan([
      { title: "Outline", description: "List the sections.", minutes: 15 },
      { title: "Draft", description: "Write it.", minutes: 30 },
    ]);

  it("#37 AC1 #249 AC1 changes the title, the description and the minutes in steps of 5", () => {
    let steps = start();
    const id = steps[0].id;
    steps = commitTitle(steps, id, "Plan the sections");
    steps = setDescription(steps, id, "Write the headings only.");
    steps = changeMinutes(steps, id, 5);
    expect(steps[0]).toMatchObject({
      title: "Plan the sections",
      description: "Write the headings only.",
      minutes: 20,
    });
    steps = changeMinutes(steps, id, -5);
    expect(steps[0].minutes).toBe(15);
  });

  it("#249 AC1 takes any typed whole number of minutes from 1", () => {
    const steps = start();
    const id = steps[0].id;
    for (const bad of ["", "0", "-3", "2.5", "abc"]) {
      expect(setMinutes(steps, id, bad)[0].minutes).toBe(15);
    }
    expect(setMinutes(steps, id, "7")[0].minutes).toBe(7);
    expect(setMinutes(steps, id, " 42 ")[0].minutes).toBe(42);
    expect(setMinutes(steps, id, "2000")[0].minutes).toBe(MAX_MINUTES);
  });

  it("#249 AC2 minutes never go below 1 or above 24 hours, with the reasons in words", () => {
    const steps = start();
    const id = steps[0].id;
    expect(changeMinutes(setMinutes(steps, id, "3"), id, -5)[0].minutes).toBe(1);
    expect(changeMinutes(setMinutes(steps, id, "1438"), id, 5)[0].minutes).toBe(1440);
    expect(MINUTES_FLOOR_HINT).toBe("A Step is at least 1 minute.");
    expect(MINUTES_CEILING_HINT).toBe("A Step is at most 24 hours.");
  });

  it("#237 Add a step goes after the open Step", () => {
    const steps = start();
    const added = addStep(steps, steps[0].id);
    expect(added.steps.map((step) => step.id)).toEqual([steps[0].id, added.id, steps[1].id]);
    expect(added.steps[1].minutes).toBe(15);
  });

  it("#237 AC1 an empty Goal field saves the typed goal as the title", () => {
    expect(planTitleFor("   ", "Methods section for Friday")).toBe("Methods section for Friday");
    expect(planTitleFor(" Methods ", "Methods section for Friday")).toBe("Methods");
  });

  it("#37 AC2 adds a Step with 15 minutes and removes it when its title stays empty", () => {
    const added = addStep(start());
    expect(added.steps).toHaveLength(3);
    const fresh = added.steps.find((step) => step.id === added.id)!;
    expect(fresh).toMatchObject({ title: "", minutes: 15 });
    expect(commitTitle(added.steps, added.id, "   ")).toHaveLength(2);
    expect(commitTitle(added.steps, added.id, "Check")).toHaveLength(3);
  });

  it("#37 AC3 removes a Step, and removal is not offered when one Step remains", () => {
    let steps = start();
    expect(canRemove(steps)).toBe(true);
    steps = removeStep(steps, steps[0].id);
    expect(steps.map((step) => step.title)).toEqual(["Draft"]);
    expect(canRemove(steps)).toBe(false);
    expect(removeStep(steps, steps[0].id)).toHaveLength(1);
  });

  it("#37 AC4 an emptied existing title brings the previous title back", () => {
    const steps = start();
    expect(commitTitle(steps, steps[1].id, "")[1].title).toBe("Draft");
  });

  it("#37 AC5 the total follows the edits and there is no maximum number of Steps", () => {
    let steps = start();
    for (let i = 0; i < 30; i += 1) {
      const added = addStep(steps);
      steps = commitTitle(added.steps, added.id, `Extra ${i}`);
    }
    expect(steps).toHaveLength(32);
    expect(totalMinutes(steps)).toBe(45 + 30 * 15);
  });

  it("STEP-EDIT moves a Step up or down with buttons", () => {
    const steps = start();
    expect(moveStep(steps, steps[1].id, -1).map((step) => step.title)).toEqual([
      "Draft",
      "Outline",
    ]);
    expect(moveStep(steps, steps[0].id, -1)).toEqual(steps);
  });

  it("#36 AC1 the count line names Steps and minutes, singular for one", () => {
    expect(countLine(start())).toBe("2 steps · 45 min");
    expect(countLine(fromPlan([{ title: "A", description: "", minutes: 60 }]))).toBe(
      "1 step · 60 min",
    );
  });
});

describe("#30 AC2 the last returning opening is remembered in this browser", () => {
  it("saves and loads the index, and survives blocked storage", async () => {
    const { loadLastOpening, saveLastOpening } = await import("@/lib/prototype/opening-memory");
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    expect(loadLastOpening(storage)).toBeNull();
    saveLastOpening(storage, 3);
    expect(loadLastOpening(storage)).toBe(3);
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(loadLastOpening(blocked)).toBeNull();
    expect(() => saveLastOpening(blocked, 1)).not.toThrow();
  });
});
