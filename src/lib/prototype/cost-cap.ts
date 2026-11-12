/**
 * Cost cap for real model calls on the test path /try (docs/decisions/0011, "cap the calls").
 * Each browser may make MODEL_CALL_LIMIT real model calls per day (UTC). The count lives in an
 * httpOnly cookie, value "YYYY-MM-DD:N". Clearing cookies resets it: this is a brake, not a wall;
 * Vercel Deployment Protection stays the real gate.
 */
export const MODEL_CALL_LIMIT = 20;
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
