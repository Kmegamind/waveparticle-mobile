import { logEvent } from "@/lib/logging/server-log";

/**
 * Cost cap for real model calls on the test path /try (docs/decisions/0011, "cap the calls").
 * Each browser may make MODEL_CALL_LIMIT real model calls per day (UTC). The count lives in an
 * httpOnly cookie, value "YYYY-MM-DD:N". Clearing cookies resets it: this is a brake, not a wall;
 * Vercel Deployment Protection stays the real gate.
 */
export const MODEL_CALL_LIMIT = 20;
/** Server-only setting. "0" turns the limit off (#256, DECISIONS TEST-NO-CAP); "1" or unset keeps it on. */
export const LIMIT_SWITCH_ENV = "MODEL_CALL_LIMIT_ENABLED";
export const COST_CAP_COOKIE = "wp_try_model_calls";

function countFor(cookie: string | undefined, today: string): number {
  const match = cookie?.match(/^(\d{4}-\d{2}-\d{2}):(\d+)$/);
  if (!match || match[1] !== today) return 0;
  return Number(match[2]);
}

/** Takes one call from today's allowance. `cookie` is the new value to store when allowed. */
export function takeModelCall(
  cookie: string | undefined,
  today: string,
): { allowed: true; cookie: string } | { allowed: false } {
  const used = countFor(cookie, today);
  if (used >= MODEL_CALL_LIMIT) return { allowed: false };
  return { allowed: true, cookie: `${today}:${used + 1}` };
}

let invalidLogged = false;

/**
 * Whether the per-browser limit applies. On when the setting is unset, "1" or empty; off only when
 * it is exactly "0". Any other value keeps the limit on and logs one warning per server process.
 */
export function isModelCallLimitOn(env: Record<string, string | undefined> = process.env): boolean {
  const value = env[LIMIT_SWITCH_ENV];
  if (value === undefined || value === "" || value === "1") return true;
  if (value === "0") return false;
  if (!invalidLogged) {
    invalidLogged = true;
    logEvent("cost-cap", { event: "limit_switch_invalid", setting: LIMIT_SWITCH_ENV });
  }
  return true;
}

/** For tests: lets the one-time warning fire again. */
export function resetInvalidLimitSwitchLog(): void {
  invalidLogged = false;
}
