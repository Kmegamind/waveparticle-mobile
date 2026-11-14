import type { ProgressGoal } from "@/lib/progress/account-progress";

/**
 * Continue on Home and on a Goal in Goals (#69 AC3). It opens the signed-in focus page for that
 * Goal, which applies the return rule before the clock restarts (#257): the pop-up opens after 5
 * minutes or more away or after Back to step from rest. A plain link, not next/link, so the focus
 * page loads fresh and reads this device's clock (the session pages move with full page loads).
 * Kept small so the Home Goal card (#86) can reuse it.
 */
export function continueHref(goal: Pick<ProgressGoal, "id" | "status">): string | null {
  if (goal.status !== "in_progress") return null;
  return `/focus?goal=${encodeURIComponent(goal.id)}`;
}

export function ContinueLink({ href }: { href: string }) {
  return (
    <a className="continue-link" href={href}>
      Continue
    </a>
  );
}
