import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Export my data (#103 AC1): every row the account owns in the six user-data tables, read through
 * the signed-in user's own client (row-level security) and filtered by their id as well. A failed
 * read fails the whole export, so a user never receives a file that silently misses rows.
 */

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };
type Query = PromiseLike<Result> & {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  in(column: string, values: string[]): Query;
  range(from: number, to: number): Query;
};

export type AccountExport = {
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: Row | null;
  goals: Row[];
  steps: Row[];
  sessions: Row[];
  sessionSteps: Row[];
  sessionLines: Row[];
};

/** Ids per `in` filter, so a long history never makes one request URL too long. */
const CHUNK = 100;

/** The API returns at most this many rows per request; longer results are read page by page. */
const PAGE = 1000;

/** Reads every page of one query, so a large history is never cut off at the API's row limit. */
async function rows(query: () => Query): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const result = await query().range(from, from + PAGE - 1);
    if (result.error) throw new Error("export read failed");
    const page = Array.isArray(result.data) ? (result.data as Row[]) : [];
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

async function rowsIn(
  table: (name: string) => Query,
  name: string,
  column: string,
  ids: string[],
): Promise<Row[]> {
  const parts: Promise<Row[]>[] = [];
  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK);
    parts.push(rows(() => table(name).select("*").in(column, chunk)));
  }
  return (await Promise.all(parts)).flat();
}

const idsOf = (list: Row[]) =>
  list.map((row) => row.id).filter((id): id is string => typeof id === "string");

export async function readAccountExport(
  client: SupabaseClient,
  user: { id: string; email: string | null },
  now: Date,
): Promise<AccountExport> {
  const table = (name: string) => client.from(name) as unknown as Query;
  const [profiles, goals, sessions] = await Promise.all([
    rows(() => table("profiles").select("*").eq("user_id", user.id)),
    rows(() => table("goals").select("*").eq("user_id", user.id)),
    rows(() => table("sessions").select("*").eq("user_id", user.id)),
  ]);
  const sessionIds = idsOf(sessions);
  const [steps, sessionSteps, sessionLines] = await Promise.all([
    rowsIn(table, "steps", "goal_id", idsOf(goals)),
    rowsIn(table, "session_steps", "session_id", sessionIds),
    rowsIn(table, "session_lines", "session_id", sessionIds),
  ]);
  return {
    exportedAt: now.toISOString(),
    account: { id: user.id, email: user.email },
    profile: profiles[0] ?? null,
    goals,
    steps,
    sessions,
    sessionSteps,
    sessionLines,
  };
}

export function exportFileName(now: Date): string {
  return `waveparticle-data-${now.toISOString().slice(0, 10)}.json`;
}
