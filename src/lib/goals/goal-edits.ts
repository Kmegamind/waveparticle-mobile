import type { SupabaseClient } from "@supabase/supabase-js";
import {
  setGoalStatus,
  type GoalStatusWriter,
  type SetGoalStatusOutcome,
} from "@/lib/home/goal-status";
import { keywordOnlySafetyCheck, type SafetyCheck } from "@/lib/safety/check";
import { isGoalId } from "./goals-reader";
import type { GoalKind } from "./goals-view";

/**
 * The Goals area's own writes (#78, #79): rename, the type, and Resume. Status changes themselves
 * go through main's `setGoalStatus` unchanged. Every function is a public endpoint's body: it checks
 * the input shape and returns no Goal text. The database is behind `GoalEditWriter`.
 */

export type GoalEditWriter = {
  rename(goalId: string, title: string): Promise<void>;
  setKind(goalId: string, kind: GoalKind): Promise<void>;
  /** The id of the Goal's newest session in this state, or null. */
  newestSessionIn(goalId: string, state: "on_hold"): Promise<string | null>;
};

type Deps = {
  userId: string | null;
  writer: GoalEditWriter;
  /** The server's safety check (#117); the keyword layer alone if omitted. */
  safety?: SafetyCheck;
};
type Outcome = { status: "ok" } | { status: "failed" };

export const TITLE_MAX = 1000;
const KINDS: GoalKind[] = ["one_time", "ongoing"];

function field(input: unknown, name: string): unknown {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)[name]
    : undefined;
}

export async function renameGoal(
  input: unknown,
  deps: Deps,
): Promise<Outcome | { status: "crisis" }> {
  const goalId = field(input, "goalId");
  const raw = field(input, "title");
  if (!deps.userId || !isGoalId(goalId) || typeof raw !== "string") return { status: "failed" };
  const title = raw.trim();
  if (title.length === 0 || title.length > TITLE_MAX) return { status: "failed" };
  const safety = deps.safety ?? keywordOnlySafetyCheck;
  if ((await safety(title, { position: "goal_rename" })).action === "crisis-page") {
    return { status: "crisis" };
  }
  try {
    await deps.writer.rename(goalId, title);
    return { status: "ok" };
  } catch {
    return { status: "failed" };
  }
}

export async function setGoalKind(input: unknown, deps: Deps): Promise<Outcome> {
  const goalId = field(input, "goalId");
  const kind = field(input, "kind");
  if (!deps.userId || !isGoalId(goalId) || !KINDS.includes(kind as GoalKind)) {
    return { status: "failed" };
  }
  try {
    await deps.writer.setKind(goalId, kind as GoalKind);
    return { status: "ok" };
  } catch {
    return { status: "failed" };
  }
}

/** Resume (#79 AC2, #78 AC4): back in progress, with the parked session open again. */
export async function resumeGoal(
  input: unknown,
  deps: Deps & { status: GoalStatusWriter },
): Promise<SetGoalStatusOutcome> {
  const goalId = field(input, "goalId");
  if (!deps.userId || !isGoalId(goalId)) return { status: "failed" };
  try {
    const sessionId = await deps.writer.newestSessionIn(goalId, "on_hold");
    return await setGoalStatus(
      { goalId, status: "in_progress", ...(sessionId ? { sessionId } : {}) },
      { userId: deps.userId, writer: deps.status },
    );
  } catch {
    return { status: "failed" };
  }
}

type Result = { data?: unknown; error: unknown };

function check(result: Result): Result {
  if (result.error) throw new Error("goal edit failed");
  return result;
}

/** Through the signed-in user's own client, so row-level security applies. */
export function createSupabaseGoalEditWriter(client: Pick<SupabaseClient, "from">): GoalEditWriter {
  return {
    async rename(goalId, title) {
      check((await client.from("goals").update({ title }).eq("id", goalId)) as Result);
    },
    async setKind(goalId, kind) {
      check((await client.from("goals").update({ kind }).eq("id", goalId)) as Result);
    },
    async newestSessionIn(goalId, state) {
      const result = check(
        (await client
          .from("sessions")
          .select("id")
          .eq("goal_id", goalId)
          .eq("state", state)
          .order("last_active_at", { ascending: false, nullsFirst: false })
          .limit(1)) as Result,
      );
      const found = result.data as { id?: unknown }[] | null | undefined;
      return typeof found?.[0]?.id === "string" ? found[0].id : null;
    },
  };
}
