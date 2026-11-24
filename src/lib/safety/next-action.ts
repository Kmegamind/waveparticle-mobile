/**
 * What the user did next on S1 (US-SAF-6 AC1 "what I did next", #119), sent by the browser as one
 * small beacon and logged by the server as `safety_next_action`. Only fixed words travel: the
 * action, the screen (the first part of the address, from a fixed list) and the time. Never the
 * address itself (it can hold a Goal or session id), never anything typed.
 *
 * The line is not linked to the `safety_crisis` line of the same S1: no id joins them, so the log
 * cannot follow one person through a crisis (owner decision pending, see `docs/deploy.md`). It also
 * covers S1 opened by the browser's own keyword check, which has no server line.
 */

export const NEXT_ACTIONS = [
  /** The filled button: the entry's main contact, or the directory. */
  "get_support",
  /** The entry's second contact link (S1-E). */
  "second_contact",
  /** The Find A Helpline text link. */
  "directory",
  /** Choose your country (S1-0). */
  "choose_country",
  /** Back to my Goal. */
  "back",
  /** The page was closed or hidden before any of the above. */
  "left",
] as const;

export type NextAction = (typeof NEXT_ACTIONS)[number];

export const S1_SCREENS = ["try", "goal", "goals", "focus", "rest", "me", "safety"] as const;

export type S1Screen = (typeof S1_SCREENS)[number] | "other";

export const NEXT_ACTION_PATH = "/safety/next-action";

/** The screen S1 was shown on, from the address's first part only. */
export function s1Screen(pathname: string): S1Screen {
  const first = pathname.split("/").find((part) => part.length > 0) ?? "";
  return (S1_SCREENS as readonly string[]).includes(first) ? (first as S1Screen) : "other";
}

/** The beacon's body is at most this long; anything longer is refused unread. */
export const NEXT_ACTION_MAX_BYTES = 200;

/** Reads a beacon body; anything but exactly `{ action, screen }` from the lists is null. */
export function parseNextAction(raw: string): { action: NextAction; screen: S1Screen } | null {
  if (raw.length > NEXT_ACTION_MAX_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const keys = Object.keys(parsed).sort();
  if (keys.length !== 2 || keys[0] !== "action" || keys[1] !== "screen") return null;
  const { action, screen } = parsed as { action: unknown; screen: unknown };
  if (typeof action !== "string" || !(NEXT_ACTIONS as readonly string[]).includes(action)) {
    return null;
  }
  if (
    typeof screen !== "string" ||
    !(screen === "other" || (S1_SCREENS as readonly string[]).includes(screen))
  ) {
    return null;
  }
  return { action: action as NextAction, screen: screen as S1Screen };
}

/** Sends the beacon from the browser; never throws and never waits. */
export function sendNextAction(action: NextAction, pathname: string): void {
  try {
    const body = JSON.stringify({ action, screen: s1Screen(pathname) });
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator !== "undefined" && navigator.sendBeacon?.(NEXT_ACTION_PATH, blob)) return;
    void fetch(NEXT_ACTION_PATH, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Offline or no beacon: S1 never depends on the log.
  }
}
