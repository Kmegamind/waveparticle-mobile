"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import type { AiFeatureItem } from "@/lib/ai-features/admin";
import type { FeatureWriteError, SectionName } from "@/lib/ai-features/edit";
import { PageHead } from "../admin-ui";
import { saveSectionsAction, type SavedSections } from "./actions";
import { ItemSource } from "./feature-ui";

// #453 (part of #430 T6; AI-PAGE-EDIT): the editors of (a) purpose and (c) current approach
// (drawing AIF-7) and of (b) the pass standard (AIF-6), for admins and writers. Save sits in the
// page's header action row, as in the drawing. Saving marks every line on the editor as checked:
// it loses "Draft - owner to edit" and keeps its source (the server takes the source from the
// stored line, never from the browser). An emptied line is removed.

export const WRITE_PROBLEMS: Record<FeatureWriteError, string> = {
  "not-allowed": "Your account cannot do this.",
  invalid: "This change could not be read. Reload the page and try again.",
  "unknown-feature": "This AI feature does not exist any more.",
  "too-long": "Keep each line under 2000 characters.",
  "note-too-long": "Keep the reason under 500 characters.",
  "changed-since":
    "Someone saved this feature after you opened this page, so nothing was saved. Copy your text, reload the page and edit again.",
  unchanged: "The status is already that one, so nothing changed.",
  failed: "Could not save the change. Please try again.",
};

type Row = { key: number; from: number | null; text: string; item: AiFeatureItem | null };

export type EditorSection = {
  name: SectionName;
  /** The label above the lines, as in the drawing. */
  label: string;
  /** "Purpose": each box is "Purpose, line 1". */
  line: string;
  add: string;
  items: AiFeatureItem[];
};

type LastSave = SavedSections["lastSave"];

const noSubscription = () => () => {};
let nextKey = 1;

function rowsOf(items: AiFeatureItem[], keepEmpty: boolean): Row[] {
  const rows = items.map((item, index) => ({ key: nextKey++, from: index, text: item.text, item }));
  // An empty section shows one empty box, so there is somewhere to start writing.
  return rows.length === 0 && keepEmpty
    ? [{ key: nextKey++, from: null, text: "", item: null }]
    : rows;
}

export function SectionsEditor({
  slug,
  title,
  lede,
  kind,
  sections,
  loadedAt: startLoadedAt,
  lastSave: startLastSave,
}: {
  slug: string;
  title: string;
  lede: string;
  /** "purpose": (a) and (c) as text boxes; "pass": (b) as questions with order buttons. */
  kind: "purpose" | "pass";
  sections: EditorSection[];
  loadedAt: string | null;
  lastSave: LastSave;
}) {
  const id = useId();
  const formId = `${id}-form`;
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(
      sections.map((section) => [section.name, rowsOf(section.items, kind === "purpose")]),
    ),
  );
  const [loadedAt, setLoadedAt] = useState(startLoadedAt);
  const [saved, setSaved] = useState<LastSave>(startLastSave);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  // False in the server HTML and until React has hydrated, so nothing typed is lost.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const busy = pending || !ready;

  const update = (name: string, change: (list: Row[]) => Row[]) =>
    setRows((current) => ({ ...current, [name]: change(current[name] ?? []) }));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const edited = Object.fromEntries(
      Object.entries(rows).map(([name, list]) => [
        name,
        list.map((row) => ({ from: row.from, text: row.text })),
      ]),
    );
    startTransition(async () => {
      const result = await saveSectionsAction(slug, loadedAt, edited).catch(
        () => ({ ok: false, error: "failed" }) as const,
      );
      if (!result.ok) {
        setMessage(WRITE_PROBLEMS[result.error]);
        return;
      }
      if ("saved" in result && result.saved) {
        const next = result.saved;
        setRows(
          Object.fromEntries(
            sections.map((section) => [
              section.name,
              rowsOf(next.sections[section.name], kind === "purpose"),
            ]),
          ),
        );
        setLoadedAt(next.loadedAt);
        setSaved(next.lastSave);
      }
      setMessage("Saved.");
    });
  }

  return (
    <>
      <PageHead
        title={title}
        lede={lede}
        actions={
          <button className="button-filled" disabled={busy} form={formId} type="submit">
            Save
          </button>
        }
      />
      <div className="admin-editor">
        <form
          className={kind === "pass" ? "admin-panel admin-section" : "admin-panel"}
          id={formId}
          onSubmit={submit}
          aria-labelledby={kind === "pass" ? `${id}-questions` : undefined}
          aria-label={kind === "purpose" ? "Purpose and approach" : undefined}
        >
          {kind === "pass" ? (
            <Questions
              disabled={!ready}
              headingId={`${id}-questions`}
              rows={rows.pass_questions ?? []}
              section={sections[0]}
              update={(change) => update("pass_questions", change)}
            />
          ) : (
            <div className="admin-form">
              {sections.map((section) => (
                <TextLines
                  disabled={!ready}
                  key={section.name}
                  labelId={`${id}-${section.name}`}
                  rows={rows[section.name] ?? []}
                  section={section}
                  update={(change) => update(section.name, change)}
                />
              ))}
            </div>
          )}
        </form>
        <section aria-labelledby={`${id}-last`} className="admin-panel admin-section">
          <h2 id={`${id}-last`}>Last save</h2>
          {saved ? (
            <table className="admin-table">
              <tbody>
                <tr>
                  <td className="admin-cell-note">
                    <time dateTime={saved.dateTime}>{saved.time}</time>
                  </td>
                  <td>{saved.person}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="admin-note">Not saved in the admin yet. The lines come from the specs.</p>
          )}
        </section>
      </div>
      {message ? (
        <p className="admin-toast" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}

function newRow(): Row {
  return { key: nextKey++, from: null, text: "", item: null };
}

/** (a) or (c): one box per line, each with its draft mark and source. */
function TextLines({
  section,
  rows,
  update,
  labelId,
  disabled,
}: {
  section: EditorSection;
  rows: Row[];
  update: (change: (list: Row[]) => Row[]) => void;
  labelId: string;
  disabled: boolean;
}) {
  const empty = section.items.length === 0;
  return (
    <div aria-labelledby={labelId} className="admin-field-group" role="group">
      <span className="admin-form-label" id={labelId}>
        {section.label}
      </span>
      {rows.map((row, index) => (
        <div className="admin-field-line" key={row.key}>
          <textarea
            aria-label={`${section.line}, line ${index + 1}`}
            className="admin-text-field"
            disabled={disabled}
            maxLength={2000}
            onChange={(event) => {
              const text = event.target.value;
              update((list) =>
                list.map((item) => (item.key === row.key ? { ...item, text } : item)),
              );
            }}
            placeholder={empty ? "Not written yet" : undefined}
            value={row.text}
          />
          {row.item ? <ItemSource item={row.item} /> : null}
        </div>
      ))}
      {empty ? (
        <p className="admin-src">
          Not written yet: no source was found. Saving text here removes the label.
        </p>
      ) : null}
      <div className="admin-add">
        <button
          className="button-gray button-small"
          disabled={disabled}
          onClick={() => update((list) => [...list, newRow()])}
          type="button"
        >
          {section.add}
        </button>
      </div>
    </div>
  );
}

/** (b): one row per question, with Move up, Move down and Remove, then Add question. */
function Questions({
  section,
  rows,
  update,
  headingId,
  disabled,
}: {
  section: EditorSection;
  rows: Row[];
  update: (change: (list: Row[]) => Row[]) => void;
  headingId: string;
  disabled: boolean;
}) {
  const move = (index: number, by: number) =>
    update((list) => {
      const next = [...list];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });
  return (
    <>
      <h2 id={headingId}>Questions</h2>
      {rows.length === 0 ? <p className="admin-empty">Not written yet</p> : null}
      {rows.map((row, index) => {
        const n = index + 1;
        return (
          <div className="admin-qrow" key={row.key}>
            <span className="admin-qrow-n">{n}</span>
            <div className="admin-qrow-text">
              <input
                aria-label={`Question ${n}`}
                className="admin-text-field"
                disabled={disabled}
                maxLength={2000}
                onChange={(event) => {
                  const text = event.target.value;
                  update((list) =>
                    list.map((item) => (item.key === row.key ? { ...item, text } : item)),
                  );
                }}
                type="text"
                value={row.text}
              />
              {row.item ? <ItemSource item={row.item} /> : null}
            </div>
            <span className="admin-actions">
              <button
                aria-label={`Move question ${n} up`}
                className="button-gray button-small"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move question ${n} down`}
                className="button-gray button-small"
                disabled={disabled || index === rows.length - 1}
                onClick={() => move(index, 1)}
                type="button"
              >
                ↓
              </button>
              <button
                aria-label={`Remove question ${n}`}
                className="button-gray button-small"
                disabled={disabled}
                onClick={() => update((list) => list.filter((item) => item.key !== row.key))}
                type="button"
              >
                Remove
              </button>
            </span>
          </div>
        );
      })}
      <div className="admin-add">
        <button
          className="button-gray button-small"
          disabled={disabled}
          onClick={() => update((list) => [...list, newRow()])}
          type="button"
        >
          {section.add}
        </button>
      </div>
    </>
  );
}
