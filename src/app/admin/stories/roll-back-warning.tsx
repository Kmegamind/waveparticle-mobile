"use client";

import { rollBackWarningText } from "@/lib/story-cards/roll-back-warning";

/**
 * The warning before a story card roll back (#377, decision 0028): the problems of the version
 * that would become live, and a confirm. Shown by the card's Versions and by the Publish history
 * row; Roll back anyway runs the same roll back as before.
 */
export function RollBackWarning({
  version,
  problems,
  busy,
  onConfirm,
  onCancel,
}: {
  version: number;
  problems: string[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-label={`Roll back to v${version}: warning`} className="admin-roll-back-warning">
      <p>{rollBackWarningText(version, problems.length)}</p>
      <ul aria-label={`Problems of v${version}`} className="admin-card-problems">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <div className="admin-text-actions">
        <button
          className="button-gray button-small"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          Roll back anyway
        </button>
        <button
          className="button-plain button-small"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
