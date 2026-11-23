"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { rollBackMessage } from "@/lib/admin/roll-back-message";
import type { RollBackResult } from "@/lib/publish-history/admin";
import { startRollBack } from "@/lib/story-cards/roll-back-warning";

import { storyCardRollBackWarningsAction } from "../stories/actions";
import { RollBackWarning } from "../stories/roll-back-warning";
import { rollBackFromHistoryAction } from "./actions";

/** Only story cards warn before a roll back (#377, decision 0028); other kinds roll back at once. */
const noWarnings = async () => [] as string[];

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
  const [warning, setWarning] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  // False in the server HTML and until React has hydrated, so a click never goes unanswered.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  const rollBack = () =>
    rollBackFromHistoryAction(kind, itemKey, version).catch((): RollBackResult => ({
      ok: false,
      error: "failed",
    }));

  function show(result: RollBackResult) {
    // A refused version lists its reasons (#308, #317).
    setProblems(!result.ok && "problems" in result ? (result.problems ?? []) : []);
    setStatus(result.ok ? `Rolled back to v${version}.` : rollBackMessage(kind, result));
  }

  function reset() {
    setStatus("");
    setProblems([]);
    setWarning(null);
  }

  const busy = pending || !ready;

  return (
    <div className="admin-history-action">
      {canRollBack ? (
        <button
          className="button-gray button-small"
          disabled={busy}
          onClick={() => {
            reset();
            startTransition(async () => {
              const start = await startRollBack(
                kind === "story_card"
                  ? () => storyCardRollBackWarningsAction(itemKey, version)
                  : noWarnings,
                rollBack,
              );
              if (start.kind === "warn") setWarning(start.problems);
              else show(start.result);
            });
          }}
          type="button"
        >
          Roll back to v{version}
        </button>
      ) : isCurrent ? (
        <p className="admin-history-note">Published now</p>
      ) : null}
      {warning ? (
        <RollBackWarning
          busy={busy}
          onCancel={() => setWarning(null)}
          onConfirm={() => {
            reset();
            startTransition(async () => show(await rollBack()));
          }}
          problems={warning}
          version={version}
        />
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
