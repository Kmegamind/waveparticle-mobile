import type { GoalStatus } from "./goal-status";

/**
 * Start over on HOME-3B (#87, US-HOME-3). The Goal's open session is marked `restarted`, so it
 * never counts as progress for the Companion; the focus page then opens a new session for the
 * same Plan at Step 1, with the Life Path's current story from its start (DECISIONS T5: his night
 * restarts too). Nothing is deleted. No Goal text is read or logged.
 */

export type StartOverWriter = {
  /** Null when the Goal is not this account's (row-level security hides it). */
  goalStatus(goalId: string): Promise<GoalStatus | null>;
  sessionIn(goalId: string, state: "open"): Promise<string | null>;
  setSession(sessionId: string, state: "restarted"): Promise<void>;
};

export type StartOverOutcome = { status: "ok" } | { status: "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startOver(
  input: unknown,
  deps: { userId: string | null; writer: StartOverWriter },
): Promise<StartOverOutcome> {
  if (!deps.userId || typeof input !== "object" || input === null) return { status: "failed" };
  const { goalId } = input as Record<string, unknown>;
  if (typeof goalId !== "string" || !UUID.test(goalId)) return { status: "failed" };
  try {
    if ((await deps.writer.goalStatus(goalId)) !== "in_progress") return { status: "failed" };
    const open = await deps.writer.sessionIn(goalId, "open");
    if (open) await deps.writer.setSession(open, "restarted");
    return { status: "ok" };
  } catch {
    return { status: "failed" };
  }
}
