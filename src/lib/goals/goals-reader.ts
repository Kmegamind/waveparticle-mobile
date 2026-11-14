import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoalKind, GoalStatus, GoalsData } from "./goals-view";

/**
 * Reads what the Goals area shows (#73, #78, #80) through the signed-in user's own client, so
 * row-level security keeps it to their own rows. `select("*")` so the pages still work before the
 * `goals.kind` migration is applied: a missing or unknown kind reads as One-time. Errors carry no
 * row data.
 */

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };
type Query = PromiseLike<Result> & {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  in(column: string, values: string[]): Query;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGoalId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const nullableText = (value: unknown) => (typeof value === "string" ? value : null);
const number = (value: unknown) => (typeof value === "number" ? value : Number(value) || 0);

const STATUSES: GoalStatus[] = ["planned", "in_progress", "on_hold", "done"];
const STATES = ["open", "on_hold", "completed", "restarted"] as const;

/** Ids per `in` filter: a long history never makes one request URL too long for the gateway. */
const CHUNK = 100;

async function rowsIn(
  table: (name: string) => Query,
  name: string,
  column: string,
  ids: string[],
): Promise<Row[]> {
  const parts: Promise<Row[]>[] = [];
  for (let start = 0; start < ids.length; start += CHUNK) {
    parts.push(
      rows(
        table(name)
          .select("*")
          .in(column, ids.slice(start, start + CHUNK)),
      ),
    );
  }
  return (await Promise.all(parts)).flat();
}

async function rows(query: Query): Promise<Row[]> {
  const result = await query;
  if (result.error) throw new Error("goals read failed");
  return Array.isArray(result.data) ? (result.data as Row[]) : [];
}

export async function readGoalsData(
  client: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<GoalsData> {
  const from = (table: string) => client.from(table) as unknown as Query;
  const goalRows = await rows(from("goals").select("*").eq("user_id", userId));
  const goalIds = goalRows.map((row) => text(row.id));
  const [stepRows, sessionRows] = await Promise.all([
    rowsIn(from, "steps", "goal_id", goalIds),
    rows(from("sessions").select("*").eq("user_id", userId)),
  ]);
  const sessionIds = sessionRows.map((row) => text(row.id));
  const sessionStepRows = await rowsIn(from, "session_steps", "session_id", sessionIds);

  return {
    goals: goalRows.map((row) => ({
      id: text(row.id),
      title: text(row.title),
      status: STATUSES.includes(row.status as GoalStatus) ? (row.status as GoalStatus) : "planned",
      kind: (row.kind === "ongoing" ? "ongoing" : "one_time") as GoalKind,
      createdAt: text(row.created_at),
      updatedAt: nullableText(row.updated_at),
    })),
    steps: stepRows.map((row) => ({
      id: text(row.id),
      goalId: text(row.goal_id),
      position: number(row.position),
      title: text(row.title),
      description: nullableText(row.description),
      minutes: number(row.minutes),
    })),
    sessions: sessionRows.map((row) => ({
      id: text(row.id),
      goalId: text(row.goal_id),
      state: STATES.includes(row.state as (typeof STATES)[number])
        ? (row.state as (typeof STATES)[number])
        : "restarted",
      companionId: text(row.companion_id),
      startedAt: nullableText(row.started_at),
      lastActiveAt: nullableText(row.last_active_at),
    })),
    sessionSteps: sessionStepRows.map((row) => ({
      sessionId: text(row.session_id),
      stepId: text(row.step_id),
      doneAt: nullableText(row.done_at),
    })),
  };
}
