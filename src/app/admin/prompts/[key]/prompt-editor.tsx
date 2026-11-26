"use client";

import { useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { DiffLine, PromptDetail, PromptWriteError } from "@/lib/admin/prompt-editor-types";
import { savedText, versionDay } from "@/lib/admin/prompt-text";
import {
  publishPromptAction,
  rollBackPromptAction,
  savePromptDraftAction,
  type SavePromptResult,
} from "../actions";
import { KeyChip, PageHead, StatePill } from "@/app/admin/admin-ui";

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
  "never-published": "This version was never active, so it cannot be rolled back to.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { active: "Active", draft: "Draft", earlier: "Earlier version" } as const;
const MARK = { same: " ", added: "+", removed: "−" } as const;
const SPOKEN = { same: "Unchanged", added: "Added", removed: "Removed" } as const;

const noSubscription = () => () => {};
const problemsWord = (count: number) => (count === 1 ? "1 problem" : `${count} problems`);

type Status = { text: string; problems: string[] };
const NO_STATUS: Status = { text: "", problems: [] };

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

function StatusText({ status }: { status: Status }) {
  return (
    <div aria-live="polite" className="admin-text-status" role="status">
      {status.text}
      {status.problems.length > 0 ? (
        <ul className="admin-card-problems">
          {status.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One prompt on ADM-08 (#308) in the prototype's layout (#446): Save draft and Publish in the
 * header row; the active version (`active`, drawn on the server) beside the editor and its Versions
 * table; the newest draft's changes below.
 */
export function PromptEditor({
  active,
  detail,
  lede,
  role,
  startBody,
  startSettings,
  startNote,
  title,
}: {
  active: React.ReactNode;
  detail: PromptDetail;
  lede: React.ReactNode;
  role: ContentRole;
  startBody: string;
  startSettings: string;
  startNote: string;
  title: React.ReactNode;
}) {
  const id = useId();
  const formId = `${id}-form`;
  const form = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [versionStatus, setVersionStatus] = useState<Status>(NO_STATUS);
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
    show: (status: Status) => void,
    action: () => Promise<SavePromptResult>,
    done: (result: SavePromptResult) => string,
  ) {
    setStatus(NO_STATUS);
    setVersionStatus(NO_STATUS);
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      if (result.ok) {
        show({ text: done(result), problems: [] });
      } else {
        show({
          text: PROBLEMS[result.error],
          problems: "problems" in result ? (result.problems ?? []) : [],
        });
      }
    });
  }

  function save() {
    const fields = form.current?.elements;
    const typed = (name: string) => {
      const field = fields?.namedItem(name);
      return field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement
        ? field.value
        : "";
    };
    // Exactly what is stored goes back for a field the user did not change (#446).
    const body = savedText(startBody, typed("body"));
    const settings = savedText(startSettings, typed("settings"));
    const note = savedText(startNote, typed("note"));
    if (!body.changed && !settings.changed && !note.changed) {
      setVersionStatus(NO_STATUS);
      setStatus({ text: PROBLEMS["unchanged"], problems: [] });
      return;
    }
    run(
      setStatus,
      () => savePromptDraftAction(detail.key, body.text, settings.text, note.text),
      (result) => {
        const failing = result.draftProblems ?? [];
        const saved =
          result.ok && result.version ? `Draft v${result.version} saved.` : "Draft saved.";
        return failing.length > 0
          ? `${saved} The gateway cannot use it yet (${problemsWord(failing.length)}); see the problems below.`
          : `${saved} The gateway can use it.`;
      },
    );
  }

  return (
    <>
      <PageHead
        actions={
          <>
            <button className="button-gray" disabled={busy} form={formId} type="submit">
              Save draft
            </button>
            {draft ? (
              <button
                aria-describedby={blocked ? `${id}-blocked` : undefined}
                className="button-filled"
                disabled={busy || blocked !== null}
                onClick={() =>
                  run(
                    setStatus,
                    () => publishPromptAction(detail.key, draft.version),
                    () => `Published v${draft.version}.`,
                  )
                }
                type="button"
              >
                Publish v{draft.version}
              </button>
            ) : null}
          </>
        }
        actionsLabel="Prompt actions"
        lede={lede}
        title={title}
      />

      <div className="admin-prompt-grid">
        {active}
        <div className="admin-panel">
          <section aria-labelledby={`${id}-edit`}>
            <h2 className="admin-prompt-heading" id={`${id}-edit`}>
              Edit
            </h2>
            <form
              className="admin-text-form"
              id={formId}
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
              ref={form}
            >
              <p className="admin-history-note">
                {draft
                  ? `Starts from draft v${draft.version}.`
                  : detail.active
                    ? `Starts from active v${detail.active.version}.`
                    : "Starts empty."}
              </p>
              <label className="admin-text-label" htmlFor={`${id}-body`}>
                Prompt
              </label>
              <textarea
                className="admin-prompt-code"
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
                className="admin-prompt-code"
                defaultValue={startSettings}
                disabled={!ready}
                id={`${id}-settings`}
                name="settings"
                rows={8}
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
            </form>
            {blocked ? (
              <p className="admin-history-note" id={`${id}-blocked`}>
                {blocked}
              </p>
            ) : null}
            <StatusText status={status} />
          </section>

          <section aria-labelledby={`${id}-versions`} className="admin-prompt-versions">
            <h2 className="admin-prompt-heading" id={`${id}-versions`}>
              Versions
            </h2>
            <table aria-label="Versions" className="admin-table">
              <tbody>
                {detail.versions.map((version) => (
                  <tr key={version.version}>
                    <td>
                      <KeyChip>v{version.version}</KeyChip>
                    </td>
                    <td className="admin-prompt-version-note">
                      {[version.note || "No note", `saved ${versionDay(version.createdAt)}`].join(
                        " · ",
                      )}
                    </td>
                    <td>
                      <StatePill state={version.state === "active" ? "published" : version.state}>
                        {STATE_LABEL[version.state]}
                      </StatePill>
                      {isAdmin && version.state === "earlier" ? (
                        <>
                          {" "}
                          <button
                            className="button-gray button-small"
                            disabled={busy}
                            onClick={() =>
                              run(
                                setVersionStatus,
                                () => rollBackPromptAction(detail.key, version.version),
                                () => `Rolled back to v${version.version}.`,
                              )
                            }
                            type="button"
                          >
                            Roll back to v{version.version}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <StatusText status={versionStatus} />
          </section>
        </div>
      </div>

      {draft ? (
        <section aria-label={`Draft v${draft.version}`} className="admin-panel admin-prompt-after">
          <h2 className="admin-prompt-heading">
            Draft <KeyChip>v{draft.version}</KeyChip>
          </h2>
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
    </>
  );
}
