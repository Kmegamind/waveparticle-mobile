/**
 * What the user did next on S1 (US-SAF-6 AC1 "what I did next", #119), sent by the browser as one
 * small request and logged by the server as `safety_next_action`. Only fixed words travel in the
 * body: the action and the screen (the first part of the address, from a fixed list). The request
 * is sent with no referrer and no cookies, so the address (which can hold a Goal or session id)
 * is not sent in a header either.
 *
 * The JSON line carries no id that joins it to the `safety_crisis` line of the same S1. It is not
 * anonymous, though: the hosting platform (Vercel) records each request's address, time, IP
 * address and browser next to the line, so the two lines could be matched by time and IP address
 * by anyone who can read the log. It also covers S1 opened by the browser's own keyword check,
 * which has no server line.
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

/** The request body is at most this many bytes; a longer one is refused before it is all read. */
export const NEXT_ACTION_MAX_BYTES = 200;

/** Reads a request body; anything but exactly `{ action, screen }` from the lists is null. */
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

/**
 * How the browser sends it: a `keepalive` fetch (it survives the page going away, like a beacon),
 * with no referrer and no cookies. `navigator.sendBeacon` is not used because it cannot drop the
 * referrer or the cookies (#119 review I1).
 */
export const NEXT_ACTION_REQUEST: RequestInit = {
  method: "POST",
  headers: { "content-type": "application/json" },
  keepalive: true,
  credentials: "omit",
  referrerPolicy: "no-referrer",
  cache: "no-store",
};

/** Sends it from the browser; never throws and never waits. */
export function sendNextAction(action: NextAction, pathname: string): void {
  try {
    const body = JSON.stringify({ action, screen: s1Screen(pathname) });
    void fetch(NEXT_ACTION_PATH, { ...NEXT_ACTION_REQUEST, body }).catch(() => undefined);
  } catch {
    // Offline: S1 never depends on the log.
  }
}
