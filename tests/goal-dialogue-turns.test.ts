import { describe, expect, it, vi } from "vitest";
import {
  dialogueSecret,
  signDialogueToken,
  verifyDialogueToken,
  type DialogueState,
} from "@/lib/goal-dialogue/token";
import {
  DEFAULT_MINUTES,
  MAX_TURNS,
  TOKEN_MAX_AGE_MS,
  takeTurn,
  type TurnDeps,
  type TurnOutcome,
} from "@/lib/goal-dialogue/turns";
import type { SplitInput, SplitOutcome } from "@/lib/prototype/split-goal";
import { startGoal, type GoalWriter } from "@/lib/goals/start-goal";

const SECRET = Buffer.from("a test secret that is long enough to sign with");
const NOW = Date.UTC(2026, 10, 20, 12);
const GOAL = "Write the report";

function planFor(input: SplitInput): SplitOutcome {
  const half = Math.floor(input.totalMinutes / 2);
  return {
    status: "plan",
    plan: {
      source: "test-data",
      title: input.goal,
      steps: [
        { title: "Outline", description: "List the sections.", minutes: half },
        { title: "Draft", description: "Write it.", minutes: input.totalMinutes - half },
      ],
    },
  };
}

function deps(overrides: Partial<TurnDeps> = {}) {
  const split = vi.fn(async (input: SplitInput) => planFor(input));
  let ids = 0;
  return {
    split,
    deps: {
      secret: SECRET,
      now: () => NOW,
      newId: () => `dialogue-${++ids}`,
      split,
      ...overrides,
    } satisfies TurnDeps,
  };
}

function tokenOf(outcome: TurnOutcome): string {
  if (!("token" in outcome)) throw new Error(`expected a token, got ${outcome.status}`);
  return outcome.token;
}

function stateOf(outcome: TurnOutcome): DialogueState {
  const state = verifyDialogueToken(tokenOf(outcome), SECRET, NOW);
  if (!state) throw new Error("token does not verify");
  return state;
}

/** Goal, time and split answer: the three turns of FLOW 4.3. */
async function walkToPlan(d: TurnDeps, goal = GOAL) {
  const afterGoal = await takeTurn({ kind: "goal", goal }, d);
  const afterTime = await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes: 60 }, d);
  const planned = await takeTurn(
    { kind: "split", token: tokenOf(afterTime), goal, splitFiner: true },
    d,
  );
  return { afterGoal, afterTime, planned };
}

describe("the dialogue token", () => {
  it("round-trips a signed state and refuses a changed or foreign one", () => {
    const state: DialogueState = {
      v: 1,
      id: "d1",
      goal: "hash",
      turns: 1,
      minutes: null,
      finer: null,
      closed: false,
      iat: NOW,
    };
    const token = signDialogueToken(state, SECRET);
    expect(verifyDialogueToken(token, SECRET, NOW)).toEqual(state);

    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...state, turns: 0 })).toString("base64url");
    expect(verifyDialogueToken(`${forged}.${mac}`, SECRET, NOW)).toBeNull();
    expect(verifyDialogueToken(`${body}.${mac}x`, SECRET, NOW)).toBeNull();
    expect(verifyDialogueToken(token, Buffer.from("another secret, also long enough"), NOW)).toBe(
      null,
    );
    expect(verifyDialogueToken("not a token", SECRET, NOW)).toBeNull();
  });

  it("expires after a day", () => {
    const token = signDialogueToken(
      {
        v: 1,
        id: "d1",
        goal: "h",
        turns: 1,
        minutes: null,
        finer: null,
        closed: false,
        iat: NOW,
      },
      SECRET,
    );
    expect(verifyDialogueToken(token, SECRET, NOW + TOKEN_MAX_AGE_MS)).not.toBeNull();
    expect(verifyDialogueToken(token, SECRET, NOW + TOKEN_MAX_AGE_MS + 1)).toBeNull();
  });

  it("carries no goal text", async () => {
    const { deps: d } = deps();
    const outcome = await takeTurn({ kind: "goal", goal: "secret goal words" }, d);
    const body = Buffer.from(tokenOf(outcome).split(".")[0], "base64url").toString();
    expect(body).not.toContain("secret");
  });
});

describe("the dialogue secret", () => {
  const strong = "x".repeat(32);

  it("uses GOAL_DIALOGUE_SECRET when it is at least 32 characters", () => {
    expect(dialogueSecret({ GOAL_DIALOGUE_SECRET: strong, NODE_ENV: "production" })).toEqual(
      Buffer.from(strong),
    );
  });

  it("fails closed in production when the secret is missing or short", () => {
    expect(dialogueSecret({ NODE_ENV: "production" })).toBeNull();
    expect(dialogueSecret({ NODE_ENV: "production", GOAL_DIALOGUE_SECRET: "short" })).toBeNull();
  });

  it("outside production uses a random key for this process only", () => {
    const first = dialogueSecret({ NODE_ENV: "development" });
    expect(first).not.toBeNull();
    expect(first?.length).toBe(32);
    expect(dialogueSecret({ NODE_ENV: "test" })).toEqual(first);
  });
});

describe("US-GD-14 AC1 the server counts the turns", () => {
  it("counts goal, time and the split answer as three turns", async () => {
    const { deps: d } = deps();
    const { afterGoal, afterTime, planned } = await walkToPlan(d);
    expect(stateOf(afterGoal).turns).toBe(1);
    expect(stateOf(afterTime).turns).toBe(2);
    expect(planned.status).toBe("plan");
    expect(stateOf(planned).turns).toBe(MAX_TURNS);
  });

  it("refuses a second time answer on the same chain of turns", async () => {
    const { deps: d } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    const afterTime = await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes: 45 }, d);
    expect(await takeTurn({ kind: "time", token: tokenOf(afterTime), minutes: 50 }, d)).toEqual({
      status: "refused",
    });
  });

  it("refuses the split answer before the time is known", async () => {
    const { deps: d, split } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    expect(
      await takeTurn({ kind: "split", token: tokenOf(afterGoal), goal: GOAL, splitFiner: true }, d),
    ).toEqual({ status: "refused" });
    expect(split).not.toHaveBeenCalled();
  });

  it("GOAL-TIME a goal that states a time skips the time turn", async () => {
    const { deps: d, split } = deps();
    const goal = "Study chemistry for one hour";
    const afterGoal = await takeTurn({ kind: "goal", goal }, d);
    expect(afterGoal).toMatchObject({ status: "turn", minutes: 60 });
    const planned = await takeTurn(
      { kind: "split", token: tokenOf(afterGoal), goal, splitFiner: false },
      d,
    );
    expect(planned.status).toBe("plan");
    expect(split).toHaveBeenCalledWith({ goal, totalMinutes: 60, splitFiner: false });
    expect(stateOf(planned).turns).toBe(2);
  });

  it("#351 a goal that states more than 180 minutes is split for 180, not refused", async () => {
    const { deps: d, split } = deps();
    const goal = "study for 4 hours";
    const afterGoal = await takeTurn({ kind: "goal", goal }, d);
    expect(afterGoal).toMatchObject({ status: "turn", minutes: 180 });
    const planned = await takeTurn(
      { kind: "split", token: tokenOf(afterGoal), goal, splitFiner: false },
      d,
    );
    expect(planned.status).toBe("plan");
    expect(split).toHaveBeenCalledWith({ goal, totalMinutes: 180, splitFiner: false });
    if (planned.status !== "plan") throw new Error("expected a plan");
    expect(planned.plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(180);
  });

  it("#351 a stated 180 minutes is left as it is", async () => {
    const { deps: d } = deps();
    expect(await takeTurn({ kind: "goal", goal: "study for 3 hours" }, d)).toMatchObject({
      minutes: 180,
    });
    expect(await takeTurn({ kind: "goal", goal: "study for 2 hours" }, d)).toMatchObject({
      minutes: 120,
    });
  });

  it("Change on an understood time is the time turn", async () => {
    const { deps: d } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: "Study for one hour" }, d);
    const changed = await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes: 90 }, d);
    expect(stateOf(changed)).toMatchObject({ turns: 2, minutes: 90 });
  });

  it("Just split it uses 30 minutes and Keep it broad when no time was given", async () => {
    const { deps: d, split } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    const planned = await takeTurn(
      { kind: "split", token: tokenOf(afterGoal), goal: GOAL, splitFiner: null },
      d,
    );
    expect(planned.status).toBe("plan");
    expect(split).toHaveBeenCalledWith({
      goal: GOAL,
      totalMinutes: DEFAULT_MINUTES,
      splitFiner: false,
    });
  });

  it("takes the minutes from the token, not from the browser", async () => {
    const { deps: d, split } = deps();
    await walkToPlan(d);
    expect(split).toHaveBeenCalledWith({ goal: GOAL, totalMinutes: 60, splitFiner: true });
  });

  it("refuses a time outside the slider, and an empty or too long goal", async () => {
    const { deps: d } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    for (const minutes of [0, 181, 12.5]) {
      expect(await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes }, d)).toEqual({
        status: "refused",
      });
    }
    expect(await takeTurn({ kind: "goal", goal: "   " }, d)).toEqual({ status: "refused" });
    expect(await takeTurn({ kind: "goal", goal: "x".repeat(501) }, d)).toEqual({
      status: "refused",
    });
  });

  it("a crisis goal opens the safety page and starts no dialogue", async () => {
    const { deps: d } = deps();
    expect(await takeTurn({ kind: "goal", goal: "I want to kill myself" }, d)).toEqual({
      status: "crisis",
    });
  });

  it("refuses every turn when there is no secret", async () => {
    const { deps: d, split } = deps({ secret: null });
    expect(await takeTurn({ kind: "goal", goal: GOAL }, d)).toEqual({ status: "refused" });
    expect(split).not.toHaveBeenCalled();
  });

  it("refuses a forged or expired token", async () => {
    const { deps: d } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    expect(await takeTurn({ kind: "time", token: "forged.token", minutes: 30 }, d)).toEqual({
      status: "refused",
    });
    const later = { ...d, now: () => NOW + TOKEN_MAX_AGE_MS + 1 };
    expect(await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes: 30 }, later)).toEqual(
      { status: "refused" },
    );
  });
});

describe("US-GD-14 AC2 after the Plan the server refuses further free text", () => {
  it("refuses Split again with a changed goal", async () => {
    const { deps: d, split } = deps();
    const { planned } = await walkToPlan(d);
    split.mockClear();
    expect(
      await takeTurn({ kind: "split-again", token: tokenOf(planned), goal: "Chat with me" }, d),
    ).toEqual({ status: "refused" });
    expect(split).not.toHaveBeenCalled();
  });

  it("refuses another split answer or time answer on the planned dialogue", async () => {
    const { deps: d } = deps();
    const { planned } = await walkToPlan(d);
    expect(
      await takeTurn({ kind: "split", token: tokenOf(planned), goal: GOAL, splitFiner: false }, d),
    ).toEqual({ status: "refused" });
    expect(await takeTurn({ kind: "time", token: tokenOf(planned), minutes: 30 }, d)).toEqual({
      status: "refused",
    });
  });

  it("refuses a changed goal on the split answer too", async () => {
    const { deps: d } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    const afterTime = await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes: 30 }, d);
    expect(
      await takeTurn(
        { kind: "split", token: tokenOf(afterTime), goal: "Another line", splitFiner: true },
        d,
      ),
    ).toEqual({ status: "refused" });
  });

  it("decision (1): Split again and Try again have no limit inside one dialogue", async () => {
    const { deps: d, split } = deps();
    const { planned } = await walkToPlan(d);
    let token = tokenOf(planned);
    for (let i = 0; i < 10; i += 1) {
      const again = await takeTurn({ kind: "split-again", token, goal: GOAL }, d);
      expect(again.status).toBe("plan");
      expect(stateOf(again)).toMatchObject({ turns: MAX_TURNS, finer: true, minutes: 60 });
      token = tokenOf(again);
    }
    expect(split).toHaveBeenLastCalledWith({ goal: GOAL, totalMinutes: 60, splitFiner: true });
  });

  it("Try again after a failed split keeps the same dialogue", async () => {
    const failing = vi.fn(async (): Promise<SplitOutcome> => ({ status: "failed" }));
    const { deps: d } = deps({ split: failing });
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    const failed = await takeTurn(
      { kind: "split", token: tokenOf(afterGoal), goal: GOAL, splitFiner: null },
      d,
    );
    expect(failed.status).toBe("failed");
    const retried = await takeTurn(
      { kind: "split-again", token: tokenOf(failed), goal: GOAL },
      { ...d, split: async (input) => planFor(input) },
    );
    expect(retried.status).toBe("plan");
    expect(stateOf(retried).id).toBe(stateOf(afterGoal).id);
  });

  it("refuses Split again before any split", async () => {
    const { deps: d } = deps();
    const afterGoal = await takeTurn({ kind: "goal", goal: GOAL }, d);
    expect(
      await takeTurn({ kind: "split-again", token: tokenOf(afterGoal), goal: GOAL }, d),
    ).toEqual({ status: "refused" });
  });

  it("decision (2): a new goal line after a Plan is a new dialogue", async () => {
    const { deps: d } = deps();
    const { planned } = await walkToPlan(d);
    const fresh = await takeTurn({ kind: "goal", goal: "Another line" }, d);
    expect(stateOf(fresh)).toMatchObject({ turns: 1, closed: false });
    expect(stateOf(fresh).id).not.toBe(stateOf(planned).id);
  });

  it("going back a turn replays the earlier token, which FLOW allows", async () => {
    const { deps: d } = deps();
    const { afterGoal, afterTime } = await walkToPlan(d);
    // Back from GD4 to GD3: answer the split question again.
    const other = await takeTurn(
      { kind: "split", token: tokenOf(afterTime), goal: GOAL, splitFiner: false },
      d,
    );
    expect(other.status).toBe("plan");
    // Back to GD2: change the time.
    const changed = await takeTurn({ kind: "time", token: tokenOf(afterGoal), minutes: 20 }, d);
    expect(stateOf(changed)).toMatchObject({ turns: 2, minutes: 20 });
  });
});

describe("US-GD-14 AC3 edits to the Plan get no reply from him", () => {
  it("Start saves an edited Plan and its answer has no line of his", async () => {
    const writer: GoalWriter = {
      goalExists: vi.fn(async () => false),
      insertGoal: vi.fn(async () => {}),
      updateGoal: vi.fn(async () => {}),
      replaceSteps: vi.fn(async () => {}),
      deleteGoal: vi.fn(async () => {}),
    };
    const outcome = await startGoal(
      {
        goalId: "7d0f3c2a-1b2c-4d5e-8f90-123456789abc",
        goalText: GOAL,
        title: "My own title",
        splitFiner: true,
        steps: [
          { title: "Renamed", description: "Changed by hand.", minutes: 7 },
          { title: "Added by me", description: "", minutes: 15 },
        ],
      },
      { userId: "user-1", writer },
    );
    expect(outcome.status).toBe("saved");
    expect(Object.keys(outcome).sort()).toEqual(["goalId", "status", "steps"]);
  });

  it("no turn takes Plan edits, so no edit can reach a model", async () => {
    const { deps: d, split } = deps();
    const { planned } = await walkToPlan(d);
    split.mockClear();
    const edit = { kind: "edit", token: tokenOf(planned), steps: [] } as unknown as Parameters<
      typeof takeTurn
    >[0];
    expect(await takeTurn(edit, d)).toEqual({ status: "refused" });
    expect(split).not.toHaveBeenCalled();
  });
});
