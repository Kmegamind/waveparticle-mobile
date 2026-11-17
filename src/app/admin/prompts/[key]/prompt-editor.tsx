"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { DiffLine, PromptDetail, PromptWriteError } from "@/lib/admin/prompt-editor-types";
import { publishPromptAction, savePromptDraftAction, type SavePromptResult } from "../actions";

const PROBLEMS: Record<PromptWriteError, string> = {
  "not-allowed": "Your account cannot do this. Only an admin publishes or rolls back.",
  invalid: "This prompt or version is not known.",
  blank: "Write a prompt first. An empty prompt is not saved.",
  "too-long": "Keep the prompt under 20000 characters.",
  "note-too-long": "Keep the note under 500 characters.",
  "settings-json":
    "The settings are not a JSON object, so nothing was saved. Check the brackets, quotes and commas.",
  unchanged: "Nothing changed, so no new version was saved.",
  "checks-failed": "The gateway cannot use this version, so it was not published.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { active: "Active", draft: "Draft", earlier: "Earlier version" } as const;
const MARK = { same: " ", added: "+", removed: "−" } as const;
const SPOKEN = { same: "Unchanged", added: "Added", removed: "Removed" } as const;

const noSubscription = () => () => {};
const problemsWord = (count: number) => (count === 1 ? "1 problem" : `${count} problems`);

function Diff({ label, lines, same }: { label: string; lines: DiffLine[]; same: string }) {
  if (lines.every((line) => line.kind === "same"))
    return <p className="admin-text-state">{same}</p>;
  return (
    <ol aria-label={label} className="admin-diff">
      {lines.map((line, index) => (
        <li className={`admin-diff-line admin-diff-${line.kind}`} key={index}>
          <span className="admin-diff-mark">
            <span aria-hidden="true">{MARK[line.kind]}</span>
            <span className="admin-diff-spoken">{SPOKEN[line.kind]}: </span>
          </span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

/** The editor of one prompt on ADM-08 (#308): the newest draft, its diff, Save, Publish, versions. */
export function PromptEditor({
  detail,
  role,
  startBody,
  startSettings,
  startNote,
}: {
  detail: PromptDetail;
  role: ContentRole;
  startBody: string;
  startSettings: string;
  startNote: string;
}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [statusProblems, setStatusProblems] = useState<string[]>([]);
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
  const draft = detail.draft;
  const blocked = !draft
    ? null
    : !isAdmin
      ? "Only an admin can publish. Ask an admin to publish this draft."
      : draft.problems.length > 0
        ? `Publish is off: the gateway cannot use this draft (${problemsWord(draft.problems.length)}). Fix it and save again.`
        : null;

  function run(
    action: () => Promise<SavePromptResult>,
    done: (result: SavePromptResult) => string,
  ) {
    setStatus("");
    setStatusProblems([]);
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      if (result.ok) {
        setStatus(done(result));
      } else {
        setStatus(PROBLEMS[result.error]);
        setStatusProblems("problems" in result ? (result.problems ?? []) : []);
      }
    });
  }

  return (
    <>
      {draft ? (
        <section aria-label={`Draft v${draft.version}`} className="admin-text">
          <h2 className="admin-text-key">Draft v{draft.version}</h2>
          {draft.note ? <p className="admin-text-screen">{draft.note}</p> : null}
          {draft.problems.length > 0 ? (
            <ul aria-label="Problems of the draft" className="admin-card-problems">
              {draft.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : (
            <p className="admin-text-state">The gateway can use this draft.</p>
          )}
          <h3 className="admin-prompt-subhead">
            {detail.active ? `Changes from active v${detail.active.version}` : "Changes"}
          </h3>
          <Diff label="Prompt changes" lines={draft.bodyDiff} same="No change to the prompt." />
          <Diff
            label="Settings changes"
            lines={draft.settingsDiff}
            same="No change to the settings."
          />
        </section>
      ) : null}

      <section aria-label="Edit" className="admin-text">
        <form
          className="admin-text-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const value = (name: string) => String(form.get(name) ?? "");
            run(
              () =>
                savePromptDraftAction(detail.key, value("body"), value("settings"), value("note")),
              (result) => {
                const failing = result.draftProblems ?? [];
                const saved =
                  result.ok && result.version ? `Draft v${result.version} saved.` : "Draft saved.";
                return failing.length > 0
                  ? `${saved} The gateway cannot use it yet (${problemsWord(failing.length)}); see the problems above.`
                  : `${saved} The gateway can use it.`;
              },
            );
          }}
        >
          <label className="admin-text-label" htmlFor={`${id}-body`}>
            Prompt
          </label>
          <textarea
            className="admin-text-field admin-prompt-field"
            defaultValue={startBody}
            disabled={!ready}
            id={`${id}-body`}
            maxLength={20000}
            name="body"
            rows={12}
            spellCheck={false}
          />
          <label className="admin-text-label" htmlFor={`${id}-settings`}>
            Settings (JSON)
          </label>
          <textarea
            className="admin-text-field admin-prompt-field"
            defaultValue={startSettings}
            disabled={!ready}
            id={`${id}-settings`}
            name="settings"
            rows={10}
            spellCheck={false}
          />
          <label className="admin-text-label" htmlFor={`${id}-note`}>
            Note (what changed and why)
          </label>
          <input
            className="admin-text-field"
            defaultValue={startNote}
            disabled={!ready}
            id={`${id}-note`}
            maxLength={500}
            name="note"
            type="text"
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
                    () => publishPromptAction(detail.key, draft.version),
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
        <div aria-live="polite" className="admin-text-status" role="status">
          {status}
          {statusProblems.length > 0 ? (
            <ul className="admin-card-problems">
              {statusProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <details className="admin-text-versions">
        <summary>Versions ({detail.versions.length})</summary>
        <ol>
          {detail.versions.map((version) => (
            <li key={version.version}>
              <p>
                <span className="admin-page-id">v{version.version}</span>{" "}
                <span className="admin-text-state">{STATE_LABEL[version.state]}</span>
                {version.note ? ` · ${version.note}` : null}
              </p>
            </li>
          ))}
        </ol>
        <p className="admin-history-note">
          To go back to an earlier version, use Roll back in Publish history.
        </p>
      </details>
    </>
  );
}
