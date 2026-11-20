import { describe, expect, it } from "vitest";
import {
  SHOW_FIRST,
  filterHistory,
  goalDetail,
  historyGoals,
  goalsLists,
  matchesSearch,
  parseLine,
  parseTab,
  startHref,
  undoStatusFor,
  type GoalsData,
  type ViewOptions,
} from "@/lib/goals/goals-view";
import { seedContent } from "./support/seed-content";

// Wednesday 2026-11-11, 15:00 in Berlin.
const NOW = new Date("2026-11-11T14:00:00Z");
const on: ViewOptions = { now: NOW, timeZone: "Europe/Berlin" };

const G = {
  methods: "11111111-1111-4111-8111-111111111111",
  ielts: "22222222-2222-4222-8222-222222222222",
  portfolio: "33333333-3333-4333-8333-333333333333",
  lab: "44444444-4444-4444-8444-444444444444",
  planned: "55555555-5555-4555-8555-555555555555",
};

function data(): GoalsData {
  return {
    goals: [
      {
        id: G.methods,
        title: "Methods section for Friday",
        status: "in_progress",
        kind: "one_time",
        createdAt: "2026-11-01T09:00:00Z",
        updatedAt: "2026-11-01T09:00:00Z",
      },
      {
        id: G.ielts,
        title: "IELTS listening, section 3",
        status: "in_progress",
        kind: "ongoing",
        createdAt: "2026-10-20T09:00:00Z",
        updatedAt: "2026-10-20T09:00:00Z",
      },
      {
        id: G.portfolio,
        title: "Portfolio case study",
        status: "on_hold",
        kind: "one_time",
        createdAt: "2026-10-25T09:00:00Z",
        updatedAt: "2026-10-29T09:00:00Z",
      },
      {
        id: G.lab,
        title: "Lab report",
        status: "done",
        kind: "one_time",
        createdAt: "2026-10-30T09:00:00Z",
        updatedAt: "2026-11-03T12:00:00Z",
      },
    ],
    steps: [
      {
        id: "s-m1",
        goalId: G.methods,
        position: 0,
        title: "Gather what you need",
        description: "Collect the notes and sources.",
        minutes: 15,
      },
      {
        id: "s-m2",
        goalId: G.methods,
        position: 1,
        title: "Rough first pass",
        description: null,
        minutes: 15,
      },
      {
        id: "s-p1",
        goalId: G.portfolio,
        position: 0,
        title: "Pick the project",
        description: "Choose one.",
        minutes: 10,
      },
      {
        id: "s-p2",
        goalId: G.portfolio,
        position: 1,
        title: "Write it up",
        description: "",
        minutes: 10,
      },
      {
        id: "s-l1",
        goalId: G.lab,
        position: 0,
        title: "Results table",
        description: null,
        minutes: 30,
      },
    ],
    sessions: [
      {
        id: "x-m",
        goalId: G.methods,
        state: "open",
        companionId: "oppenheimer",
        startedAt: "2026-11-11T09:00:00Z",
        lastActiveAt: "2026-11-11T09:30:00Z",
      },
      {
        id: "x-i1",
        goalId: G.ielts,
        state: "completed",
        companionId: "oppenheimer",
        startedAt: "2026-11-09T08:00:00Z",
        lastActiveAt: "2026-11-09T08:45:00Z",
      },
      {
        id: "x-p",
        goalId: G.portfolio,
        state: "on_hold",
        companionId: "unassigned",
        startedAt: "2026-10-29T08:00:00Z",
        lastActiveAt: "2026-10-29T08:20:00Z",
      },
      {
        id: "x-l",
        goalId: G.lab,
        state: "completed",
        companionId: "oppenheimer",
        startedAt: "2026-11-03T10:00:00Z",
        lastActiveAt: "2026-11-03T10:30:00Z",
      },
      {
        id: "x-empty",
        goalId: G.lab,
        state: "restarted",
        companionId: "oppenheimer",
        startedAt: "2026-11-02T10:00:00Z",
        lastActiveAt: "2026-11-02T10:05:00Z",
      },
    ],
    sessionSteps: [
      { sessionId: "x-m", stepId: "s-m1", doneAt: "2026-11-11T09:20:00Z" },
      { sessionId: "x-m", stepId: "s-m2", doneAt: null },
      { sessionId: "x-i1", stepId: "s-i-gone", doneAt: "2026-11-09T08:20:00Z" },
      { sessionId: "x-i1", stepId: "s-i-gone-2", doneAt: "2026-11-09T08:40:00Z" },
      { sessionId: "x-p", stepId: "s-p1", doneAt: "2026-10-29T08:15:00Z" },
      { sessionId: "x-p", stepId: "s-p2", doneAt: null },
      { sessionId: "x-l", stepId: "s-l1", doneAt: "2026-11-03T10:30:00Z" },
      { sessionId: "x-empty", stepId: "s-l1", doneAt: null },
    ],
    companions: seedContent().companions,
  };
}

describe("the Goals lists (prototype v4 G1, G5, G5-D)", () => {
  it("#73 AC1 sorts Goals into In progress, On hold and Done; planned counts as In progress", () => {
    const input = data();
    input.goals.push({
      id: G.planned,
      title: "Plan a trip",
      status: "planned",
      kind: "one_time",
      createdAt: "2026-11-10T09:00:00Z",
      updatedAt: null,
    });
    const lists = goalsLists(input, on);
    expect(lists.oneTime.map((row) => row.title)).toEqual([
      "Methods section for Friday",
      "Plan a trip",
    ]);
    expect(lists.ongoing.map((row) => row.title)).toEqual(["IELTS listening, section 3"]);
    expect(lists.hold.map((row) => row.title)).toEqual(["Portfolio case study"]);
    expect(lists.done.map((row) => row.title)).toEqual(["Lab report"]);
  });

  it("#73 AC2 groups In progress under Ongoing and One-time, last used first", () => {
    const input = data();
    input.goals.push({
      id: G.planned,
      title: "Newer, never used",
      status: "in_progress",
      kind: "one_time",
      createdAt: "2026-11-11T13:00:00Z",
      updatedAt: "2026-11-11T13:00:00Z",
    });
    expect(goalsLists(input, on).oneTime.map((row) => row.title)).toEqual([
      "Newer, never used",
      "Methods section for Friday",
    ]);
  });

  it("#73 AC3 the activity line says N done today, else N done this week, else nothing", () => {
    const lists = goalsLists(data(), on);
    expect(lists.oneTime[0].activity).toBe("1 done today");
    expect(lists.ongoing[0].activity).toBe("2 done this week");
    expect(lists.hold[0].activity).toBeNull();
    expect(lists.done[0].activity).toBeNull();
  });

  it("#73 AC3 a day is the device's local day: 23:59 and 00:01 are different days", () => {
    const input = data();
    // 22:59 and 23:01 UTC are 23:59 on the 10th and 00:01 on the 11th in Berlin.
    input.sessionSteps = [
      { sessionId: "x-m", stepId: "s-m1", doneAt: "2026-11-10T22:59:00Z" },
      { sessionId: "x-m", stepId: "s-m2", doneAt: "2026-11-10T23:01:00Z" },
    ];
    expect(goalsLists(input, on).oneTime[0].activity).toBe("1 done today");
  });

  it("#73 AC3 #278 a row always offers Continue with Steps and Start without", () => {
    const lists = goalsLists(data(), on);
    expect(lists.oneTime[0]).toMatchObject({
      action: "continue",
      actionHref: `/focus?goal=${G.methods}`,
    });
    expect(lists.ongoing[0]).toMatchObject({
      action: "start",
      actionHref: startHref("IELTS listening, section 3"),
    });
  });

  it("test_75_ac5_an_ongoing_goal_after_its_last_step_offers_start_for_a_new_run", () => {
    const input = data();
    input.steps.push({
      id: "s-i1",
      goalId: G.ielts,
      position: 0,
      title: "Listen once",
      description: null,
      minutes: 10,
    });
    // Its only session is completed: no open Plan, so the row says Start, and Start opens a new
    // run of the same Steps on the focus page (not a new Goal).
    const lists = goalsLists(input, on);
    expect(lists.ongoing[0]).toMatchObject({
      action: "start",
      actionHref: `/focus?goal=${G.ielts}`,
    });
    expect(goalDetail(input, G.ielts, on)).toMatchObject({
      status: "in_progress",
      primary: "start",
      primaryHref: `/focus?goal=${G.ielts}`,
    });
  });

  it("#79 AC2 AC5 On hold rows offer Resume and Done rows Reopen", () => {
    const lists = goalsLists(data(), on);
    expect(lists.hold[0].action).toBe("resume");
    expect(lists.done[0].action).toBe("reopen");
  });

  it("#73 a row shows the Companion of the Goal's newest session; an unknown one is Oppenheimer", () => {
    const lists = goalsLists(data(), on);
    expect(lists.hold[0]).toMatchObject({
      companion: "Oppenheimer",
      portrait: "/companions/oppenheimer.png",
    });
  });

  it("#73 AC4 shows the first five rows", () => {
    expect(SHOW_FIRST).toBe(5);
  });

  it("#73 search matches titles case-insensitively", () => {
    expect(matchesSearch("ielts", "IELTS listening, section 3")).toBe(true);
    expect(matchesSearch("  ", "Anything")).toBe(true);
    expect(matchesSearch("lab", "Methods section")).toBe(false);
  });
});

describe("#80 the History tab (G6)", () => {
  it("#80 AC1 AC2 lists sessions with a done Step, newest first, with the date, the minutes of the done Steps and their titles", () => {
    const history = goalsLists(data(), on).history;
    expect(history.map((row) => row.sessionId)).toEqual(["x-m", "x-i1", "x-l", "x-p"]);
    expect(history[0]).toMatchObject({
      goalTitle: "Methods section for Friday",
      date: "Nov 11",
      minutes: 15,
      doneSteps: ["Gather what you need"],
    });
    expect(history.find((row) => row.sessionId === "x-l")).toMatchObject({
      date: "Nov 3",
      minutes: 30,
    });
    // Steps of a replaced Plan have no row any more: their titles are not shown and add no minutes.
    expect(history.find((row) => row.sessionId === "x-i1")).toMatchObject({
      minutes: 0,
      doneSteps: [],
    });
  });
});

describe("#112 filter History by Goal and time range (G6)", () => {
  const history = () => goalsLists(data(), on).history;
  const ids = (rows: { sessionId: string }[]) => rows.map((row) => row.sessionId);

  it("test_112_ac2_all_goals_and_all_time_keep_every_row", () => {
    expect(ids(filterHistory(history(), { goalId: null, range: "all" }, on))).toEqual([
      "x-m",
      "x-i1",
      "x-l",
      "x-p",
    ]);
  });

  it("test_112_ac2_this_week_starts_on_monday_on_the_device_calendar", () => {
    // Wednesday 11 November in Berlin: the week began on Monday 9 November.
    expect(ids(filterHistory(history(), { goalId: null, range: "week" }, on))).toEqual([
      "x-m",
      "x-i1",
    ]);
  });

  it("test_112_ac2_this_month_is_the_calendar_month", () => {
    expect(ids(filterHistory(history(), { goalId: null, range: "month" }, on))).toEqual([
      "x-m",
      "x-i1",
      "x-l",
    ]);
  });

  it("test_112_ac2_a_goal_keeps_only_its_sessions_and_combines_with_the_range", () => {
    expect(ids(filterHistory(history(), { goalId: G.portfolio, range: "all" }, on))).toEqual([
      "x-p",
    ]);
    expect(filterHistory(history(), { goalId: G.portfolio, range: "month" }, on)).toEqual([]);
  });

  it("test_112_ac2_the_week_follows_the_time_zone", () => {
    // A day before Monday is outside the week; the days are read on the device's calendar.
    const rows = [{ ...history()[0], day: "2026-11-08" }];
    expect(filterHistory(rows, { goalId: null, range: "week" }, on)).toEqual([]);
    expect(
      ids(
        filterHistory(
          goalsLists(data(), { now: NOW, timeZone: "Asia/Tokyo" }).history,
          { goalId: null, range: "week" },
          { now: NOW, timeZone: "Asia/Tokyo" },
        ),
      ),
    ).toEqual(["x-m", "x-i1"]);
  });

  it("test_112_ac2_the_goal_choices_are_the_goals_in_history_once_each", () => {
    expect(historyGoals(history())).toEqual([
      { id: G.methods, title: "Methods section for Friday" },
      { id: G.ielts, title: "IELTS listening, section 3" },
      { id: G.lab, title: "Lab report" },
      { id: G.portfolio, title: "Portfolio case study" },
    ]);
  });
});

describe("#78 the Goal detail (G4, G4-N, G4-H)", () => {
  it("#78 AC1 AC2 lists the Steps in order with title, description and done state, and offers Continue", () => {
    const detail = goalDetail(data(), G.methods, on)!;
    expect(detail).toMatchObject({
      title: "Methods section for Friday",
      statusLabel: "In progress",
      companion: "Oppenheimer",
      kind: "one_time",
      primary: "continue",
      primaryHref: `/focus?goal=${G.methods}`,
      canHold: true,
      canDone: true,
    });
    expect(detail.steps).toEqual([
      {
        id: "s-m1",
        title: "Gather what you need",
        description: "Collect the notes and sources.",
        done: true,
      },
      { id: "s-m2", title: "Rough first pass", description: null, done: false },
    ]);
  });

  it("#78 AC3 without Steps there is no list and Start opens the dialogue with the title", () => {
    const detail = goalDetail(data(), G.ielts, on)!;
    expect(detail.steps).toBeNull();
    expect(detail).toMatchObject({
      primary: "start",
      primaryHref: startHref("IELTS listening, section 3"),
    });
  });

  it("#78 AC4 on hold offers Resume, and the Steps done in the parked session show done", () => {
    const detail = goalDetail(data(), G.portfolio, on)!;
    expect(detail).toMatchObject({
      statusLabel: "On hold",
      primary: "resume",
      canHold: false,
      canDone: true,
    });
    expect(detail.steps?.map((step) => step.done)).toEqual([true, false]);
  });

  it("#79 AC3 a Done Goal's detail shows no Steps, so no unfinished Step is shown", () => {
    const input = data();
    // Marked done with one of two Steps finished: Mark done parked the open session.
    input.goals.find((goal) => goal.id === G.methods)!.status = "done";
    input.sessions.find((session) => session.id === "x-m")!.state = "on_hold";
    expect(goalDetail(input, G.methods, on)!.steps).toBeNull();
  });

  it("#79 Undo of a change to a planned Goal brings it back to In progress", () => {
    expect(undoStatusFor("planned")).toBe("in_progress");
    expect(undoStatusFor("on_hold")).toBe("on_hold");
    expect(undoStatusFor("done")).toBe("done");
    expect(undoStatusFor("in_progress")).toBe("in_progress");
  });

  it("#79 a Done Goal's detail offers Reopen and no Mark done", () => {
    const detail = goalDetail(data(), G.lab, on)!;
    expect(detail).toMatchObject({
      statusLabel: "Done",
      primary: "reopen",
      canHold: true,
      canDone: false,
    });
  });

  it("#80 the detail's recent sessions are this Goal's History rows, at most three", () => {
    expect(goalDetail(data(), G.lab, on)!.recent.map((row) => row.sessionId)).toEqual(["x-l"]);
  });

  it("is null for a Goal that is not in the data", () => {
    expect(goalDetail(data(), "99999999-9999-4999-8999-999999999999", on)).toBeNull();
  });
});

describe("links and parameters", () => {
  it("#77 AC2 Start and the New goal arrow open the dialogue with the line", () => {
    expect(startHref("Methods, part 2")).toBe("/goal?line=Methods%2C%20part%202");
  });

  it("#77 parseLine keeps the first value, trimmed, at most 1000 characters", () => {
    expect(parseLine("  Methods  ")).toBe("Methods");
    expect(parseLine(["a", "b"])).toBe("a");
    expect(parseLine(undefined)).toBe("");
    expect(parseLine("x".repeat(1200))).toHaveLength(1000);
  });

  it("#73 AC1 parseTab knows the four tabs and defaults to In progress", () => {
    expect(parseTab("hold")).toBe("hold");
    expect(parseTab("history")).toBe("history");
    expect(parseTab("nope")).toBe("progress");
    expect(parseTab(undefined)).toBe("progress");
  });
});
