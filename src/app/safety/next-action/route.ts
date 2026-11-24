import { logEvent } from "@/lib/logging/server-log";
import { SAFETY_CHECK_LANGUAGE } from "@/lib/safety/check";
import { NEXT_ACTION_MAX_BYTES, parseNextAction } from "@/lib/safety/next-action";
import { isJsonRequest, isSameOrigin, readCapped } from "@/lib/safety/next-action-request";

/**
 * What the user did next on S1 (US-SAF-6, #119): logs `safety_next_action` with the action, the
 * screen, the time and the language. A public path (`/safety/next-action` is named in
 * `isPublicPath`, src/lib/supabase/session.ts), because S1 also shows on the signed-out /try pages.
 * The handler reads no cookie and no account; the page sends none (`NEXT_ACTION_REQUEST`).
 *
 * Refused, with nothing logged: a body not declared `application/json` (415), a request from
 * another site (`isSameOrigin`, 403), a
 * body over `NEXT_ACTION_MAX_BYTES` bytes (counted while reading, so a missing or false
 * `content-length` does not help), and any body that is not exactly one known action and screen.
 * There is no rate limit (#119 review M2: a firewall rule or a per-IP limit before public launch).
 */

export async function POST(request: Request): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  if (!isJsonRequest(request)) return new Response(null, { status: 415, headers });
  if (!isSameOrigin(request)) return new Response(null, { status: 403, headers });
  const raw = await readCapped(request, NEXT_ACTION_MAX_BYTES);
  if (raw === null) return new Response(null, { status: 413, headers });
  const parsed = parseNextAction(raw);
  if (!parsed) return new Response(null, { status: 400, headers });
  logEvent("safety", {
    event: "safety_next_action",
    at: new Date().toISOString(),
    action: parsed.action,
    screen: parsed.screen,
    lang: SAFETY_CHECK_LANGUAGE,
  });
  return new Response(null, { status: 204, headers });
}
