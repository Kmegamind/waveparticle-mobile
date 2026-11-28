import { describe, expect, it } from "vitest";
import { homeView } from "@/lib/home/home-view";
import { meView } from "@/lib/me/me-view";
import { sessionRecord, storyRecord } from "@/lib/me/records";
import type {
  AccountProgress,
  ProgressGoal,
  ProgressSession,
  SessionLine,
} from "@/lib/progress/account-progress";
import { seedContent } from "./support/seed-content";

// The story content as the app reads it (#284), from the seed files.
const seed = seedContent();

// #81, #82, #75, #94: the Me area reads the account only.

const STORY = { id: seed.stories[0].id, keySlices: seed.stories[0].inputs.keySlices };

function goal(id: string, status: ProgressGoal["status"], steps: [string, number][]): ProgressGoal {
  return {
    id,
    title: `${id} title`,
    text: `${id} text`,
    status,
    createdAt: "2026-11-01T00:00:00.000Z",
    steps: steps.map(([title, minutes], position) => ({
      id: `${id}-s${position}`,
      position,
      title,
      description: null,
      minutes,
    })),
  };
}

function line(
  stepId: string | null,
  kind: SessionLine["kind"],
  text: string,
  seq: number,
): SessionLine {
  return {
    id: `${stepId}-${kind}-${seq}`,
    sessionStepId: stepId,
    seq,
    kind,
    cardId: null,
    source: "generated",
    text,
    pauseNumber: null,
    shownAt: "2026-11-03T10:00:00.000Z",
  };
}

function session(
  g: ProgressGoal,
  state: ProgressSession["state"],
  doneAt: (string | null)[],
  extra: Partial<ProgressSession> = {},
): ProgressSession {
  return {
    id: `${g.id}-${state}`,
    goalId: g.id,
    companionId: "oppenheimer",
    storyId: STORY.id,
    state,
    backgroundCard: null,
    backgroundCardSource: null,
    mergedKeyMoments: [],
    closingLine: null,
    steps: g.steps.map((step, position) => ({
      id: `${g.id}-ss${position}`,
      stepId: step.id,
      position,
      openedAt: "2026-11-03T09:00:00.000Z",
      doneAt: doneAt[position] ?? null,
    })),
    lines: [],
    ...extra,
  };
}

const account = (goals: ProgressGoal[], sessions: ProgressSession[]): AccountProgress => ({
  userId: "u",
  goals,
  sessions,
});

describe("#82 #75 history", () => {
  it("lists only sessions with a done Step, newest first, with the Plan minutes of done Steps", () => {
    const a = goal("a", "done", [
      ["Gather", 30],
      ["Write", 20],
    ]);
    const b = goal("b", "in_progress", [["Read", 15]]);
    const c = goal("c", "in_progress", [["Plan", 10]]);
    const view = meView(
      account(
        [a, b, c],
        [
          session(a, "completed", ["2026-11-02T10:00:00.000Z", "2026-11-02T11:00:00.000Z"]),
          session(b, "open", ["2026-11-03T10:00:00.000Z"]),
          session(c, "open", [null]),
        ],
      ),
      seed.companions,
    );
    expect(view.history.map((entry) => [entry.goalTitle, entry.minutes])).toEqual([
      ["b title", 15],
      ["a title", 50],
    ]);
    expect(view.history[1].firstDoneAt).toBe("2026-11-02T10:00:00.000Z");
    expect(view.history[0].companion).toBe("Oppenheimer");
  });
});

describe("#81 current and on-hold Goals", () => {
  it("the current Goal is Home's Goal, and on-hold Goals are listed by title", () => {
    const b = goal("b", "in_progress", [["Read", 15]]);
    const h = goal("h", "on_hold", [["Wait", 5]]);
    const progress = account([b, h], [session(b, "open", [null])]);
    const home = homeView(progress, seed.companions);
    if (home.kind !== "goal") throw new Error(home.kind);
    const view = meView(progress, seed.companions);
    expect(view.current).toEqual({
      goalId: home.card.goalId,
      title: "b title",
      companion: "Oppenheimer",
    });
    expect(view.onHold).toEqual([{ goalId: "h", title: "h title" }]);
    expect(meView(account([h], []), seed.companions).current).toBeNull();
  });
});

describe("#75 the session record", () => {
  it("shows the done Steps only and links his chapter only for a completed session", () => {
    const a = goal("a", "in_progress", [
      ["Gather", 30],
      ["Write", 20],
    ]);
    const open = session(a, "open", ["2026-11-03T10:00:00.000Z", null]);
    expect(sessionRecord(account([a], [open]), open.id, seed.companions)).toEqual({
      goalTitle: "a title",
      firstDoneAt: "2026-11-03T10:00:00.000Z",
      minutes: 30,
      doneSteps: ["Gather"],
      storyRecordHref: null,
    });
    const done = session(a, "completed", ["2026-11-03T10:00:00.000Z", "2026-11-03T11:00:00.000Z"]);
    expect(sessionRecord(account([a], [done]), done.id, seed.companions)?.storyRecordHref).toBe(
      `/me/history/${done.id}/chapter`,
    );
    expect(sessionRecord(account([a], [done]), "nope", seed.companions)).toBeNull();
    const none = session(a, "open", [null, null]);
    expect(sessionRecord(account([a], [none]), none.id, seed.companions)).toBeNull();
  });
});

describe("#94 the record of a finished Story", () => {
  it("gives his cards per Step in order, the closing line and the key moments", () => {
    const a = goal("a", "done", [
      ["Gather", 30],
      ["Write", 20],
    ]);
    const done = session(a, "completed", ["2026-11-03T10:00:00.000Z", "2026-11-03T11:00:00.000Z"], {
      mergedKeyMoments: [0],
      lines: [
        line("a-ss1", "story_card", "Second step card.", 0),
        line("a-ss0", "story_card", "Later card.", 1),
        line("a-ss0", "background", "Background.", 0),
        line("a-ss0", "pause_message", "Stuck.", 2),
        line(null, "closing", "What I carry.", 0),
      ],
    });
    done.closingLine = "The day ended at the mesa.";
    expect(storyRecord(seed, account([a], [done]), done.id)).toEqual({
      // #521: the session's Companion, whose Life Path the record goes back to.
      companionId: "oppenheimer",
      storyTitle: expect.any(String),
      steps: [
        { title: "Gather", cards: ["Background.", "Later card."] },
        { title: "Write", cards: ["Second step card."] },
      ],
      closingLine: "The day ended at the mesa.",
      keyMoments: [STORY.keySlices[0].keyLine],
    });
  });

  it("has no record for an unknown or unfinished session", () => {
    const a = goal("a", "in_progress", [["Gather", 30]]);
    const open = session(a, "open", ["2026-11-03T10:00:00.000Z"]);
    expect(storyRecord(seed, account([a], [open]), open.id)).toBeNull();
    expect(storyRecord(seed, account([a], [open]), "nope")).toBeNull();
  });
});
