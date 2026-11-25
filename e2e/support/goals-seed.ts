import type { StubTables } from "./account";

// The prototype v4 sample Goals (#73), as rows for the test-only Supabase stub. Times are relative
// to `now` (the moment the test seeds, unless it passes one), and the Step done "today" is on the
// calendar day of `now` in the browser's time zone, also in the first minutes after midnight (#428).

export const GOAL = {
  methods: "11111111-1111-4111-8111-111111111111",
  ielts: "22222222-2222-4222-8222-222222222222",
  portfolio: "33333333-3333-4333-8333-333333333333",
  lab: "44444444-4444-4444-8444-444444444444",
};

export const SESSION = {
  methods: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  portfolio: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  lab: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  labEmpty: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
};

type Ago = (minutes: number) => string;
const agoFrom =
  (now: Date): Ago =>
  (minutes) =>
    new Date(now.getTime() - minutes * 60_000).toISOString();
const DAY = 24 * 60;

/** The time of day of `at` in `timeZone`, in milliseconds since that day's midnight. */
function sinceMidnight(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return ((part("hour") * 60 + part("minute")) * 60 + part("second")) * 1000 + at.getMilliseconds();
}

/** `minutes` before `now`, but never before the start of `now`'s day in `timeZone`. */
function earlierToday(now: Date, timeZone: string, minutes: number): string {
  const back = Math.min(minutes * 60_000, sinceMidnight(now, timeZone));
  return new Date(now.getTime() - back).toISOString();
}

export type SeedClock = {
  /** The moment the rows are relative to; the browser's clock should show the same. */
  now?: Date;
  /** The browser's time zone (Playwright's `timezoneId`); by default this machine's. */
  timeZone?: string;
};

function goal(
  ago: Ago,
  id: string,
  userId: string,
  title: string,
  status: string,
  kind: string,
  minutesAgo: number,
) {
  return {
    id,
    user_id: userId,
    title,
    text: title,
    status,
    kind,
    created_at: ago(minutesAgo + 60),
    updated_at: ago(minutesAgo),
  };
}

function step(
  id: string,
  goalId: string,
  position: number,
  title: string,
  description: string | null,
  minutes: number,
) {
  return { id, goal_id: goalId, position, title, description, minutes };
}

function session(
  ago: Ago,
  id: string,
  goalId: string,
  userId: string,
  state: string,
  minutesAgo: number,
) {
  return {
    id,
    goal_id: goalId,
    user_id: userId,
    state,
    companion_id: "oppenheimer",
    story_id: "s",
    seed: "s",
    step_count: 2,
    started_at: ago(minutesAgo + 30),
    last_active_at: ago(minutesAgo),
    completed_at: null,
  };
}

export function sampleGoals(userId: string, clock: SeedClock = {}): StubTables {
  const now = clock.now ?? new Date();
  const timeZone = clock.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ago = agoFrom(now);
  return {
    goals: [
      goal(ago, GOAL.methods, userId, "Methods section for Friday", "in_progress", "one_time", 5),
      goal(
        ago,
        GOAL.ielts,
        userId,
        "IELTS listening, section 3",
        "in_progress",
        "ongoing",
        2 * DAY,
      ),
      goal(ago, GOAL.portfolio, userId, "Portfolio case study", "on_hold", "one_time", 15 * DAY),
      goal(ago, GOAL.lab, userId, "Lab report", "done", "one_time", 10 * DAY),
    ],
    steps: [
      step(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
        GOAL.methods,
        0,
        "Gather what you need",
        "Collect the notes and sources you will use; watch for anything missing before you start writing.",
        15,
      ),
      step(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
        GOAL.methods,
        1,
        "Rough first pass",
        "Write it through once without stopping to polish.",
        15,
      ),
      step("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03", GOAL.methods, 2, "Second pass", null, 15),
      step("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04", GOAL.methods, 3, "Check and tidy", null, 15),
      step(
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11",
        GOAL.portfolio,
        0,
        "Pick the project",
        "Choose the one you can explain best.",
        10,
      ),
      step("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12", GOAL.portfolio, 1, "Write it up", null, 10),
      step("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21", GOAL.lab, 0, "Results table", null, 30),
    ],
    sessions: [
      session(ago, SESSION.methods, GOAL.methods, userId, "open", 5),
      session(ago, SESSION.portfolio, GOAL.portfolio, userId, "on_hold", 15 * DAY),
      session(ago, SESSION.lab, GOAL.lab, userId, "completed", 10 * DAY),
      session(ago, SESSION.labEmpty, GOAL.lab, userId, "restarted", 11 * DAY),
    ],
    session_steps: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
        session_id: SESSION.methods,
        step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
        position: 0,
        opened_at: ago(30),
        // "1 done today" on the Goals row (#73 AC3): 5 minutes ago, or at midnight if it is not 00:05.
        done_at: earlierToday(now, timeZone, 5),
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccc02",
        session_id: SESSION.methods,
        step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
        position: 1,
        opened_at: ago(5),
        done_at: null,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccc11",
        session_id: SESSION.portfolio,
        step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11",
        position: 0,
        opened_at: ago(15 * DAY + 30),
        done_at: ago(15 * DAY + 10),
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccc12",
        session_id: SESSION.portfolio,
        step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb12",
        position: 1,
        opened_at: null,
        done_at: null,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccc21",
        session_id: SESSION.lab,
        step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21",
        position: 0,
        opened_at: ago(10 * DAY + 30),
        done_at: ago(10 * DAY),
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccc22",
        session_id: SESSION.labEmpty,
        step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21",
        position: 0,
        opened_at: null,
        done_at: null,
      },
    ],
  };
}

/** Extra In progress Goals for Show more (#73 AC4). */
export function manyGoals(userId: string, count: number): StubTables {
  const ago = agoFrom(new Date());
  return {
    goals: Array.from({ length: count }, (_, index) =>
      goal(
        ago,
        `dddddddd-dddd-4ddd-8ddd-${String(index).padStart(12, "0")}`,
        userId,
        `Goal number ${index + 1}`,
        "in_progress",
        "one_time",
        index * 10,
      ),
    ),
  };
}
