"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { FieldView } from "@/lib/content-fields/view";
import type { ContentFieldWriteError, ContentFieldWriteResult } from "@/lib/content-fields/write";
import {
  publishContentFieldAction,
  rollBackContentFieldAction,
  saveContentFieldAction,
} from "./actions";

const PROBLEMS: Record<Exclude<ContentFieldWriteError, "checks-failed">, string> = {
  "not-allowed": "Your account cannot do this. Only an admin publishes or rolls back.",
  invalid: "This field or version is not known.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

const noSubscription = () => () => {};

const checks = (count: number) => (count === 1 ? "1 check" : `${count} checks`);

/**
 * One Companion or story field (#309): the text the app shows now, a newer draft, the editor and
 * the versions. `choices` turns the editor into a list (a story's period). Only an admin sees
 * Publish enabled and Roll back.
 */
export function FieldEditor({
  field,
  label,
  limit,
  role,
  choices,
  rows = 3,
}: {
  field: FieldView;
  label: string;
  limit: number;
  role: ContentRole;
  choices?: string[];
  rows?: number;
}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
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
  const draft = field.draft;
  const blocked =
    draft && !isAdmin ? "Only an admin can publish. Ask an admin to publish this draft." : null;

  function run(action: () => Promise<ContentFieldWriteResult>, done: (version?: number) => string) {
    setStatus("");
    setProblems([]);
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      if (result.ok) return setStatus(done(result.version));
      if (result.error === "checks-failed") {
        const found = result.problems ?? [];
        setProblems(found);
        return setStatus(`Not saved: it fails ${checks(found.length)}.`);
      }
      setStatus(PROBLEMS[result.error]);
    });
  }

  const value = draft?.body ?? field.shown;
  return (
    <article aria-label={field.key} className="admin-card">
      <p className="admin-text-label">{label}</p>
      <p className="admin-card-body">{field.shown || "Not written yet."}</p>
      <dl className="admin-history-facts">
        <dt>Key</dt>
        <dd className="admin-text-key">{field.key}</dd>
        <dt>Shown now</dt>
        <dd>
          {field.versions.find((version) => version.state === "published")
            ? `v${field.versions.find((version) => version.state === "published")!.version}, published`
            : "The imported text"}
        </dd>
      </dl>

      {draft ? (
        <section aria-label={`Draft v${draft.version}`} className="admin-card-draft">
          <p>
            <span className="admin-page-id">v{draft.version}</span>{" "}
            <span className="admin-text-state">Newer draft</span>
          </p>
          <p className="admin-card-body">{draft.body}</p>
        </section>
      ) : null}

      <form
        className="admin-text-form"
        onSubmit={(event) => {
          event.preventDefault();
          const text = String(new FormData(event.currentTarget).get("text") ?? "");
          run(
            () => saveContentFieldAction(field.key, text),
            (version) =>
              `${version ? `Draft v${version} saved.` : "Draft saved."} The app still shows the published text.`,
          );
        }}
      >
        <label className="admin-text-label" htmlFor={`${id}-text`}>
          Text for {field.key}
        </label>
        {choices ? (
          <select
            className="admin-text-field"
            defaultValue={value}
            disabled={!ready}
            id={`${id}-text`}
            name="text"
          >
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            className="admin-text-field"
            defaultValue={value}
            disabled={!ready}
            id={`${id}-text`}
            maxLength={limit}
            name="text"
            rows={rows}
          />
        )}
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
                  () => publishContentFieldAction(field.key, draft.version),
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

      {problems.length > 0 ? (
        <ul aria-label="Problems" className="admin-card-problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      {field.versions.length > 1 ? (
        <details className="admin-text-versions">
          <summary>Versions ({field.versions.length})</summary>
          <ol>
            {field.versions.map((version) => (
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
                        () => rollBackContentFieldAction(field.key, version.version),
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
