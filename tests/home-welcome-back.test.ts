import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HomeView } from "@/lib/home/home-view";
import { homeView } from "@/lib/home/home-view";
import { startOver, type StartOverWriter } from "@/lib/home/start-over";
import type {
  AccountProgress,
  ProgressGoal,
  ProgressSession,
} from "@/lib/progress/account-progress";
import { seedContent } from "./support/seed-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/home-actions", () => ({
  setGoalStatusAction: async () => ({ status: "failed" }),
  startOverAction: async () => ({ status: "failed" }),
}));

const { ProtectedHome } = await import("@/app/protected-home");

// #87 (US-HOME-3): HOME-3, welcome back after more than three days, and HOME-3B, Start over.

const seed = seedContent();
const GOAL = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";
const DAY = 24 * 60 * 60 * 1000;
const LAST = "2026-11-10T10:30:00.000Z";
const after = (ms: number) => new Date(Date.parse(LAST) + ms);

const goal: ProgressGoal = {
  id: GOAL,
  title: "Methods section for Friday",
  text: "Methods section for Friday",
  status: "in_progress",
  createdAt: "2026-11-01T00:00:00.000Z",
  steps: [0, 1, 2].map((position) => ({
    id: `step-${position}`,
    position,
    title: ["Gather", "Draft", "Tidy"][position],
    description: null,
    minutes: 15,
  })),
};

const open: ProgressSession = {
  id: "session-open",
  goalId: GOAL,
  companionId: "oppenheimer",
  storyId: "site-search",
  state: "open",
  backgroundCard: null,
  backgroundCardSource: null,
  mergedKeyMoments: [],
  closingLine: null,
  steps: goal.steps.map((step, position) => ({
    id: `ss-${position}`,
    stepId: step.id,
    position,
    openedAt: position <= 1 ? "2026-11-10T10:00:00.000Z" : null,
    doneAt: position < 1 ? LAST : null,
  })),
  lines: [
    {
      id: "l1",
      sessionStepId: "ss-0",
      seq: 0,
      kind: "background",
      cardId: null,
      source: "authored",
      text: "Meanwhile I walked the mesa.",
      pauseNumber: null,
      shownAt: "2026-11-10T10:00:00.000Z",
    },
  ],
};

const progress: AccountProgress = { userId: "u", goals: [goal], sessions: [open] };

describe("#87 AC1 Home after more than three days away", () => {
  it("test_87_ac1_more_than_three_days_since_last_activity_shows_welcome_back", () => {
    const view = homeView(progress, seed.companions, after(3 * DAY + 60_000));
    if (view.kind !== "goal") throw new Error(view.kind);
    expect(view.welcomeBack).toBe(true);
  });

  it("test_87_ac1_three_days_or_less_keeps_the_usual_goal_card", () => {
    for (const away of [5 * 60_000, DAY, 3 * DAY]) {
      const view = homeView(progress, seed.companions, after(away));
      if (view.kind !== "goal") throw new Error(view.kind);
      expect(view.welcomeBack).toBe(false);
    }
  });
});

function welcome(): HomeView {
  const view = homeView(progress, seed.companions, after(10 * DAY));
  if (view.kind !== "goal" || !view.welcomeBack) throw new Error("expected HOME-3");
  return view;
}

const render = (view: HomeView) =>
  renderToStaticMarkup(
    createElement(ProtectedHome, {
      companions: seed.companions,
      view,
      continueHref: `/focus?goal=${GOAL}`,
    }),
  );

describe("#87 AC1 AC2 the welcome back card", () => {
  it("test_87_ac1_a_system_card_with_pick_it_back_up_first_and_start_over_second", () => {
    const html = render(welcome());
    expect(html).toContain("Welcome back");
    expect(html).toContain("Your Goal is where you left it.");
    expect(html).toContain("Methods section for Friday");
    // Pick it back up is the filled (default) action and opens the focus page, as Continue does.
    expect(html).toMatch(
      new RegExp(`class="button-filled" href="/focus\\?goal=${GOAL}"[^>]*>Pick it back up<`),
    );
    expect(html).toMatch(/class="button-gray"[^>]*>Start over</);
    expect(html.indexOf("Pick it back up")).toBeLessThan(html.indexOf(">Start over<"));
    // A system card: no slip, so the Companion is not speaking.
    expect(html).not.toContain("focus-slip");
    expect(html).not.toMatch(/>Continue</);
  });

  it("test_87_ac2_no_day_count_no_abandoned_no_meanwhile", () => {
    const html = render(welcome()).replace(/<[^>]+>/g, " ");
    expect(html).not.toMatch(/\d+\s*days?|days? ago|away for|abandon|meanwhile/i);
  });
});

describe("#87 AC3 the Start over confirmation", () => {
  it("test_87_ac3_calm_wording_without_lost_progress_or_a_step_count", () => {
    const html = render(welcome());
    expect(html).toMatch(/<dialog[^>]*aria-labelledby="start-over-title"/);
    expect(html).toContain("Start over?");
    expect(html).toContain(
      "Nothing is lost. Your Steps begin again from Step 1, and his night begins again from the start.",
    );
    const sheet = html.slice(html.indexOf("start-over-title"));
    expect(sheet).toMatch(/class="button-filled"[^>]*>Start from Step 1</);
    expect(sheet).toMatch(/class="button-gray"[^>]*>Not now</);
    const words = sheet.replace(/<[^>]+>/g, " ");
    expect(words).not.toMatch(/lose|lost progress|abandon|\d+ of \d+|\d+ Steps/i);
  });
});

function fakeWriter(goals: Record<string, string>, sessions: Record<string, string>) {
  const writes: [string, string][] = [];
  const writer: StartOverWriter = {
    async goalStatus(goalId) {
      return (goals[goalId] as never) ?? null;
    },
    async sessionIn(goalId, state) {
      return goals[goalId] && sessions[goalId] === state ? `${goalId}-session` : null;
    },
    async setSession(sessionId, state) {
      writes.push([sessionId, state]);
    },
  };
  return { writer, writes };
}

describe("#87 AC4 confirming restarts the Plan and his night", () => {
  it("test_87_ac4_start_over_marks_the_open_session_restarted", async () => {
    const { writer, writes } = fakeWriter({ [GOAL]: "in_progress" }, { [GOAL]: "open" });
    expect(await startOver({ goalId: GOAL }, { userId: "u", writer })).toEqual({ status: "ok" });
    // The focus page then opens a new session at Step 1 with the story from its start (T5).
    expect(writes).toEqual([[`${GOAL}-session`, "restarted"]]);
  });

  it("test_87_ac4_start_over_without_an_open_session_changes_nothing", async () => {
    const { writer, writes } = fakeWriter({ [GOAL]: "in_progress" }, {});
    expect(await startOver({ goalId: GOAL }, { userId: "u", writer })).toEqual({ status: "ok" });
    expect(writes).toEqual([]);
  });

  it("test_87_ac4_start_over_refuses_bad_input_other_goals_and_goals_not_in_progress", async () => {
    const { writer, writes } = fakeWriter({ [GOAL]: "on_hold" }, { [GOAL]: "open" });
    expect(await startOver({ goalId: GOAL }, { userId: "u", writer })).toEqual({
      status: "failed",
    });
    expect(await startOver({ goalId: "not-a-uuid" }, { userId: "u", writer })).toEqual({
      status: "failed",
    });
    expect(await startOver(null, { userId: "u", writer })).toEqual({ status: "failed" });
    const other = "11111111-1111-4111-8111-111111111111";
    expect(await startOver({ goalId: other }, { userId: "u", writer })).toEqual({
      status: "failed",
    });
    expect(await startOver({ goalId: GOAL }, { userId: null, writer })).toEqual({
      status: "failed",
    });
    expect(writes).toEqual([]);
  });
});
