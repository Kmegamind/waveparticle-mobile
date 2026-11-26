"use client";

import { useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { KeyChip, PageHead, StatePill } from "@/app/admin/admin-ui";
import type { ContentRole } from "@/lib/admin/roles";
import { versionDay } from "@/lib/admin/prompt-text";
import {
  newestDraft,
  sentValue,
  type HotlineVersionView,
  type HotlineWriteError,
  type HotlineWriteResult,
} from "@/lib/hotlines/admin";
import type { HotlineRow } from "@/lib/hotlines/repository";
import { contactHref, contactLabel, DIRECTORY, entryLine } from "@/lib/safety/help-lines";
import { publishHotlineAction, rollBackHotlineAction, saveHotlineDraftAction } from "./actions";

const PROBLEMS: Record<Exclude<HotlineWriteError, "checks-failed">, string> = {
  "not-allowed": "Your account cannot do this. Only an admin edits and publishes hotlines.",
  invalid: "This country or version is not known.",
  failed: "Could not save the change. Please try again.",
};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

const noSubscription = () => () => {};

const today = () => new Date().toISOString().slice(0, 10);

type Status = { text: string; problems: string[] };
const NO_STATUS: Status = { text: "", problems: [] };

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
  return { line: entryLine(entry), second: entry.secondary };
}

function StatusText({ status, label }: { status: Status; label?: string }) {
  return (
    <div aria-live="polite" className="admin-text-status" role="status">
      {status.text}
      {status.problems.length > 0 ? (
        <ul aria-label={label} className="admin-card-problems">
          {status.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * ADM-15 (#118), in the layout of docs/design/prototype/admin-hotlines_2026-11-23_v1.html (#448):
 * Save draft and Publish in the header row; the note that a change should be checked against the
 * legal review before Publish (a note, not a block: interim ruling, review of #403 M-1); then the
 * Entry panel (the fields) beside the Preview on S1 panel with the Versions table. Writers see
 * everything read-only, with no buttons. Save draft sends a field the user did not change exactly
 * as stored (sentValue).
 */
export function HotlineEditor({
  country,
  lede,
  name,
  role,
  title,
  versions,
}: {
  country: string;
  lede: React.ReactNode;
  name: string;
  role: ContentRole;
  title: React.ReactNode;
  versions: HotlineVersionView[];
}) {
  const id = useId();
  const formId = `${id}-form`;
  const form = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>(NO_STATUS);
  const [versionStatus, setVersionStatus] = useState<Status>(NO_STATUS);
  const [pending, startTransition] = useTransition();
  // False in the server HTML and until React has hydrated, so a click never submits natively.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const isAdmin = role === "admin";
  const busy = pending || !ready;
  const draft = newestDraft(versions);
  const published = versions.find((version) => version.state === "published")?.row;
  const shown = draft?.row ?? published;

  function run(
    show: (status: Status) => void,
    action: () => Promise<HotlineWriteResult>,
    done: (version?: number) => string,
  ) {
    setStatus(NO_STATUS);
    setVersionStatus(NO_STATUS);
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      if (result.ok) return show({ text: done(result.version), problems: [] });
      if (result.error === "checks-failed") {
        return show({
          text: "Not saved: fix the fields listed below.",
          problems: result.problems ?? [],
        });
      }
      show({ text: PROBLEMS[result.error], problems: [] });
    });
  }

  function save() {
    if (!isAdmin || !form.current) return;
    const data = new FormData(form.current);
    const typed = (key: string) => String(data.get(key) ?? "");
    // A field the user did not change goes back exactly as stored (#448).
    const kept = (stored: string | null | undefined, key: string) =>
      shown ? sentValue(stored ?? null, typed(key)) : typed(key);
    run(
      setStatus,
      () =>
        saveHotlineDraftAction({
          country,
          serviceName: kept(shown?.service_name, "serviceName"),
          primaryKind: kept(shown?.primary_kind, "primaryKind"),
          primaryValue: kept(shown?.primary_value, "primaryValue"),
          secondaryKind: kept(shown?.secondary_kind, "secondaryKind"),
          secondaryValue: kept(shown?.secondary_value, "secondaryValue"),
          note: kept(shown?.note, "note"),
          checkedOn: kept(shown?.checked_on, "checkedOn"),
          checkedBy: kept(shown?.checked_by, "checkedBy"),
        }),
      (version) =>
        `${version ? `Draft v${version} saved.` : "Draft saved."} S1 still shows the published entry.`,
    );
  }

  const field = (key: string) => `${id}-${key}`;
  const disabled = !isAdmin || !ready;
  const shownPreview = published ? preview(published) : null;

  return (
    <>
      <PageHead
        actions={
          isAdmin ? (
            <>
              <button className="button-gray" disabled={busy} form={formId} type="submit">
                Save draft
              </button>
              {draft ? (
                <button
                  className="button-filled"
                  disabled={busy}
                  onClick={() =>
                    run(
                      setStatus,
                      () => publishHotlineAction(country, draft.version),
                      () => `Published v${draft.version}.`,
                    )
                  }
                  type="button"
                >
                  Publish v{draft.version}
                </button>
              ) : null}
            </>
          ) : null
        }
        actionsLabel={isAdmin ? "Hotline actions" : undefined}
        lede={lede}
        title={title}
      />

      <p className="admin-hotline-legal" role="note">
        A new or changed entry should be checked against the legal review (#121) before Publish.
        This is a note, not a block.
      </p>

      <div className="admin-hotline-grid">
        <section aria-labelledby={field("entry")} className="admin-panel">
          <h2 className="admin-hotline-heading" id={field("entry")}>
            Entry
          </h2>
          {!isAdmin ? (
            <p className="admin-history-note admin-hotline-read-only">
              Read only: only an admin edits and publishes hotlines.
            </p>
          ) : null}
          <form
            className="admin-form"
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            ref={form}
          >
            <div className="admin-field-group">
              <label htmlFor={field("country")}>Country</label>
              <input
                aria-describedby={field("country-note")}
                className="admin-text-field"
                id={field("country")}
                readOnly
                type="text"
                value={`${name} (${country})`}
              />
              <span className="admin-note" id={field("country-note")}>
                Fixed once saved. ISO 3166-1 alpha-2.
              </span>
            </div>
            <label>
              Service name (optional)
              <input
                className="admin-text-field"
                defaultValue={shown?.service_name ?? ""}
                disabled={disabled}
                maxLength={120}
                name="serviceName"
                placeholder="None"
                type="text"
              />
            </label>
            <div className="admin-field-group">
              <label htmlFor={field("pk")}>Main contact: what Get support now opens</label>
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
              <input
                aria-label="Main contact number or https address"
                className="admin-text-field"
                defaultValue={shown?.primary_value ?? ""}
                disabled={disabled}
                name="primaryValue"
                type="text"
              />
            </div>
            <div className="admin-field-group">
              <label htmlFor={field("sk")}>Second contact (optional), shown as a text link</label>
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
              <input
                aria-label="Second contact number or https address"
                className="admin-text-field"
                defaultValue={shown?.secondary_value ?? ""}
                disabled={disabled}
                name="secondaryValue"
                type="text"
              />
            </div>
            <label>
              Note (optional): hours or languages, one short line
              <input
                className="admin-text-field"
                defaultValue={shown?.note ?? ""}
                disabled={disabled}
                maxLength={200}
                name="note"
                placeholder="None"
                type="text"
              />
            </label>
            <label>
              Last checked
              <input
                className="admin-text-field"
                defaultValue={shown?.checked_on ?? today()}
                disabled={disabled}
                name="checkedOn"
                type="date"
              />
            </label>
            <label>
              Checked by
              <input
                className="admin-text-field"
                defaultValue={shown?.checked_by ?? ""}
                disabled={disabled}
                maxLength={120}
                name="checkedBy"
                type="text"
              />
            </label>
            <p className="admin-note">
              A contact that is not a valid phone number or https address cannot be saved.
            </p>
          </form>
          <StatusText label="Problems" status={status} />
        </section>

        <section aria-labelledby={field("preview")} className="admin-panel">
          <h2 className="admin-hotline-heading" id={field("preview")}>
            Preview on S1
          </h2>
          {shownPreview && published ? (
            <>
              <p className="admin-note admin-hotline-preview-note">
                S1-E, the published version, as the phone shows it.
              </p>
              <p className="admin-note admin-hotline-country">Help in {name}</p>
              {published.service_name ? (
                <p className="admin-hotline-line">{published.service_name}</p>
              ) : null}
              <p className="admin-hotline-line admin-hotline-contact">{shownPreview.line}</p>
              {shownPreview.second ? (
                <p className="admin-hotline-link">
                  <a
                    href={contactHref(shownPreview.second)}
                    {...(shownPreview.second.kind === "web"
                      ? { rel: "noopener noreferrer", target: "_blank" }
                      : {})}
                  >
                    {contactLabel(shownPreview.second)}
                  </a>
                </p>
              ) : null}
              {published.note ? (
                <p className="admin-note admin-hotline-country">{published.note}</p>
              ) : null}
              <p className="admin-hotline-link">
                <a href={DIRECTORY.url} rel="noopener noreferrer" target="_blank">
                  {DIRECTORY.label}
                </a>
              </p>
            </>
          ) : (
            <p className="admin-note admin-hotline-preview-note">
              Nothing is published for {name}: S1 shows the directory (S1-N).
            </p>
          )}

          <h2 className="admin-hotline-heading admin-hotline-versions" id={field("versions")}>
            Versions
          </h2>
          {versions.length > 0 ? (
            <table aria-labelledby={field("versions")} className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">State</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Shows</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.version}>
                    <td>
                      <KeyChip>v{version.version}</KeyChip>
                    </td>
                    <td>
                      <StatePill state={version.state}>{STATE_LABEL[version.state]}</StatePill>
                      {version.canRollBack && isAdmin ? (
                        <>
                          {" "}
                          <button
                            className="button-gray button-small"
                            disabled={busy}
                            onClick={() =>
                              run(
                                setVersionStatus,
                                () => rollBackHotlineAction(country, version.version),
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
                    <td className="admin-note">{versionDay(version.row.created_at)}</td>
                    <td className="admin-note">
                      {preview(version.row).line} · checked {version.row.checked_on} by{" "}
                      {version.row.checked_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-note">No version saved yet.</p>
          )}
          <StatusText status={versionStatus} />
          <p className="admin-note admin-hotline-preview-note">
            Publish and roll back are for the admin role only. Writers see this page read-only.
          </p>
        </section>
      </div>
    </>
  );
}
