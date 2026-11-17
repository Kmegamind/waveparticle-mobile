"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { StoryCardView } from "@/lib/story-cards/admin";
import type { StoryCardWriteError } from "@/lib/story-cards/write";
import {
  publishStoryCardAction,
  rollBackStoryCardAction,
  saveStoryCardDraftAction,
  type SaveDraftResult,
} from "../actions";

const PROBLEMS: Record<StoryCardWriteError, string> = {
  "not-allowed": "Your account cannot do this. Only an admin publishes or rolls back.",
  invalid: "This card or version is not known.",
  blank: "Write a text first. An empty card is not saved.",
  "too-long": "Keep the card under 2000 characters.",
  "checks-failed": "This draft fails a check, so it was not published. Fix it and save again.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

const noSubscription = () => () => {};

const checks = (count: number) => (count === 1 ? "1 check" : `${count} checks`);

/** One card on ADM-06 (#304): its published text, a newer draft with its checks, and versions. */
export function CardEditor({ card, role }: { card: StoryCardView; role: ContentRole }) {
  const id = useId();
  const [status, setStatus] = useState("");
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

  function run(action: () => Promise<SaveDraftResult>, done: (result: SaveDraftResult) => string) {
    setStatus("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      setStatus(result.ok ? done(result) : PROBLEMS[result.error]);
    });
  }

  const shownFailing = card.problems.length > 0;
  return (
    <article aria-label={card.key} className="admin-card">
      <p className="admin-card-body">{card.body}</p>
      <dl className="admin-history-facts">
        <dt>Key</dt>
        <dd className="admin-text-key">{card.key}</dd>
        {card.slice ? (
          <>
            <dt>Slice</dt>
            <dd>{card.slice}</dd>
          </>
        ) : null}
        <dt>Version</dt>
        <dd>
          v{card.version}, {card.published ? "published" : "draft"}
        </dd>
        <dt>Length</dt>
        <dd>
          {card.words} words ·{" "}
          {card.problems.some((problem) => / words; | sentences; /.test(problem))
            ? "Fails CARD-LENGTH"
            : "Passes CARD-LENGTH"}
        </dd>
        <dt>Checks</dt>
        <dd>{shownFailing ? `Fails ${checks(card.problems.length)}` : "Passes every check"}</dd>
      </dl>
      {shownFailing ? (
        <ul aria-label="Problems" className="admin-card-problems">
          {card.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {draft && draft.version !== card.version ? (
        <section aria-label={`Draft v${draft.version}`} className="admin-card-draft">
          <p>
            <span className="admin-page-id">v{draft.version}</span>{" "}
            <span className="admin-text-state">Newer draft</span>
          </p>
          <p className="admin-card-body">{draft.body}</p>
          {draft.problems.length > 0 ? (
            <ul aria-label="Problems of the draft" className="admin-card-problems">
              {draft.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : (
            <p className="admin-text-state">Passes every check.</p>
          )}
        </section>
      ) : null}

      <form
        className="admin-text-form"
        onSubmit={(event) => {
          event.preventDefault();
          const text = String(new FormData(event.currentTarget).get("text") ?? "");
          run(
            () => saveStoryCardDraftAction(card.key, text),
            (result) => {
              const failing = "draftProblems" in result ? (result.draftProblems ?? []) : [];
              const saved =
                result.ok && result.version ? `Draft v${result.version} saved.` : "Draft saved.";
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
          disabled={!ready}
          id={`${id}-text`}
          maxLength={2000}
          name="text"
          rows={3}
        />
        <div className="admin-text-actions">
          <button className="button-gray button-small" disabled={busy} type="submit">
            Save draft
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
        {blocked ? (
          <p className="admin-history-note" id={`${id}-blocked`}>
            {blocked}
          </p>
        ) : null}
      </form>

      {card.versions.length > 1 ? (
        <details className="admin-text-versions">
          <summary>Versions ({card.versions.length})</summary>
          <ol>
            {card.versions.map((version) => (
              <li key={version.version}>
                <p>
                  <span className="admin-page-id">v{version.version}</span>{" "}
                  <span className="admin-text-state">{STATE_LABEL[version.state]}</span>
                </p>
                <p className="admin-text-body">{version.body}</p>
                {version.canRollBack && isAdmin ? (
                  <button
                    className="button-gray button-small"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => rollBackStoryCardAction(card.key, version.version),
                        () => `Rolled back to v${version.version}.`,
                      )
                    }
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

      <p aria-live="polite" className="admin-text-status" role="status">
        {status}
      </p>
    </article>
  );
}
