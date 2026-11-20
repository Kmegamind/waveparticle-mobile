import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoalStatusWriter } from "./goal-status";
import type { StartOverWriter } from "./start-over";

type Result = { data?: unknown; error: unknown };

function check(result: Result): Result {
  // The message carries no row data, so nothing the user typed can reach a log.
  if (result.error) throw new Error("goal status write failed");
  return result;
}

/** Through the signed-in user's own client, so row-level security applies (#268, #87). */
export function createSupabaseGoalStatusWriter(
  client: Pick<SupabaseClient, "from">,
): GoalStatusWriter & StartOverWriter {
  return {
    async goalStatus(goalId) {
      const result = check(
        (await client.from("goals").select("status").eq("id", goalId).maybeSingle()) as Result,
      );
      const row = result.data as { status?: unknown } | null | undefined;
      return typeof row?.status === "string" ? (row.status as never) : null;
    },
    async setGoal(goalId, status) {
      check((await client.from("goals").update({ status }).eq("id", goalId)) as Result);
    },
    async sessionIn(goalId, state) {
      const result = check(
        (await client
          .from("sessions")
          .select("id")
          .eq("goal_id", goalId)
          .eq("state", state)
          .limit(1)) as Result,
      );
      const rows = result.data as { id?: unknown }[] | null | undefined;
      return typeof rows?.[0]?.id === "string" ? rows[0].id : null;
    },
    async sessionOf(sessionId) {
      const result = check(
        (await client
          .from("sessions")
          .select("goal_id, state")
          .eq("id", sessionId)
          .maybeSingle()) as Result,
      );
      const row = result.data as { goal_id?: unknown; state?: unknown } | null | undefined;
      return typeof row?.goal_id === "string" && typeof row.state === "string"
        ? { goalId: row.goal_id, state: row.state }
        : null;
    },
    async setSession(sessionId: string, state: "open" | "on_hold" | "restarted") {
      check((await client.from("sessions").update({ state }).eq("id", sessionId)) as Result);
    },
  };
}
