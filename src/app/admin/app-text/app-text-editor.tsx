"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { AppTextAdminRow, AppTextWriteResult } from "@/lib/app-text/admin";
import { KeyChip, StatePill } from "../admin-ui";
import { publishAppTextAction, rollBackAppTextAction, saveAppTextDraftAction } from "./actions";

const PROBLEMS: Record<Exclude<AppTextWriteResult, { ok: true }>["error"], string> = {
  "not-allowed": "Your account cannot change app text.",
  invalid: "This key or version is not known.",
  blank: "Write a text first. An empty text is not saved.",
  "too-long": "Keep the text under 1000 characters.",
  failed: "Could not save the change. Please try again.",
};

const noSubscription = () => () => {};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

/** One key on ADM-07, one table row (#313): its screen, its key, the text cell (published text, a
 * newer draft, the editor and its versions) and its state. */
export function AppTextEditor({ row }: { row: AppTextAdminRow }) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const latest = row.draft ?? row.published;
  // False in the server HTML and until React has hydrated: the field and the buttons stay off until
  // then, so nothing typed is lost to hydration and a click never submits the form natively.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const busy = pending || !ready;

  function run(action: () => Promise<AppTextWriteResult>, done: string) {
    setStatus("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      setStatus(result.ok ? done : PROBLEMS[result.error]);
    });
  }

  return (
    <tr aria-labelledby={`${id}-key`}>
      <td>
        <KeyChip>{row.screen}</KeyChip>
      </td>
      <td>
        <span className="admin-chip" id={`${id}-key`}>
          {row.key}
        </span>
      </td>
      <td>
        <div className="admin-cell-stack">
          <dl className="admin-text-facts">
            <dt>Published</dt>
            <dd data-testid="published-text">
              {row.published ? (
                <>
                  <span className="admin-page-id">v{row.published.version}</span>{" "}
                  {row.published.body}
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
              // The field is uncontrolled: its own value is read, typed before hydration or after.
              const text = String(new FormData(event.currentTarget).get("text") ?? "");
              run(() => saveAppTextDraftAction(row.key, text), "Draft saved.");
            }}
          >
            <label className="admin-text-label" htmlFor={`${id}-text`}>
              Text for {row.key}
            </label>
            <textarea
              className="admin-text-field"
              defaultValue={latest?.body ?? row.defaultText}
              disabled={!ready}
              id={`${id}-text`}
              maxLength={1000}
              name="text"
              rows={2}
            />
            <div className="admin-text-actions">
              <button className="button-gray button-small" disabled={busy} type="submit">
                Save draft
              </button>
              {row.draft ? (
                <button
                  className="button-filled button-small"
                  disabled={busy}
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
                      <StatePill state={version.state}>{STATE_LABEL[version.state]}</StatePill>
                    </p>
                    <p className="admin-text-body">{version.body}</p>
                    {version.canRollBack ? (
                      <button
                        className="button-gray button-small"
                        disabled={busy}
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
        </div>
      </td>
      <td>
        {row.draft ? (
          <StatePill state="draft">Draft</StatePill>
        ) : row.published ? (
          <StatePill state="published">Published</StatePill>
        ) : (
          <StatePill state="default">Default</StatePill>
        )}
      </td>
    </tr>
  );
}
