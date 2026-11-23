import type { ContentRole } from "@/lib/admin/roles";

// The warning before a story card roll back (#377, owner decision 2026-11-23, decision 0028).
// Roll back is the emergency undo, so it is never refused for a check problem (decision 0023).
// Before it runs, the admin's two roll back buttons (the card's Versions and the Publish history
// row) run the same checks Publish runs, the whole-Story checks included, on the version that
// would become live. With problems, the admin sees them and confirms; without, the roll back runs
// at once. Pure, so the server action, the client buttons and the tests share it.

/** Shown as the only problem when the checks could not run on the version. */
export const ROLL_BACK_CHECKS_UNAVAILABLE =
  "The checks could not run on this version, so its problems are not known.";

/**
 * The problems of the version a roll back would make live, for the warning. Only an admin rolls
 * back, so another account gets no problems (the roll back itself is then refused). Never a
 * refusal: a version the checks cannot read is reported as one problem.
 */
export async function rollBackWarnings(
  item: { key: string; version: number },
  deps: {
    userId: string | null;
    role: ContentRole | null;
    /** The stored version's problems as Publish checks them, or null when it cannot be read. */
    checkCard: (key: string, version: number) => Promise<string[] | null>;
  },
): Promise<string[]> {
  if (!deps.userId || deps.role !== "admin") return [];
  const problems = await deps.checkCard(item.key, item.version).catch(() => null);
  return problems ?? [ROLL_BACK_CHECKS_UNAVAILABLE];
}

/** What a roll back click leads to: a warning to confirm, or the finished roll back. */
export type RollBackStart<Result> =
  { kind: "warn"; problems: string[] } | { kind: "done"; result: Result };

/**
 * The first step of a roll back click: the warning's problems, then the roll back only when there
 * are none. A check that fails to answer is a warning too, never a silent roll back.
 */
export async function startRollBack<Result>(
  warnings: () => Promise<string[]>,
  rollBack: () => Promise<Result>,
): Promise<RollBackStart<Result>> {
  const problems = await warnings().catch(() => [ROLL_BACK_CHECKS_UNAVAILABLE]);
  if (problems.length > 0) return { kind: "warn", problems };
  return { kind: "done", result: await rollBack() };
}

/** The warning's first line, above the problems. */
export function rollBackWarningText(version: number, count: number): string {
  const checks = count === 1 ? "1 check" : `${count} checks`;
  return `v${version} fails ${checks}. Rolling back puts it live on phones anyway. Roll back anyway?`;
}
