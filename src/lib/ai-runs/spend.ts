// #476 (FR-AILAB-3): today's spend and the spend by user, for the Runs page (#477). Server code
// only. Reads public.ai_run_spend through the signed-in editor's own client; "today" is the UTC day,
// as the admin shows other times in UTC.

type Answer = { data: unknown; error: unknown };
export type SpendRpc = (name: string, args: Record<string, unknown>) => Promise<Answer>;

export type UserSpend = {
  /** Null once the account is deleted. */
  userId: string | null;
  email: string | null;
  runs: number;
  /** Runs with no cost: no price set for the model, no tokens reported, or still running. */
  unpricedRuns: number;
  /** Runs started and never ended: a call that may have been billed with no record of its end. */
  runningRuns: number;
  /** US dollars, the sum of the known costs. */
  cost: number;
};

export type RunSpend = {
  day: string;
  runs: number;
  unpricedRuns: number;
  runningRuns: number;
  cost: number;
  byUser: UserSpend[];
};

/** The UTC day of `now`: its date and its start and end times. */
export function todayWindow(now: Date): { day: string; from: string; to: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    day: start.toISOString().slice(0, 10),
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

const round = (value: number) => Math.round(value * 1e8) / 1e8;
const num = (value: unknown) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
};

/** Today's spend, in total and by user; null when it cannot be read (a refused role included). */
export async function readRunSpend(
  rpc: SpendRpc,
  now: Date = new Date(),
): Promise<RunSpend | null> {
  const window = todayWindow(now);
  try {
    const { data, error } = await rpc("ai_run_spend", {
      from_time: window.from,
      to_time: window.to,
    });
    if (error || !Array.isArray(data)) return null;
    const byUser: UserSpend[] = data.map((row: Record<string, unknown>) => ({
      userId: typeof row.user_id === "string" ? row.user_id : null,
      email: typeof row.email === "string" ? row.email : null,
      runs: num(row.runs),
      unpricedRuns: num(row.unpriced_runs),
      runningRuns: num(row.running_runs),
      cost: round(num(row.cost)),
    }));
    return {
      day: window.day,
      runs: byUser.reduce((sum, row) => sum + row.runs, 0),
      unpricedRuns: byUser.reduce((sum, row) => sum + row.unpricedRuns, 0),
      runningRuns: byUser.reduce((sum, row) => sum + row.runningRuns, 0),
      cost: round(byUser.reduce((sum, row) => sum + row.cost, 0)),
      byUser,
    };
  } catch {
    return null;
  }
}
