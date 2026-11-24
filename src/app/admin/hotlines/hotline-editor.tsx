"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { StatePill } from "@/app/admin/admin-ui";
import type { ContentRole } from "@/lib/admin/roles";
import {
  newestDraft,
  type HotlineVersionView,
  type HotlineWriteError,
  type HotlineWriteResult,
} from "@/lib/hotlines/admin";
import type { HotlineRow } from "@/lib/hotlines/repository";
import { contactLabel, DIRECTORY, entryLine } from "@/lib/safety/help-lines";
import { publishHotlineAction, rollBackHotlineAction, saveHotlineDraftAction } from "./actions";

const PROBLEMS: Record<Exclude<HotlineWriteError, "checks-failed">, string> = {
  "not-allowed": "Your account cannot do this. Only an admin edits and publishes hotlines.",
  invalid: "This country or version is not known.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

const noSubscription = () => () => {};

const today = () => new Date().toISOString().slice(0, 10);

function preview(row: HotlineRow) {
  const entry = {
    country: row.country,
    serviceName: row.service_name,
    primary: { kind: row.primary_kind, value: row.primary_value },
    secondary:
      row.secondary_kind && row.secondary_value
        ? { kind: row.secondary_kind, value: row.secondary_value }
        : null,
    note: row.note,
  };
  return { line: entryLine(entry), second: entry.secondary ? contactLabel(entry.secondary) : null };
}

/**
 * ADM-15 (#118): the entry's fields, a note that a change should be checked against the legal
 * review before Publish (a note, not a block: interim ruling, review of #403 M-1), and the
 * versions. Writers see everything read-only, with no buttons.
 */
export function HotlineEditor({
  country,
  name,
  role,
  versions,
}: {
  country: string;
  name: string;
  role: ContentRole;
  versions: HotlineVersionView[];
}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const isAdmin = role === "admin";
  const busy = pending || !ready;
  const draft = newestDraft(versions);
  const shown = draft?.row ?? versions.find((version) => version.state === "published")?.row;
  const published = versions.find((version) => version.state === "published")?.row;

  function run(action: () => Promise<HotlineWriteResult>, done: (version?: number) => string) {
    setStatus("");
    setProblems([]);
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      if (result.ok) return setStatus(done(result.version));
      if (result.error === "checks-failed") {
        setProblems(result.problems ?? []);
        return setStatus("Not saved: fix the fields listed below.");
      }
      setStatus(PROBLEMS[result.error]);
    });
  }

  const field = (key: string) => `${id}-${key}`;
  const disabled = !isAdmin || !ready;
  const shownPreview = published ? preview(published) : null;

  return (
    <div className="admin-hotline">
      <p className="admin-history-note" role="note">
        A new or changed entry should be checked against the legal review (#121) before Publish.
        This is a note, not a block.
      </p>
      {!isAdmin ? (
        <p className="admin-history-note">Read only: only an admin edits and publishes hotlines.</p>
      ) : null}
      <form
        className="admin-text-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isAdmin) return;
          const data = new FormData(event.currentTarget);
          const get = (key: string) => String(data.get(key) ?? "");
          run(
            () =>
              saveHotlineDraftAction({
                country,
                serviceName: get("serviceName"),
                primaryKind: get("primaryKind"),
                primaryValue: get("primaryValue"),
                secondaryKind: get("secondaryKind"),
                secondaryValue: get("secondaryValue"),
                note: get("note"),
                checkedOn: get("checkedOn"),
                checkedBy: get("checkedBy"),
              }),
            (version) =>
              `${version ? `Draft v${version} saved.` : "Draft saved."} S1 still shows the published entry.`,
          );
        }}
      >
        <p className="admin-text-label">
          Country: {name} ({country}). Fixed once saved.
        </p>
        <label className="admin-text-label" htmlFor={field("name")}>
          Service name (optional)
        </label>
        <input
          className="admin-text-field"
          defaultValue={shown?.service_name ?? ""}
          disabled={disabled}
          id={field("name")}
          maxLength={120}
          name="serviceName"
        />
        <label className="admin-text-label" htmlFor={field("pk")}>
          Main contact: what Get support now opens
        </label>
        <select
          className="admin-text-field"
          defaultValue={shown?.primary_kind ?? "phone"}
          disabled={disabled}
          id={field("pk")}
          name="primaryKind"
        >
          <option value="phone">Phone</option>
          <option value="text">Text</option>
          <option value="web">Web</option>
        </select>
        <label className="admin-text-label" htmlFor={field("pv")}>
          Main contact number or https address
        </label>
        <input
          className="admin-text-field"
          defaultValue={shown?.primary_value ?? ""}
          disabled={disabled}
          id={field("pv")}
          name="primaryValue"
        />
        <label className="admin-text-label" htmlFor={field("sk")}>
          Second contact (optional), shown as a text link
        </label>
        <select
          className="admin-text-field"
          defaultValue={shown?.secondary_kind ?? ""}
          disabled={disabled}
          id={field("sk")}
          name="secondaryKind"
        >
          <option value="">None</option>
          <option value="phone">Phone</option>
          <option value="text">Text</option>
          <option value="web">Web</option>
        </select>
        <label className="admin-text-label" htmlFor={field("sv")}>
          Second contact number or https address
        </label>
        <input
          className="admin-text-field"
          defaultValue={shown?.secondary_value ?? ""}
          disabled={disabled}
          id={field("sv")}
          name="secondaryValue"
        />
        <label className="admin-text-label" htmlFor={field("note")}>
          Note (optional): hours or languages, one short line
        </label>
        <input
          className="admin-text-field"
          defaultValue={shown?.note ?? ""}
          disabled={disabled}
          id={field("note")}
          maxLength={200}
          name="note"
        />
        <label className="admin-text-label" htmlFor={field("on")}>
          Last checked
        </label>
        <input
          className="admin-text-field"
          defaultValue={shown?.checked_on ?? today()}
          disabled={disabled}
          id={field("on")}
          name="checkedOn"
          type="date"
        />
        <label className="admin-text-label" htmlFor={field("by")}>
          Checked by
        </label>
        <input
          className="admin-text-field"
          defaultValue={shown?.checked_by ?? ""}
          disabled={disabled}
          id={field("by")}
          maxLength={120}
          name="checkedBy"
        />
        <p className="admin-history-note">
          A contact that is not a valid phone number or https address cannot be saved.
        </p>
        {isAdmin ? (
          <div className="admin-text-actions">
            <button className="button-gray button-small" disabled={busy} type="submit">
              Save draft
            </button>
            {draft ? (
              <button
                className="button-filled button-small"
                disabled={busy}
                onClick={() =>
                  run(
                    () => publishHotlineAction(country, draft.version),
                    () => `Published v${draft.version}.`,
                  )
                }
                type="button"
              >
                Publish v{draft.version}
              </button>
            ) : null}
          </div>
        ) : null}
      </form>

      {problems.length > 0 ? (
        <ul aria-label="Problems" className="admin-card-problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}

      <section aria-label="Preview on S1" className="admin-card">
        <p className="admin-text-label">Preview on S1 (S1-E, the published version)</p>
        {shownPreview ? (
          <>
            <p className="admin-history-note">Help in {name}</p>
            {published?.service_name ? <p>{published.service_name}</p> : null}
            <p className="admin-card-body">{shownPreview.line}</p>
            {shownPreview.second ? <p>{shownPreview.second}</p> : null}
            <p>{DIRECTORY.label}</p>
          </>
        ) : (
          <p className="admin-history-note">
            Nothing is published for {name}: S1 shows the directory (S1-N).
          </p>
        )}
      </section>

      {versions.length > 0 ? (
        <section aria-label="Versions" className="admin-text-versions">
          <h2 className="admin-text-label">Versions ({versions.length})</h2>
          <ol>
            {versions.map((version) => (
              <li key={version.version}>
                <p>
                  <span className="admin-page-id">v{version.version}</span>{" "}
                  <StatePill state={version.state}>{STATE_LABEL[version.state]}</StatePill>{" "}
                  {preview(version.row).line} · checked {version.row.checked_on} by{" "}
                  {version.row.checked_by}
                </p>
                {version.canRollBack && isAdmin ? (
                  <button
                    className="button-gray button-small"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => rollBackHotlineAction(country, version.version),
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
        </section>
      ) : null}

      <p aria-live="polite" className="admin-text-status" role="status">
        {status}
      </p>
    </div>
  );
}
