/**
 * Builds the server's turn dependencies for the two goal dialogue actions (/try/goal and /goal),
 * so both enforce the same turns (#31). A missing `GOAL_DIALOGUE_SECRET` in production writes one
 * log line (no user text) and every turn is refused, which the page shows as GD-F.
 */
import { logEvent } from "@/lib/logging/server-log";
import type { SplitInput, SplitOutcome } from "@/lib/prototype/split-goal";
import { dialogueSecret } from "./token";
import type { TurnDeps } from "./turns";

export function serverTurnDeps(split: (input: SplitInput) => Promise<SplitOutcome>): TurnDeps {
  const secret = dialogueSecret(process.env);
  if (!secret) {
    logEvent("goal-dialogue", { event: "secret_missing", setting: "GOAL_DIALOGUE_SECRET" });
  }
  return { secret, now: () => Date.now(), newId: () => crypto.randomUUID(), split };
}
