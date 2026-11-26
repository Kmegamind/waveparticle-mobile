"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  APP_TEXT_PROBLEMS,
  appTextCanSave,
  appTextStartText,
  type AppTextAdminRow,
  type AppTextWriteResult,
} from "@/lib/app-text/admin";
import { KeyChip, StatePill } from "../admin-ui";
import { publishAppTextAction, rollBackAppTextAction, saveAppTextDraftAction } from "./actions";

const noSubscription = () => () => {};

const STATE_LABEL = { published: "Published", draft: "Draft", earlier: "Earlier version" } as const;

/** Puts plain text at the caret of an in-place field, replacing any selection. */
function insertPlainText(field: HTMLElement, text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!field.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * One key on ADM-07, one table line as the prototype draws it (#445): its screen, its key, its
 * text edited in place and its state. Save draft appears only when the text differs exactly from
 * the stored one; Publish vN beside a newer draft; Versions and Roll back under the text once a
 * key has more than one version.
 */
export function AppTextEditor({ row }: { row: AppTextAdminRow }) {
  const id = useId();
  const [status, setStatus] = useState("");
  // What the field holds now; null until something is typed (or after a save or Cancel).
  const [typed, setTyped] = useState<string | null>(null);
  // Bumped by Cancel, so the field is drawn again from the stored text.
  const [resets, setResets] = useState(0);
  const [pending, startTransition] = useTransition();
  const start = appTextStartText(row);
  // False in the server HTML and until React has hydrated: the buttons stay off until then.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const busy = pending || !ready;
  const field = useRef<HTMLSpanElement>(null);
  // The field is editable from the server HTML on. Text typed before React hydrated is kept (the
  // span suppresses the hydration check of its own text) and picked up here.
  useEffect(() => {
    const now = field.current?.textContent;
    if (typeof now === "string" && now !== start) setTyped(now);
    // Once, after hydration: later changes arrive through onInput.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canSave = appTextCanSave(row, typed);
  const edited = typed !== null && typed !== start;

  function run(action: () => Promise<AppTextWriteResult>, done: string, after?: () => void) {
    setStatus("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      setStatus(result.ok ? done : APP_TEXT_PROBLEMS[result.error]);
      if (result.ok) after?.();
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
        {/* Remounted when the stored text changes (after a save) or on Cancel. */}
        <span
          aria-label={`Text for ${row.key}`}
          className="admin-app-text-field"
          contentEditable
          ref={field}
          data-testid={row.draft ? "draft-text" : row.published ? "published-text" : undefined}
          key={`${row.draft?.version ?? 0}:${row.published?.version ?? 0}:${start}:${resets}`}
          // Read back exactly (textContent): with pre-wrap a stored line break, a double space or
          // a no-break space stays as it is, and nothing else is inserted.
          onInput={(event) => setTyped(event.currentTarget.textContent ?? "")}
          // App text is one line: Enter adds no line break.
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          // Pasted text arrives as plain text on one line, never as formatting.
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            insertPlainText(event.currentTarget, text.replace(/\s*[\r\n]+\s*/g, " "));
            setTyped(event.currentTarget.textContent ?? "");
          }}
          onDrop={(event) => event.preventDefault()}
          role="textbox"
          spellCheck={false}
          suppressContentEditableWarning
          suppressHydrationWarning
        >
          {start}
        </span>
        {row.draft ? (
          <p className="admin-app-text-note" data-testid="published-text">
            {row.published
              ? `The app shows v${row.published.version}: ${row.published.body}`
              : `The app shows the default: ${row.defaultText}`}
          </p>
        ) : !row.published ? (
          <p className="admin-app-text-note">Not in the database. The app shows this default.</p>
        ) : null}
        {row.versions.length > 1 ? (
          <details className="admin-text-versions admin-app-text-versions">
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
        <p aria-live="polite" className="admin-app-text-note" role="status">
          {status}
        </p>
      </td>
      <td>
        {/* As the prototype: the pill sits in the cell itself; the buttons follow it in line. */}
        {row.draft ? (
          <StatePill state="draft">Draft</StatePill>
        ) : row.published ? (
          <StatePill state="published">Published</StatePill>
        ) : (
          <StatePill state="default">Default</StatePill>
        )}
        {canSave ? (
          <>
            {" "}
            <button
              className="button-gray button-small"
              disabled={busy}
              onClick={() =>
                run(
                  () => saveAppTextDraftAction(row.key, typed ?? start),
                  "Draft saved.",
                  () => setTyped(null),
                )
              }
              type="button"
            >
              Save draft
            </button>
          </>
        ) : null}
        {edited ? (
          <>
            {" "}
            <button
              className="button-gray button-small"
              disabled={busy}
              onClick={() => {
                setTyped(null);
                setStatus("");
                setResets((count) => count + 1);
              }}
              type="button"
            >
              Cancel
            </button>
          </>
        ) : null}
        {row.draft ? (
          <>
            {" "}
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
          </>
        ) : null}
      </td>
    </tr>
  );
}
