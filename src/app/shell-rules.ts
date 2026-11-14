// Where the app header and the tab bar show (issue #240, C7 and C8). The tab bar follows prototype
// version 4 screen by screen; the table is in
// docs/superpowers/specs/2026-11-12-shared-v4-styles-design.md, "Where the tab bar shows".

const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

// Pages below a tab that hide the tab bar: account deletion (ACCOUNT-DELETE in the prototype).
// Goal detail (G4) sits below /goals, which shows the tab bar on /goals itself only.
const HIDDEN_BELOW_TABS = ["/me/delete-account"];

export function showsTabBar(pathname: string): boolean {
  if (HIDDEN_BELOW_TABS.some((path) => within(pathname, path))) return false;
  return (
    pathname === "/" ||
    pathname === "/goals" ||
    within(pathname, "/companions") ||
    within(pathname, "/me")
  );
}

// The prototype has no app header on the sign-in pages and the safety page.
export function showsHeader(pathname: string): boolean {
  // The summary (END, #258) is a session page with no header in the prototype.
  return !within(pathname, "/auth") && !within(pathname, "/safety") && !within(pathname, "/end");
}
