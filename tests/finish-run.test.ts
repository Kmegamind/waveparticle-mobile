import { describe, expect, it, vi } from "vitest";
import type { ClosingLineInput, ModelGateway } from "@/lib/model-gateway";
import {
  createMemoryProgressStore,
  type AccountProgress,
  type ProgressGoal,
  type ProgressSession,
  type ProgressStore,
} from "@/lib/progress/account-progress";
import { generationInputs } from "@/lib/prototype/story-inputs";
import { closingInputFor, finishAccountRun, summaryOf } from "@/lib/summary/finish-run";
import { createMemoryRunWriter } from "@/lib/summary/run-writer";
import { seedContent } from "./support/seed-content";

// The story content as the app reads it (#284), from the seed files.
const seed = seedContent();

// Issue #258 on #257: END reads the account's completed session and adds his live closing line.

const USER = "user-1";
const SESSION = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const OTHER = "9f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const NOW = "2026-11-13T12:00:00.000Z";
const STEP_TITLE = "SECRET_STEP_TITLE";
const GOAL_TEXT = "SECRET_GOAL_TEXT";

function goal(): ProgressGoal {
  return {
    id: "g1",
    title: GOAL_TEXT,
    text: GOAL_TEXT,
    status: "done",
    steps: [
      { id: "s1", position: 1, title: "Draft", description: null, minutes: 20 },
      { id: "s0", position: 0, title: STEP_TITLE, description: null, minutes: 10 },
    ],
  };
}

function line(id: string, step: string, kind: "background" | "story_card", text: string) {
  return {
    id,
    sessionStepId: step,
    seq: 0,
    kind,
    cardId: null,
    source: "generated" as const,
    text,
    pauseNumber: null,
    shownAt: NOW,
  };
}

function session(overrides: Partial<ProgressSession> = {}): ProgressSession {
  return {
    id: SESSION,
    goalId: "g1",
    companionId: "oppenheimer",
    storyId: "bohr-difficulties",
    state: "completed",
    backgroundCard: null,
    backgroundCardSource: null,
    mergedKeyMoments: [],
    closingLine: null,
    steps: [
      { id: "ss0", stepId: "s0", position: 0, openedAt: NOW, doneAt: NOW },
      { id: "ss1", stepId: "s1", position: 1, openedAt: NOW, doneAt: NOW },
    ],
    lines: [
      line("l1", "ss1", "story_card", "I sit down again."),
      line("l0", "ss0", "background", "I open the notebook."),
    ],
    ...overrides,
  };
}

async function storeWith(progress: Partial<AccountProgress>) {
  const store = createMemoryProgressStore();
  await store.write(USER, { userId: USER, goals: [goal()], sessions: [session()], ...progress });
  return store;
}

function gatewayWith(result: unknown) {
  const writeClosingLine = vi.fn<(input: ClosingLineInput) => Promise<unknown>>(async () => result);
  return { gateway: { writeClosingLine } as unknown as ModelGateway, writeClosingLine };
}

const ok = { source: "generated", closingLine: "I sent the paper off.", carryLine: "I wonder." };

const deps = (store: ProgressStore, gateway: ModelGateway | null) => ({
  userId: USER,
  store,
  writer: createMemoryRunWriter(store, USER),
  gateway,
  wait: async () => undefined,
  nowIso: NOW,
  loadContent: async () => seed,
});

describe("#258 AC2 what END shows of the account's session", () => {
  it("gives the story title, the Goal, the Steps in order and the plan length", async () => {
    const store = await storeWith({});
    expect(summaryOf(seed, await store.read(USER, USER), SESSION)).toEqual({
      sessionId: SESSION,
      goalId: "g1",
      storyTitle: "The Trade of a Theorist",
      goalTitle: GOAL_TEXT,
      steps: [STEP_TITLE, "Draft"],
      planMinutes: 30,
      finished: true,
      // #521: Next opens the Life Path of the session's own Companion.
      lifePathHref: "/companions/oppenheimer",
    });
  });

  it("is null for an unknown session and says when the session is not finished", async () => {
    const store = await storeWith({ sessions: [session({ state: "open" })] });
    const progress = await store.read(USER, USER);
    expect(summaryOf(seed, progress, OTHER)).toBeNull();
    expect(summaryOf(seed, progress, SESSION)?.finished).toBe(false);
  });
});

describe("#258 AC3 the closing call gets no text from the user", () => {
  it("holds the story's inputs and facts, never a Step title or the Goal", () => {
    const closing = closingInputFor(seed, "bohr-difficulties", [10, 20], ["I open the notebook."]);
    const sent = JSON.stringify(closing);
    expect(sent).toContain(generationInputs(seed, "bohr-difficulties").who);
    expect(closing.lastMoment.length).toBeGreaterThan(0);
    expect(closing.forbidTerms).toEqual(generationInputs(seed, "bohr-difficulties").forbidTerms);
    expect(sent).not.toContain(STEP_TITLE);
    expect(sent).not.toContain(GOAL_TEXT);
  });

  it("sends his shown lines in Step order and the Plan's minutes, no user text", async () => {
    const store = await storeWith({});
    const { gateway, writeClosingLine } = gatewayWith(ok);
    await finishAccountRun({ sessionId: SESSION }, deps(store, gateway));
    const sent = writeClosingLine.mock.calls[0][0];
    expect(sent.earlierLines).toEqual(["I open the notebook.", "I sit down again."]);
    expect(JSON.stringify(sent)).not.toContain(STEP_TITLE);
    expect(JSON.stringify(sent)).not.toContain(GOAL_TEXT);
  });
});

describe("#258 AC4 AC5 AC6 finishing a run on the account", () => {
  it("is refused when signed out or for a malformed id", async () => {
    const store = await storeWith({});
    const { gateway } = gatewayWith(ok);
    expect(
      await finishAccountRun({ sessionId: SESSION }, { ...deps(store, gateway), userId: null }),
    ).toEqual({ status: "signed-out" });
    expect(await finishAccountRun({ sessionId: "nope" }, deps(store, gateway))).toEqual({
      status: "invalid",
    });
    expect(await finishAccountRun(null, deps(store, gateway))).toEqual({ status: "invalid" });
  });

  it("says not-finished, without a call, for an open or unknown session", async () => {
    const store = await storeWith({ sessions: [session({ state: "open" })] });
    const { gateway, writeClosingLine } = gatewayWith(ok);
    expect(await finishAccountRun({ sessionId: SESSION }, deps(store, gateway))).toEqual({
      status: "not-finished",
    });
    expect(await finishAccountRun({ sessionId: OTHER }, deps(store, gateway))).toEqual({
      status: "not-finished",
    });
    expect(writeClosingLine).not.toHaveBeenCalled();
  });

  it("fails without a gateway or when generation fails, and stores nothing", async () => {
    const store = await storeWith({});
    expect(await finishAccountRun({ sessionId: SESSION }, deps(store, null))).toEqual({
      status: "failed",
    });
    const failing = gatewayWith({ source: "failed", reason: "checks" });
    expect(await finishAccountRun({ sessionId: SESSION }, deps(store, failing.gateway))).toEqual({
      status: "failed",
    });
    expect((await store.read(USER, USER)).sessions[0].closingLine).toBeNull();
  });

  it("stores both lines on the session and offers the next story", async () => {
    const store = await storeWith({});
    const { gateway } = gatewayWith(ok);
    expect(await finishAccountRun({ sessionId: SESSION }, deps(store, gateway))).toEqual({
      status: "ok",
      shown: { closingLine: ok.closingLine, carryLine: ok.carryLine, next: "tolman-lecture" },
    });
    const saved = (await store.read(USER, USER)).sessions[0];
    expect(saved.closingLine).toBe(ok.closingLine);
    expect(saved.lines.filter((item) => item.kind === "closing")).toEqual([
      expect.objectContaining({ source: "generated", text: ok.carryLine, sessionStepId: null }),
    ]);
  });

  it("never generates again: a reload shows the stored lines", async () => {
    const store = await storeWith({});
    await finishAccountRun({ sessionId: SESSION }, deps(store, gatewayWith(ok).gateway));
    const again = gatewayWith({ ...ok, closingLine: "I am someone else." });
    expect(await finishAccountRun({ sessionId: SESSION }, deps(store, again.gateway))).toEqual({
      status: "ok",
      shown: { closingLine: ok.closingLine, carryLine: ok.carryLine, next: "tolman-lecture" },
    });
    expect(again.writeClosingLine).not.toHaveBeenCalled();
  });

  it("offers no next story after the last one or for a story finished before", async () => {
    const last = await storeWith({ sessions: [session({ storyId: "fermi-award" })] });
    expect(
      await finishAccountRun({ sessionId: SESSION }, deps(last, gatewayWith(ok).gateway)),
    ).toMatchObject({ status: "ok", shown: { next: null } });

    const before = session({ id: OTHER, closingLine: "I was here before.", lines: [], steps: [] });
    const replay = await storeWith({ sessions: [before, session()] });
    expect(
      await finishAccountRun({ sessionId: SESSION }, deps(replay, gatewayWith(ok).gateway)),
    ).toMatchObject({ status: "ok", shown: { next: null } });
  });
});
