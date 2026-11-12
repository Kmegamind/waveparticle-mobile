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
