"use server";

import { cookies } from "next/headers";
import { createServerModelGateway } from "@/lib/model-gateway/server";
import { isPrototypeEnabled } from "@/lib/prototype/config";
import { COST_CAP_COOKIE } from "@/lib/prototype/cost-cap";
import { splitGoal, type SplitInput, type SplitOutcome } from "@/lib/prototype/split-goal";

/**
 * Splits the Goal for the dialogue on /try (issues #33, #36, #38). The goal text is passed to the
 * gateway only, never logged or stored. Real model calls are capped per browser per day.
 */
export async function splitGoalAction(input: SplitInput): Promise<SplitOutcome> {
  if (!isPrototypeEnabled()) return { status: "failed" };
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
        path: "/try",
        maxAge: 60 * 60 * 24,
      }),
    createGateway: () => createServerModelGateway(),
  });
}
