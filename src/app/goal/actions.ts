"use server";

import { cookies } from "next/headers";
import { serverTurnDeps } from "@/lib/goal-dialogue/server";
import { takeTurn, type TurnOutcome, type TurnRequest } from "@/lib/goal-dialogue/turns";
import { startGoal, type StartGoalInput, type StartGoalOutcome } from "@/lib/goals/start-goal";
import { createSupabaseGoalWriter } from "@/lib/goals/supabase-goal-writer";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { COST_CAP_COOKIE } from "@/lib/prototype/cost-cap";
import { splitGoal } from "@/lib/prototype/split-goal";
import { serverSafetyCheck } from "@/lib/safety/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/session";

/**
 * Start on /goal (#32, US-GD-15): saves the Goal and its Steps on the signed-in account through
 * the user's own client (row-level security). The goal and Step text are never logged.
 */
export async function startGoalAction(input: StartGoalInput): Promise<StartGoalOutcome> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  return startGoal(input, {
    userId: user?.id ?? null,
    writer: createSupabaseGoalWriter(client),
    safety: serverSafetyCheck(),
  });
}

/**
 * One turn of the dialogue on /goal (#31): the same turns and split rules as /try
 * (docs/decisions/0012, 0026), for signed-in users only.
 */
export async function goalTurnForAccountAction(request: TurnRequest): Promise<TurnOutcome> {
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) return { status: "refused" };
  const jar = await cookies();
  const split = (input: Parameters<typeof splitGoal>[0]) =>
    splitGoal(input, {
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
      safety: serverSafetyCheck(),
    });
  return takeTurn(request, serverTurnDeps(split));
}
