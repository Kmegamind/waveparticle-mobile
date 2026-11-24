import { logEvent } from "@/lib/logging/server-log";
import { SAFETY_CHECK_LANGUAGE } from "@/lib/safety/check";
import { NEXT_ACTION_MAX_BYTES, parseNextAction } from "@/lib/safety/next-action";

/**
 * What the user did next on S1 (US-SAF-6, #119): logs `safety_next_action` with the action, the
 * screen, the time and the language. A public path (`/safety/*`, src/lib/supabase/session.ts),
 * because S1 also shows on the signed-out /try pages. Reads no cookie and no account. A body that
 * is not exactly one known action and screen is refused and nothing from it is logged.
 */
export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > NEXT_ACTION_MAX_BYTES) return new Response(null, { status: 413 });
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = parseNextAction(raw);
  if (!parsed) return new Response(null, { status: 400 });
  logEvent("safety", {
    event: "safety_next_action",
    at: new Date().toISOString(),
    action: parsed.action,
    screen: parsed.screen,
    lang: SAFETY_CHECK_LANGUAGE,
  });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
