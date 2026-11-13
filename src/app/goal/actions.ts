"use server";

import { cookies } from "next/headers";
import { startGoal, type StartGoalInput, type StartGoalOutcome } from "@/lib/goals/start-goal";
import { createSupabaseGoalWriter } from "@/lib/goals/supabase-goal-writer";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { COST_CAP_COOKIE } from "@/lib/prototype/cost-cap";
import { splitGoal, type SplitInput, type SplitOutcome } from "@/lib/prototype/split-goal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Start on /goal (#32, US-GD-15): saves the Goal and its Steps on the signed-in account through
 * the user's own client (row-level security). The goal and Step text are never logged.
 */
export async function startGoalAction(input: StartGoalInput): Promise<StartGoalOutcome> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return startGoal(input, { userId: user?.id ?? null, writer: createSupabaseGoalWriter(client) });
}

/** The split on /goal: the same rules as /try (docs/decisions/0012), for signed-in users only. */
export async function splitGoalForAccountAction(input: SplitInput): Promise<SplitOutcome> {
  if (!isPrototypeEnabled()) return { status: "failed" };
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) return { status: "failed" };
  const jar = await cookies();
  return splitGoal(input, {
    env: process.env,
    today: new Date().toISOString().slice(0, 10),
    readCounter: () => jar.get(COST_CAP_COOKIE)?.value,
    writeCounter: (value) =>
      jar.set(COST_CAP_COOKIE, value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/goal",
        maxAge: 60 * 60 * 24,
      }),
    createGateway: () => createServerModelGateway(),
  });
}
