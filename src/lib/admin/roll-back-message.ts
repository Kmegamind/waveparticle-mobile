// What the Roll back button of ADM-12 Publish history says when a roll back is refused (#289,
// #317). Every refusal names its reason; only a failure the person can retry says to try again.
// Pure, so the client button and the tests share it.

const REASONS: Record<string, string> = {
  "not-allowed":
    "Your account cannot roll this back. Only an admin rolls back this kind of content.",
  invalid: "This version or its key is not known, so it cannot be rolled back to.",
  blank: "This version is empty, so it cannot be rolled back to.",
  "too-long": "This version is longer than the limit, so it cannot be rolled back to.",
  "never-published": "This version was never published, so it cannot be rolled back to.",
  "unknown-item": "This Companion or story is not known, so nothing was changed.",
  failed: "Could not roll back. Please try again.",
};

/** The status line for a refused roll back; the problems, if any, are listed under it. */
export function rollBackMessage(kind: string, result: { ok: false; error: string }): string {
  if (result.error === "checks-failed") {
    return kind === "prompt"
      ? "The gateway cannot use this version, so it was not rolled back."
      : "This version does not pass the checks, so it was not rolled back:";
  }
  return REASONS[result.error] ?? REASONS.failed;
}
