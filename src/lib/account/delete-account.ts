/**
 * Delete my data (#103 AC2 AC3, #8 AC3). The database function `delete_my_account()` removes the
 * caller's rows from all six tables and the sign-in user (migration 20261114120000). Signing out
 * follows; a failed sign-out still counts as deleted, because the account no longer exists.
 */

export const DELETED_NOTICE = "Your account and your data are deleted.";

export type DeleteOutcome = { status: "deleted" | "signed-out" | "failed" };

export async function deleteAccount(deps: {
  userId: string | null;
  rpc: () => PromiseLike<{ error: unknown }>;
  signOut: () => Promise<unknown>;
}): Promise<DeleteOutcome> {
  if (!deps.userId) return { status: "signed-out" };
  let failed = false;
  try {
    const { error } = await deps.rpc();
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) return { status: "failed" };
  try {
    await deps.signOut();
  } catch {
    // The account is gone; its session cookie no longer opens anything.
  }
  return { status: "deleted" };
}

/** The line Sign in shows: a failed email link, or the confirmation after a deletion. */
export function signInNotice(params: { error?: string; deleted?: string }): string | undefined {
  if (params.deleted === "1") return DELETED_NOTICE;
  if (params.error === "confirmation_failed") return "This link is invalid or expired.";
  return undefined;
}
