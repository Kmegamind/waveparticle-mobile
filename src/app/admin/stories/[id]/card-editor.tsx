"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { StoryCardView } from "@/lib/story-cards/admin";
import type { StoryCardWriteError } from "@/lib/story-cards/write";
import {
  publishStoryCardAction,
  rollBackStoryCardAction,
  saveStoryCardDraftAction,
  storyCardRollBackWarningsAction,
  type SaveDraftResult,
} from "../actions";
import { RollBackWarning } from "../roll-back-warning";
import { startRollBack } from "@/lib/story-cards/roll-back-warning";
import { KeyChip, StatePill } from "@/app/admin/admin-ui";

const PROBLEMS: Record<StoryCardWriteError, string> = {
  "not-allowed": "Your account cannot do this. Only an admin publishes or rolls back.",
  invalid: "This card or version is not known.",
  blank: "Write a text first. An empty card is not saved.",
  "too-long": "Keep the card under 2000 characters.",
  "checks-failed":
    "This draft fails a check, so it was not published. Fix it and save again. The problems:",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

const noSubscription = () => () => {};

const checks = (count: number) => (count === 1 ? "1 check" : `${count} checks`);

/**
 * One card on ADM-06 (#304), as a row of the prototype's cards editor (#444): kind, then its text
 * with the checks, a newer draft, the text box (after Edit), versions and roll back, then its
 * state, version and buttons.
 */
export function CardEditor({
  card,
  role,
  previewed,
  onPreview,
}: {
  card: StoryCardView;
  role: ContentRole;
  /** The phone preview shows this card. */
  previewed: boolean;
  onPreview: (card: StoryCardView) => void;
}) {
  const id = useId();
  // #444: the text box opens with Edit, as in the prototype; Cancel closes it without saving.
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  // #377: the problems the server found on Publish, named by card and rule.
  const [refused, setRefused] = useState<string[]>([]);
  // #377: a roll back whose version fails a check waits here for the admin to confirm.
  const [warning, setWarning] = useState<{ version: number; problems: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  // False in the server HTML and until React has hydrated, so nothing typed is lost and a click
  // never submits the form natively.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const busy = pending || !ready;
  const isAdmin = role === "admin";
  const draft = card.draft;
  const blocked = !draft
    ? null
    : !isAdmin
      ? "Only an admin can publish. Ask an admin to publish this draft."
      : draft.problems.length > 0
        ? `Publish is off: this draft fails ${checks(draft.problems.length)}. Fix the text and save again.`
        : null;

  function show(result: SaveDraftResult, done: (result: SaveDraftResult) => string) {
    setStatus(result.ok ? done(result) : PROBLEMS[result.error]);
    if (!result.ok && result.error === "checks-failed") setRefused(result.problems ?? []);
  }

  const attempt = (action: () => Promise<SaveDraftResult>) => () =>
    action().catch(() => ({ ok: false, error: "failed" }) as const);

  function run(action: () => Promise<SaveDraftResult>, done: (result: SaveDraftResult) => string) {
    setStatus("");
    setRefused([]);
    setWarning(null);
    startTransition(async () => {
      show(await attempt(action)(), done);
    });
  }

  const rolledBack = (version: number) => () => `Rolled back to v${version}.`;

  /** Roll back (#377): the version's problems first; with any, the admin confirms. */
  function askRollBack(version: number) {
    setStatus("");
    setRefused([]);
    setWarning(null);
    startTransition(async () => {
      const start = await startRollBack(
        () => storyCardRollBackWarningsAction(card.key, version),
        attempt(() => rollBackStoryCardAction(card.key, version)),
      );
      if (start.kind === "warn") setWarning({ version, problems: start.problems });
      else show(start.result, rolledBack(version));
    });
  }

  const shownFailing = card.problems.length > 0;
  const lengthFails = card.problems.some((problem) => / words; | sentences; /.test(problem));
  const lengthWarns = card.warnings.length > 0;
  return (
    <article aria-label={card.key} className="admin-cards-row">
      <div className="admin-cards-kind" data-testid="card-kind">
        {card.kind === "background" ? (
          "background"
        ) : (
          <>
            {card.slice ? `Slice ${card.slice}` : "Part card"}
            <br />
            <KeyChip>{card.key.split(".").slice(-2).join(".")}</KeyChip>
          </>
        )}
      </div>

      <div className="admin-cards-text" data-testid="card-text">
        {/* #444: a click (or focus) shows this card in the phone preview, as in the prototype. */}
        <p
          aria-current={previewed ? "true" : undefined}
          className="admin-cards-body"
          onClick={() => onPreview(card)}
          onFocus={() => onPreview(card)}
          tabIndex={0}
        >
          {card.body}
        </p>
        {shownFailing ? (
          <ul aria-label="Problems" className="admin-cards-fails">
            {card.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        {lengthWarns ? (
          <ul aria-label="Warnings" className="admin-cards-warns">
            {card.warnings.map((warning) => (
              <li key={warning}>Warning: {warning} This does not block Publish.</li>
            ))}
          </ul>
        ) : null}
        <p className="admin-cards-facts">
          {card.words} words ·{" "}
          {lengthFails
            ? "Fails CARD-LENGTH"
            : lengthWarns
              ? "Warning: over the usual CARD-LENGTH (does not block Publish)"
              : "Passes CARD-LENGTH"}{" "}
          · {shownFailing ? `Fails ${checks(card.problems.length)}` : "Passes every check"}
        </p>

        {draft && draft.version !== card.version ? (
          <section aria-label={`Draft v${draft.version}`} className="admin-card-draft">
            <p>
              <span className="admin-page-id">v{draft.version}</span>{" "}
              <span className="admin-text-state">Newer draft</span>
            </p>
            <p className="admin-card-body">{draft.body}</p>
            {draft.problems.length > 0 ? (
              <ul aria-label="Problems of the draft" className="admin-cards-fails">
                {draft.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : (
              <p className="admin-text-state">Passes every check.</p>
            )}
            {draft.warnings.length > 0 ? (
              <ul aria-label="Warnings of the draft" className="admin-cards-warns">
                {draft.warnings.map((warning) => (
                  <li key={warning}>Warning: {warning} This does not block Publish.</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
        {blocked ? (
          <p className="admin-history-note" id={`${id}-blocked`}>
            {blocked}
          </p>
        ) : null}

        {editing ? (
          <form
            className="admin-text-form"
            id={`${id}-form`}
            onSubmit={(event) => {
              event.preventDefault();
              const text = String(new FormData(event.currentTarget).get("text") ?? "");
              run(
                () => saveStoryCardDraftAction(card.key, text),
                (result) => {
                  const failing = "draftProblems" in result ? (result.draftProblems ?? []) : [];
                  const saved =
                    result.ok && result.version
                      ? `Draft v${result.version} saved.`
                      : "Draft saved.";
                  return failing.length > 0
                    ? `${saved} It fails ${checks(failing.length)}; see the problems above.`
                    : `${saved} It passes every check.`;
                },
              );
            }}
          >
            <label className="admin-text-label" htmlFor={`${id}-text`}>
              Text for {card.key}
            </label>
            <textarea
              className="admin-text-field"
              defaultValue={draft?.body ?? card.body}
              id={`${id}-text`}
              maxLength={2000}
              name="text"
              rows={3}
            />
            <div className="admin-text-actions">
              <button className="button-gray button-small" disabled={busy} type="submit">
                Save draft
              </button>
              <button
                className="button-plain button-small"
                disabled={busy}
                onClick={() => setEditing(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {card.versions.length > 1 ? (
          <details className="admin-text-versions">
            <summary>Versions ({card.versions.length})</summary>
            <ol>
              {card.versions.map((version) => (
                <li key={version.version}>
                  <p>
                    <span className="admin-page-id">v{version.version}</span>{" "}
                    <StatePill state={version.state}>{STATE_LABEL[version.state]}</StatePill>
                  </p>
                  <p className="admin-text-body">{version.body}</p>
                  {version.canRollBack && isAdmin ? (
                    <button
                      className="button-gray button-small"
                      disabled={busy}
                      onClick={() => askRollBack(version.version)}
                      type="button"
                    >
                      Roll back to v{version.version}
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {warning ? (
          <RollBackWarning
            busy={busy}
            onCancel={() => setWarning(null)}
            onConfirm={() =>
              run(
                () => rollBackStoryCardAction(card.key, warning.version),
                rolledBack(warning.version),
              )
            }
            problems={warning.problems}
            version={warning.version}
          />
        ) : null}

        <div aria-live="polite" className="admin-text-status" role="status">
          <p>{status}</p>
          {refused.length > 0 ? (
            <ul aria-label="Problems that stopped Publish" className="admin-cards-fails">
              {refused.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="admin-cards-meta" data-testid="card-meta">
        <StatePill state={card.published ? "published" : card.retired ? "earlier" : "draft"}>
          {card.published ? "Published" : card.retired ? "Retired" : "Draft"}
        </StatePill>
        {shownFailing ? <StatePill state="failed">Check failed</StatePill> : null}
        <span className="admin-cards-note">
          <KeyChip>v{card.version}</KeyChip>,{" "}
          {card.published ? "published" : card.retired ? "retired" : "draft"}
        </span>
        <div className="admin-cards-buttons">
          <button
            aria-controls={editing ? `${id}-form` : undefined}
            aria-expanded={editing}
            className="button-gray button-small"
            disabled={!ready}
            onClick={() => setEditing(!editing)}
            type="button"
          >
            Edit
          </button>
          {draft ? (
            <button
              aria-describedby={blocked ? `${id}-blocked` : undefined}
              className="button-filled button-small"
              disabled={busy || blocked !== null}
              onClick={() =>
                run(
                  () => publishStoryCardAction(card.key, draft.version),
                  () => `Published v${draft.version}.`,
                )
              }
              type="button"
            >
              Publish v{draft.version}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
