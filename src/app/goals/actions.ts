"use server";

import {
  createSupabaseGoalEditWriter,
  renameGoal,
  resumeGoal,
  setGoalKind,
} from "@/lib/goals/goal-edits";
import { setGoalStatus, type SetGoalStatusOutcome } from "@/lib/home/goal-status";
import { createSupabaseGoalStatusWriter } from "@/lib/home/supabase-goal-status";
import { serverSafetyCheck } from "@/lib/safety/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Server actions of the Goals area (#77, #78, #79). Public endpoints: the functions they call check
 * the input, and the user's own client keeps every write to their own Goals.
 */

async function signedIn() {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return { client, userId: user?.id ?? null };
}

/** Put on hold, Mark done, Reopen and Undo: main's rule, unchanged (#79). */
export async function setGoalStatusAction(input: unknown): Promise<SetGoalStatusOutcome> {
  try {
    const { client, userId } = await signedIn();
    return await setGoalStatus(input, { userId, writer: createSupabaseGoalStatusWriter(client) });
  } catch {
    return { status: "failed" };
  }
}

export async function resumeGoalAction(input: unknown): Promise<SetGoalStatusOutcome> {
  try {
    const { client, userId } = await signedIn();
    return await resumeGoal(input, {
      userId,
      writer: createSupabaseGoalEditWriter(client),
      status: createSupabaseGoalStatusWriter(client),
    });
  } catch {
    return { status: "failed" };
  }
}

export async function renameGoalAction(
  input: unknown,
): Promise<{ status: "ok" | "failed" | "crisis" }> {
  try {
    const { client, userId } = await signedIn();
    return await renameGoal(input, {
      userId,
      writer: createSupabaseGoalEditWriter(client),
      safety: serverSafetyCheck(),
    });
  } catch {
    return { status: "failed" };
  }
}

export async function setGoalKindAction(input: unknown): Promise<{ status: "ok" | "failed" }> {
  try {
    const { client, userId } = await signedIn();
    return await setGoalKind(input, { userId, writer: createSupabaseGoalEditWriter(client) });
  } catch {
    return { status: "failed" };
  }
}
