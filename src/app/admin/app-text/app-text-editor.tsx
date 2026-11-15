"use client";

import { useId, useState, useTransition } from "react";
import type { AppTextAdminRow, AppTextWriteResult } from "@/lib/app-text/admin";
import { publishAppTextAction, rollBackAppTextAction, saveAppTextDraftAction } from "./actions";

const PROBLEMS: Record<Exclude<AppTextWriteResult, { ok: true }>["error"], string> = {
  "not-allowed": "Your account cannot change app text.",
  invalid: "This key or version is not known.",
  blank: "Write a text first. An empty text is not saved.",
  "too-long": "Keep the text under 1000 characters.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier" } as const;

/** One key on ADM-07: its published text, a newer draft, the editor and its versions. */
export function AppTextEditor({ row }: { row: AppTextAdminRow }) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const latest = row.draft ?? row.published;
  const [text, setText] = useState(latest?.body ?? row.defaultText);

  function run(action: () => Promise<AppTextWriteResult>, done: string) {
    setStatus("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      setStatus(result.ok ? done : PROBLEMS[result.error]);
    });
  }

  return (
    <section aria-labelledby={`${id}-key`} className="admin-text">
      <header className="admin-text-head">
        <h2 className="admin-text-key" id={`${id}-key`}>
          {row.key}
        </h2>
        <p className="admin-text-screen">Screen {row.screen}</p>
      </header>

      <dl className="admin-text-facts">
        <dt>Published</dt>
        <dd data-testid="published-text">
          {row.published ? (
            <>
              <span className="admin-page-id">v{row.published.version}</span> {row.published.body}
            </>
          ) : (
            <>Not in the database. The app shows the default: {row.defaultText}</>
          )}
        </dd>
        {row.draft ? (
          <>
            <dt>Newer draft</dt>
            <dd data-testid="draft-text">
              <span className="admin-page-id">v{row.draft.version}</span> {row.draft.body}
            </dd>
          </>
        ) : null}
      </dl>

      <form
        className="admin-text-form"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => saveAppTextDraftAction(row.key, text), "Draft saved.");
        }}
      >
        <label className="admin-text-label" htmlFor={`${id}-text`}>
          Text for {row.key}
        </label>
        <textarea
          className="admin-text-field"
          id={`${id}-text`}
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          value={text}
        />
        <div className="admin-text-actions">
          <button className="button-gray button-small" disabled={pending} type="submit">
            Save draft
          </button>
          {row.draft ? (
            <button
              className="button-filled button-small"
              disabled={pending}
              onClick={() =>
                run(
                  () => publishAppTextAction(row.key, row.draft!.version),
                  `Published v${row.draft!.version}.`,
                )
              }
              type="button"
            >
              Publish v{row.draft.version}
            </button>
          ) : null}
        </div>
      </form>

      {row.versions.length > 0 ? (
        <details className="admin-text-versions">
          <summary>Versions ({row.versions.length})</summary>
          <ol>
            {row.versions.map((version) => (
              <li key={version.version}>
                <p>
                  <span className="admin-page-id">v{version.version}</span>{" "}
                  <span className="admin-text-state">{STATE_LABEL[version.state]}</span>
                </p>
                <p className="admin-text-body">{version.body}</p>
                {version.canRollBack ? (
                  <button
                    className="button-gray button-small"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => rollBackAppTextAction(row.key, version.version),
                        `Rolled back to v${version.version}.`,
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
    </section>
  );
}
