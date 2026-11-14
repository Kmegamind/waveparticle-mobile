/**
 * The sign-in-free test path (/try) exists only in test builds (#208, docs/decisions/0011).
 * It is on only when PROTOTYPE_ENABLED is exactly "1". Production never sets it.
 */
export function isPrototypeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PROTOTYPE_ENABLED === "1";
}

export function isTryPath(pathname: string): boolean {
  return pathname === "/try" || pathname.startsWith("/try/");
}

/** True when the request is for /try while the test path is off: the proxy answers 404. */
export function tryPathIsHidden(pathname: string, enabled: boolean): boolean {
  return !enabled && isTryPath(pathname);
}

/** The signed-in goal dialogue (#32). Like /try it exists only while the test path is on. */
export function isGoalPath(pathname: string): boolean {
  return pathname === "/goal" || pathname.startsWith("/goal/");
}

/** True when the request is for /goal while the test path is off: the proxy answers 404. */
export function goalPathIsHidden(pathname: string, enabled: boolean): boolean {
  return !enabled && isGoalPath(pathname);
}

/**
 * The signed-in session pages: the goal dialogue (#32), focus and rest (#257), and the summary
 * (#258). They exist only
 * while the test path is on, until the per-account daily cap on model calls (#256) lands.
 */
const ACCOUNT_SESSION_PATHS = ["/goal", "/focus", "/rest", "/end"] as const;

export function isAccountSessionPath(pathname: string): boolean {
  return ACCOUNT_SESSION_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** True when the request is for a signed-in session page while the test path is off: 404. */
export function accountSessionPathIsHidden(pathname: string, enabled: boolean): boolean {
  return !enabled && isAccountSessionPath(pathname);
}
