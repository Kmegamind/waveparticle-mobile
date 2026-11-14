// Pages of the test path that are inside a session. Prototype version 4 draws them in the dark
// Oppenheimer skin in day and night alike (#240 C5): the goal dialogue, focus, rest and summary.
// The signed-in goal dialogue /goal (#32) and the signed-in summary /end (#258) are session pages too.
const SESSION_PATHS = [
  "/try/goal",
  "/try/focus",
  "/try/rest",
  "/try/end",
  "/goal",
  "/end",
] as const;

export function isSessionPath(pathname: string): boolean {
  return SESSION_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
