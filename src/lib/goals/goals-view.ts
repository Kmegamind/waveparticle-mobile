import { continueHref } from "@/app/continue-link";
import { companionById } from "@/content/companions";

/**
 * The Goals area of prototype v4 (#73, #77, #78, #79, #80): what each tab, row and detail page
 * shows, from the account's Goals, Steps and sessions. Pure: no Supabase, no React, no clock of its
 * own (the caller passes `now` and the device's time zone). It never yields "x of y", a bar, a
 * last-active date, total minutes, a streak or a percentage.
 */

export type GoalKind = "one_time" | "ongoing";
export type GoalStatus = "planned" | "in_progress" | "on_hold" | "done";

export type GoalsData = {
  goals: {
    id: string;
    title: string;
    status: GoalStatus;
    kind: GoalKind;
    createdAt: string;
    updatedAt: string | null;
  }[];
  steps: {
    id: string;
    goalId: string;
    position: number;
    title: string;
    description: string | null;
    minutes: number;
  }[];
  sessions: {
    id: string;
    goalId: string;
    state: "open" | "on_hold" | "completed" | "restarted";
    companionId: string;
    startedAt: string | null;
    lastActiveAt: string | null;
  }[];
  sessionSteps: { sessionId: string; stepId: string; doneAt: string | null }[];
};

export type RowAction = "continue" | "start" | "resume" | "reopen";

export type GoalRow = {
  id: string;
  title: string;
  portrait: string;
  companion: string;
  /** "1 done today" or "2 done this week" on the In progress tab; otherwise null. */
  activity: string | null;
  action: RowAction | null;
  /** Where Continue or Start goes; null for Resume and Reopen (they are status changes). */
  actionHref: string | null;
  status: GoalStatus;
};

export type HistoryRow = {
  sessionId: string;
  goalId: string;
  goalTitle: string;
  /** "Nov 3": the day of the session's newest done Step, on the device's calendar. */
  date: string;
  /** The planned minutes of the Steps marked done in this session (no measured time is stored). */
  minutes: number;
  doneSteps: string[];
};

export type GoalsLists = {
  ongoing: GoalRow[];
  oneTime: GoalRow[];
  hold: GoalRow[];
  done: GoalRow[];
  history: HistoryRow[];
};

export type ViewOptions = { now: Date; timeZone: string; sessionPagesEnabled: boolean };

export type GoalDetail = {
  id: string;
  title: string;
  status: GoalStatus;
  kind: GoalKind;
  statusLabel: "In progress" | "On hold" | "Done";
  companion: string;
  /** Null when nothing is open ("Nothing open right now."). */
  steps: { id: string; title: string; description: string | null; done: boolean }[] | null;
  recent: HistoryRow[];
  primary: RowAction | null;
  primaryHref: string | null;
  canHold: boolean;
  canDone: boolean;
};

export type GoalsTab = "progress" | "hold" | "done" | "history";

export const SHOW_FIRST = 5;
const RECENT_MAX = 3;
const LINE_MAX = 1000;
const TABS: GoalsTab[] = ["progress", "hold", "done", "history"];

type Goal = GoalsData["goals"][number];
type Session = GoalsData["sessions"][number];

const time = (value: string | null | undefined) => (value ? Date.parse(value) || 0 : 0);

function dayKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** The Monday of the local week, as a day key. */
function weekKey(at: Date, timeZone: string): string {
  const [year, month, day] = dayKey(at, timeZone).split("-").map(Number);
  const local = new Date(Date.UTC(year, month - 1, day));
  const fromMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - fromMonday);
  return local.toISOString().slice(0, 10);
}

function shortDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(at);
}

export function startHref(title: string): string {
  return `/goal?line=${encodeURIComponent(title)}`;
}

export function parseLine(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim().slice(0, LINE_MAX) : "";
}

export function parseTab(raw: string | string[] | undefined): GoalsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.includes(value as GoalsTab) ? (value as GoalsTab) : "progress";
}

/**
 * The status Undo sends back. Main's status rule takes `in_progress`, `on_hold` and `done`; a
 * `planned` Goal shows as In progress, so Undo returns it to In progress (#79).
 */
export function undoStatusFor(previous: GoalStatus): Exclude<GoalStatus, "planned"> {
  return previous === "planned" ? "in_progress" : previous;
}

export function matchesSearch(query: string, title: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || title.toLowerCase().includes(needle);
}

function indexData(data: GoalsData) {
  const sessionsOf = new Map<string, Session[]>();
  for (const session of data.sessions) {
    sessionsOf.set(session.goalId, [...(sessionsOf.get(session.goalId) ?? []), session]);
  }
  const doneOf = new Map<string, { stepId: string; doneAt: string }[]>();
  for (const row of data.sessionSteps) {
    if (!row.doneAt) continue;
    doneOf.set(row.sessionId, [
      ...(doneOf.get(row.sessionId) ?? []),
      { stepId: row.stepId, doneAt: row.doneAt },
    ]);
  }
  const stepsOf = new Map<string, GoalsData["steps"]>();
  for (const step of data.steps) {
    stepsOf.set(step.goalId, [...(stepsOf.get(step.goalId) ?? []), step]);
  }
  for (const steps of stepsOf.values()) steps.sort((left, right) => left.position - right.position);
  const stepById = new Map(data.steps.map((step) => [step.id, step]));
  return { sessionsOf, doneOf, stepsOf, stepById };
}

type Index = ReturnType<typeof indexData>;

const sessionTime = (session: Session) =>
  Math.max(time(session.lastActiveAt), time(session.startedAt));

function lastUsed(goal: Goal, index: Index): number {
  let newest = Math.max(time(goal.updatedAt), time(goal.createdAt));
  for (const session of index.sessionsOf.get(goal.id) ?? []) {
    newest = Math.max(newest, sessionTime(session));
    for (const done of index.doneOf.get(session.id) ?? [])
      newest = Math.max(newest, time(done.doneAt));
  }
  return newest;
}

function companionOf(goal: Goal, index: Index) {
  const newest = [...(index.sessionsOf.get(goal.id) ?? [])].sort(
    (left, right) => sessionTime(right) - sessionTime(left),
  )[0];
  return companionById(newest?.companionId ?? "oppenheimer");
}

function activityOf(goal: Goal, index: Index, options: ViewOptions): string | null {
  const today = dayKey(options.now, options.timeZone);
  const week = weekKey(options.now, options.timeZone);
  let todayCount = 0;
  let weekCount = 0;
  for (const session of index.sessionsOf.get(goal.id) ?? []) {
    for (const done of index.doneOf.get(session.id) ?? []) {
      const at = new Date(done.doneAt);
      if (dayKey(at, options.timeZone) === today) todayCount += 1;
      if (weekKey(at, options.timeZone) === week) weekCount += 1;
    }
  }
  if (todayCount > 0) return `${todayCount} done today`;
  if (weekCount > 0) return `${weekCount} done this week`;
  return null;
}

const inProgress = (goal: Goal) => goal.status === "in_progress" || goal.status === "planned";

/** Continue (Steps exist) or Start (none) for an In progress Goal, while the session pages exist. */
function openAction(goal: Goal, index: Index, options: ViewOptions) {
  if (!options.sessionPagesEnabled) return { action: null, actionHref: null };
  if ((index.stepsOf.get(goal.id) ?? []).length === 0) {
    return { action: "start" as const, actionHref: startHref(goal.title) };
  }
  const href = continueHref({ id: goal.id, status: "in_progress" }, true);
  return { action: href ? ("continue" as const) : null, actionHref: href };
}

function rowOf(goal: Goal, index: Index, options: ViewOptions): GoalRow {
  const companion = companionOf(goal, index);
  const base = {
    id: goal.id,
    title: goal.title,
    portrait: companion.portrait,
    companion: companion.shortName,
    status: goal.status,
  };
  if (goal.status === "on_hold")
    return { ...base, activity: null, action: "resume", actionHref: null };
  if (goal.status === "done")
    return { ...base, activity: null, action: "reopen", actionHref: null };
  return {
    ...base,
    activity: activityOf(goal, index, options),
    ...openAction(goal, index, options),
  };
}

function historyRows(data: GoalsData, index: Index, options: ViewOptions): HistoryRow[] {
  const goalById = new Map(data.goals.map((goal) => [goal.id, goal]));
  const rows: (HistoryRow & { at: number })[] = [];
  for (const session of data.sessions) {
    const done = index.doneOf.get(session.id) ?? [];
    const goal = goalById.get(session.goalId);
    if (done.length === 0 || !goal) continue;
    const at = Math.max(...done.map((item) => time(item.doneAt)));
    const steps = done
      .map((item) => index.stepById.get(item.stepId))
      .filter((step) => step !== undefined)
      .sort((left, right) => left.position - right.position);
    rows.push({
      sessionId: session.id,
      goalId: goal.id,
      goalTitle: goal.title,
      date: shortDate(new Date(at), options.timeZone),
      minutes: steps.reduce((sum, step) => sum + step.minutes, 0),
      doneSteps: steps.map((step) => step.title),
      at,
    });
  }
  return rows
    .sort((left, right) => right.at - left.at)
    .map((row) => {
      const { at, ...rest } = row;
      void at;
      return rest;
    });
}

export function goalsLists(data: GoalsData, options: ViewOptions): GoalsLists {
  const index = indexData(data);
  const byLastUsed = (goals: Goal[]) =>
    [...goals]
      .sort((left, right) => lastUsed(right, index) - lastUsed(left, index))
      .map((goal) => rowOf(goal, index, options));
  const progress = data.goals.filter(inProgress);
  return {
    ongoing: byLastUsed(progress.filter((goal) => goal.kind === "ongoing")),
    oneTime: byLastUsed(progress.filter((goal) => goal.kind !== "ongoing")),
    hold: byLastUsed(data.goals.filter((goal) => goal.status === "on_hold")),
    done: byLastUsed(data.goals.filter((goal) => goal.status === "done")),
    history: historyRows(data, index, options),
  };
}

const STATUS_LABEL = {
  planned: "In progress",
  in_progress: "In progress",
  on_hold: "On hold",
  done: "Done",
} as const;

/** The session whose done marks the detail shows: the open one, else the newest parked one. */
function planSession(goal: Goal, index: Index): Session | undefined {
  const sessions = [...(index.sessionsOf.get(goal.id) ?? [])].sort(
    (left, right) => sessionTime(right) - sessionTime(left),
  );
  return (
    sessions.find((session) => session.state === "open") ??
    sessions.find((session) => session.state === "on_hold")
  );
}

export function goalDetail(
  data: GoalsData,
  goalId: string,
  options: ViewOptions,
): GoalDetail | null {
  const goal = data.goals.find((item) => item.id === goalId);
  if (!goal) return null;
  const index = indexData(data);
  const steps = index.stepsOf.get(goal.id) ?? [];
  const session = planSession(goal, index);
  const done = new Set((session ? index.doneOf.get(session.id) : undefined)?.map((d) => d.stepId));
  const row = rowOf(goal, index, options);
  return {
    id: goal.id,
    title: goal.title,
    status: goal.status,
    kind: goal.kind,
    statusLabel: STATUS_LABEL[goal.status],
    companion: row.companion,
    // A Done Goal has no open Plan: its unfinished Steps are not shown (#79 AC3).
    steps:
      steps.length === 0 || goal.status === "done"
        ? null
        : steps.map((step) => ({
            id: step.id,
            title: step.title,
            description: step.description,
            done: done.has(step.id),
          })),
    recent: historyRows(data, index, options)
      .filter((item) => item.goalId === goal.id)
      .slice(0, RECENT_MAX),
    primary: row.action,
    primaryHref: row.actionHref,
    canHold: goal.status !== "on_hold",
    canDone: goal.status !== "done",
  };
}
