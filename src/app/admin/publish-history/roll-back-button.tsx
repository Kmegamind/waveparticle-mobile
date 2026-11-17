"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { rollBackFromHistoryAction } from "./actions";

const PROBLEMS: Record<string, string> = {
  "not-allowed": "Your account cannot roll back.",
  invalid: "This version cannot be rolled back to.",
  blank: "This version cannot be rolled back to.",
  "too-long": "This version cannot be rolled back to.",
  "checks-failed": "The gateway cannot use this version, so it was not rolled back.",
  failed: "Could not roll back. Please try again.",
};

const noSubscription = () => () => {};

/** The end of one ADM-12 row: Roll back, or a note that this version is published now. */
export function HistoryRowAction({
  kind,
  itemKey,
  version,
  canRollBack,
  isCurrent,
}: {
  kind: string;
  itemKey: string;
  version: number;
  canRollBack: boolean;
  isCurrent: boolean;
}) {
  const [status, setStatus] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  // False in the server HTML and until React has hydrated, so a click never goes unanswered.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  return (
    <div className="admin-history-action">
      {canRollBack ? (
        <button
          className="button-gray button-small"
          disabled={pending || !ready}
          onClick={() => {
            setStatus("");
            setProblems([]);
            startTransition(async () => {
              const result = await rollBackFromHistoryAction(kind, itemKey, version).catch(
                () => ({ ok: false, error: "failed" }) as const,
              );
              // A prompt the gateway cannot use lists its reasons (#308).
              setProblems(!result.ok && "problems" in result ? (result.problems ?? []) : []);
              setStatus(
                result.ok
                  ? `Rolled back to v${version}.`
                  : (PROBLEMS[result.error] ?? PROBLEMS.failed),
              );
            });
          }}
          type="button"
        >
          Roll back to v{version}
        </button>
      ) : isCurrent ? (
        <p className="admin-history-note">Published now</p>
      ) : null}
      <div aria-live="polite" className="admin-text-status" role="status">
        {status}
        {problems.length > 0 ? (
          <ul className="admin-card-problems">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
