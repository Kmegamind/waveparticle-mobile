"use server";

import { cookies } from "next/headers";
import { serverTurnDeps } from "@/lib/goal-dialogue/server";
import { takeTurn, type TurnOutcome, type TurnRequest } from "@/lib/goal-dialogue/turns";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { COST_CAP_COOKIE } from "@/lib/prototype/cost-cap";
import { splitGoal } from "@/lib/prototype/split-goal";

/**
 * One turn of the goal dialogue on /try (#31; issues #33, #36, #38). The server counts the turns
 * in a signed token (docs/decisions/0026). The goal text is passed to the gateway only, never
 * logged or stored. Real model calls are capped per browser per day (docs/decisions/0012).
 */
export async function goalTurnAction(request: TurnRequest): Promise<TurnOutcome> {
  if (!isPrototypeEnabled()) return { status: "refused" };
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
          path: "/try",
          maxAge: 60 * 60 * 24,
        }),
      createGateway: () => createServerModelGateway(),
    });
  return takeTurn(request, serverTurnDeps(split));
}
