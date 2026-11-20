"use server";

import { setGoalStatus, type SetGoalStatusOutcome } from "@/lib/home/goal-status";
import { startOver, type StartOverOutcome } from "@/lib/home/start-over";
import { createSupabaseGoalStatusWriter } from "@/lib/home/supabase-goal-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Put on hold, Mark done and Undo from the Home Goal card (#268 AC4). A public endpoint:
 * `setGoalStatus` checks the input; the user's own client keeps it to their own Goals.
 */
export async function setGoalStatusAction(input: unknown): Promise<SetGoalStatusOutcome> {
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);
    return await setGoalStatus(input, {
      userId: user?.id ?? null,
      writer: createSupabaseGoalStatusWriter(client),
    });
  } catch {
    return { status: "failed" };
  }
}

/** Start over on HOME-3B (#87). A public endpoint: `startOver` checks the input. */
export async function startOverAction(input: unknown): Promise<StartOverOutcome> {
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);
    return await startOver(input, {
      userId: user?.id ?? null,
      writer: createSupabaseGoalStatusWriter(client),
    });
  } catch {
    return { status: "failed" };
  }
}
