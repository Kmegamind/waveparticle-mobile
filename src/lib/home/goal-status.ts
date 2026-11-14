import type { ProgressGoal } from "@/lib/progress/account-progress";

/**
 * Put on hold, Mark done and Undo on the Home Goal card (#268 AC4, #88). No question is asked.
 * The Goal's open session is parked as `on_hold` so the focus page, which resumes only open
 * sessions, never picks it up; Undo opens it again. The rules live here; the database is behind
 * `GoalStatusWriter`. No Goal text is read or logged.
 */

export type GoalStatus = ProgressGoal["status"];

export type GoalStatusWriter = {
  /** Null when the Goal is not this account's (row-level security hides it). */
  goalStatus(goalId: string): Promise<GoalStatus | null>;
  setGoal(goalId: string, status: GoalStatus): Promise<void>;
  /** The id of the Goal's open session (at most one: `sessions_one_open_per_goal`), or null. */
  sessionIn(goalId: string, state: "open"): Promise<string | null>;
  /** The Goal and state of one session of this account, or null. */
  sessionOf(sessionId: string): Promise<{ goalId: string; state: string } | null>;
  setSession(sessionId: string, state: "open" | "on_hold"): Promise<void>;
};

export type SetGoalStatusOutcome =
  | {
      status: "ok";
      previous: GoalStatus;
      /** The session this call parked; Undo passes it back so exactly that one reopens. */
      parkedSessionId?: string;
    }
  | { status: "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED = new Set<GoalStatus>(["on_hold", "done", "in_progress"]);

function parse(
  input: unknown,
): { goalId: string; status: GoalStatus; sessionId: string | null } | null {
  if (typeof input !== "object" || input === null) return null;
  const { goalId, status, sessionId } = input as Record<string, unknown>;
  if (typeof goalId !== "string" || !UUID.test(goalId)) return null;
  if (typeof status !== "string" || !ALLOWED.has(status as GoalStatus)) return null;
  return {
    goalId,
    status: status as GoalStatus,
    sessionId: typeof sessionId === "string" && sessionId.length <= 64 ? sessionId : null,
  };
}

export async function setGoalStatus(
  input: unknown,
  deps: { userId: string | null; writer: GoalStatusWriter },
): Promise<SetGoalStatusOutcome> {
  const request = parse(input);
  if (!deps.userId || !request) return { status: "failed" };
  const { writer } = deps;
  try {
    const previous = await writer.goalStatus(request.goalId);
    if (previous === null) return { status: "failed" };
    await writer.setGoal(request.goalId, request.status);
    if (request.status === "in_progress") {
      // Undo: reopen exactly the session this Goal's hold parked, if it is still parked and the
      // Goal has no open session meanwhile.
      if (request.sessionId && (await writer.sessionIn(request.goalId, "open")) === null) {
        const parked = await writer.sessionOf(request.sessionId);
        if (parked?.goalId === request.goalId && parked.state === "on_hold") {
          await writer.setSession(request.sessionId, "open");
        }
      }
      return { status: "ok", previous };
    }
    const open = await writer.sessionIn(request.goalId, "open");
    if (open) await writer.setSession(open, "on_hold");
    return open ? { status: "ok", previous, parkedSessionId: open } : { status: "ok", previous };
  } catch {
    return { status: "failed" };
  }
}
