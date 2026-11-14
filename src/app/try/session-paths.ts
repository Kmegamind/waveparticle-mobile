// Pages of the test path that are inside a session. Prototype version 4 draws them in the dark
// Oppenheimer skin in day and night alike (#240 C5): the goal dialogue, focus, rest and summary.
// The signed-in goal dialogue /goal (#32), focus /focus, rest /rest (#257) and summary /end (#258)
// are too.
const SESSION_PATHS = [
  "/try/goal",
  "/try/focus",
  "/try/rest",
  "/try/end",
  "/goal",
  "/focus",
  "/rest",
  "/end",
] as const;

export function isSessionPath(pathname: string): boolean {
  return SESSION_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
