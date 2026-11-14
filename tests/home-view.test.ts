import { describe, expect, it } from "vitest";
import type {
  AccountProgress,
  ProgressGoal,
  ProgressSession,
  SessionLine,
} from "@/lib/progress/account-progress";
import { homeView } from "@/lib/home/home-view";

// #268: Home's state comes from the account only (#90).

function goal(id: string, status: ProgressGoal["status"], steps: string[], createdAt?: string) {
  return {
    id,
    title: `${id} title`,
    text: `${id} text`,
    status,
    createdAt,
    steps: steps.map((title, position) => ({
      id: `${id}-s${position}`,
      position,
      title,
      description: null,
      minutes: 10,
    })),
  } satisfies ProgressGoal;
}

function line(
  id: string,
  stepId: string | null,
  kind: SessionLine["kind"],
  text: string,
  shownAt: string,
  seq = 0,
): SessionLine {
  return {
    id,
    sessionStepId: stepId,
    seq,
    kind,
    cardId: null,
    source: "generated",
    text,
    pauseNumber: kind === "pause_message" ? 1 : null,
    shownAt,
  };
}

function session(
  g: ReturnType<typeof goal>,
  state: ProgressSession["state"],
  done: number,
  lines: SessionLine[] = [],
  companionId = "oppenheimer",
): ProgressSession {
  return {
    id: `${g.id}-session-${state}`,
    goalId: g.id,
    companionId,
    storyId: "site-search",
    state,
    backgroundCard: null,
    backgroundCardSource: null,
    mergedKeyMoments: [],
    closingLine: null,
    steps: g.steps.map((step, position) => ({
      id: `${g.id}-ss${position}`,
      stepId: step.id,
      position,
      openedAt: position <= done ? "2026-11-10T10:00:00.000Z" : null,
      doneAt: position < done ? "2026-11-10T10:30:00.000Z" : null,
    })),
    lines,
  };
}

const account = (goals: ProgressGoal[], sessions: ProgressSession[] = []): AccountProgress => ({
  userId: "u",
  goals,
  sessions,
});

describe("#268 AC1 AC2 first visit", () => {
  it("first visit only when the account has no Goal", () => {
    expect(homeView(account([]))).toEqual({ kind: "first" });
    expect(homeView(account([goal("a", "done", ["One"])])).kind).toBe("none");
    expect(homeView(account([goal("a", "on_hold", ["One"])])).kind).toBe("none");
  });
});

describe("#268 AC3 the Goal card", () => {
  it("the card is the most recently active in-progress Goal", () => {
    const older = goal("older", "in_progress", ["One"], "2026-11-01T00:00:00.000Z");
    const newer = goal("newer", "in_progress", ["One"], "2026-11-01T00:00:00.000Z");
    const view = homeView(
      account(
        [newer, older],
        [
          session(older, "open", 0, [
            line("l1", "older-ss0", "background", "Old.", "2026-11-12T00:00:00.000Z"),
          ]),
          session(newer, "open", 0, [
            line("l2", "newer-ss0", "background", "New.", "2026-11-13T00:00:00.000Z"),
          ]),
        ],
      ),
    );
    if (view.kind !== "goal") throw new Error(view.kind);
    expect(view.card.goalId).toBe("newer");
    expect(view.inProgress.map((item) => item.goalId)).toEqual(["newer", "older"]);
    expect(view.card.companion).toBe("Oppenheimer");
  });

  it("where you left it is the first Step not done in the open session", () => {
    const g = goal("g", "in_progress", ["Outline", "Draft", "Check"]);
    const card = (view: ReturnType<typeof homeView>) => {
      if (view.kind !== "goal") throw new Error(view.kind);
      return view.card;
    };
    expect(card(homeView(account([g], [session(g, "open", 1)]))).stepLabel).toBe("Step 2: Draft");
    expect(card(homeView(account([g]))).stepLabel).toBe("Step 1: Outline");
    expect(card(homeView(account([g]))).line).toBeNull();
    const single = goal("s", "in_progress", ["Only"]);
    expect(card(homeView(account([single]))).stepLabel).toBe("Only");
  });

  it("his line is the newest shown card of the open session", () => {
    const g = goal("g", "in_progress", ["One", "Two"]);
    const view = homeView(
      account(
        [g],
        [
          session(g, "open", 1, [
            line("a", "g-ss0", "background", "Background.", "2026-11-12T10:00:00.000Z"),
            line("b", "g-ss1", "story_card", "Newest card.", "2026-11-12T11:00:00.000Z"),
            line("c", "g-ss1", "pause_message", "Stuck.", "2026-11-12T12:00:00.000Z", 1),
            line("d", "g-ss1", "return_popup", "Back.", "2026-11-12T13:00:00.000Z", 2),
          ]),
        ],
      ),
    );
    if (view.kind !== "goal") throw new Error(view.kind);
    expect(view.card.line).toBe("Newest card.");
  });
});

describe("#268 AC5 AC6 nothing in progress", () => {
  it("nothing in progress shows the carried line and Quick Replay", () => {
    const done = ["d1", "d2", "d3", "d4"].map((id, index) =>
      goal(id, "done", ["One"], `2026-11-0${index + 1}T00:00:00.000Z`),
    );
    const finished = session(done[3], "completed", 1, [
      line("k", null, "closing", "I still carry the doubt.", "2026-11-12T10:00:00.000Z"),
    ]);
    const older = session(done[0], "completed", 1, [
      line("k0", null, "closing", "An older line.", "2026-11-11T10:00:00.000Z"),
    ]);
    const view = homeView(account(done, [older, finished]));
    if (view.kind !== "none") throw new Error(view.kind);
    expect(view.carriedLine).toBe("I still carry the doubt.");
    expect(view.replay.map((item) => item.goalId)).toEqual(["d4", "d1", "d3"]);

    const held = homeView(account([goal("h", "on_hold", ["One"])]));
    expect(held).toEqual({ kind: "none", carriedLine: null, replay: [], companions: [] });
  });
});

describe("#268 AC3 My Companions", () => {
  it("My Companions lists companions with a non-restarted session", () => {
    const g = goal("g", "in_progress", ["One"]);
    const withMoriarty = homeView(
      account(
        [g],
        [
          session(g, "open", 0, [], "oppenheimer"),
          {
            ...session(g, "completed", 1, [], "moriarty"),
            id: "m",
          },
        ],
      ),
    );
    if (withMoriarty.kind !== "goal") throw new Error(withMoriarty.kind);
    expect(withMoriarty.companions).toEqual(["oppenheimer", "moriarty"]);
    const restartedOnly = homeView(account([g], [session(g, "restarted", 0)]));
    if (restartedOnly.kind !== "goal") throw new Error(restartedOnly.kind);
    expect(restartedOnly.companions).toEqual([]);
  });
});
