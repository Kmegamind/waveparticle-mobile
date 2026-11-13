import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoalRow, GoalWriter, StepRow } from "./start-goal";

type Result = { data?: unknown; error: unknown };

function check(result: Result): Result {
  // The message carries no row data, so nothing the user typed can reach a log.
  if (result.error) throw new Error("goal write failed");
  return result;
}

/** Writes through the signed-in user's own client, so row-level security applies (#32). */
export function createSupabaseGoalWriter(client: Pick<SupabaseClient, "from">): GoalWriter {
  return {
    async goalExists(id) {
      const result = check(
        (await client.from("goals").select("id").eq("id", id).maybeSingle()) as Result,
      );
      return result.data !== null && result.data !== undefined;
    },
    async insertGoal(row: GoalRow) {
      check((await client.from("goals").insert(row)) as Result);
    },
    async updateGoal(row: GoalRow) {
      const { id, ...fields } = row;
      check((await client.from("goals").update(fields).eq("id", id)) as Result);
    },
    async replaceSteps(goalId: string, rows: StepRow[]) {
      check((await client.from("steps").delete().eq("goal_id", goalId)) as Result);
      check((await client.from("steps").insert(rows)) as Result);
    },
    async deleteGoal(id: string) {
      check((await client.from("goals").delete().eq("id", id)) as Result);
    },
  };
}
