"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  APP_TEXT_PROBLEMS,
  appTextEditState,
  appTextStartText,
  appTextStoredKey,
  type AppTextAdminRow,
  type AppTextTyping,
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
 *
 * Unsaved typing is tied to the stored state it started from. While there is typing, Publish vN
 * and Roll back wait (they act on the stored text, not on what the field shows). If the stored
 * text changes under the typing (Publish changes, or another editor), the field keeps showing the
 * typing, and a notice says so, with Discard.
 */
export function AppTextEditor({ row }: { row: AppTextAdminRow }) {
  const id = useId();
  const [status, setStatus] = useState("");
  // The field's unsaved typing; null until something is typed (and after a save or a discard).
  const [typing, setTyping] = useState<AppTextTyping | null>(null);
  // Bumped by Cancel and Discard, so the field is drawn again from the stored text.
  const [resets, setResets] = useState(0);
  const [pending, startTransition] = useTransition();
  const start = appTextStartText(row);
  const storedKey = appTextStoredKey(row);
  // False in the server HTML and until React has hydrated: the buttons stay off until then.
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const busy = pending || !ready;
  const field = useRef<HTMLSpanElement>(null);
  const { edited, stale, canSave } = appTextEditState(row, typing);

  /** Records what the field holds now, against the stored state the typing started from. */
  function type(text: string) {
    setTyping((now) => ({
      key: now?.key ?? storedKey,
      base: now?.base ?? start,
      text,
    }));
  }

  function discard() {
    setTyping(null);
    setStatus("");
    setResets((count) => count + 1);
  }

  // The field is editable from the server HTML on. Text typed before React hydrated is kept (the
  // span suppresses the hydration check of its own text) and picked up here.
  useEffect(() => {
    const now = field.current?.textContent;
    if (typeof now === "string" && now !== start) type(now);
    // Once, after hydration: later changes arrive through onInput.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(action: () => Promise<AppTextWriteResult>, done: string, after?: () => void) {
    setStatus("");
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false, error: "failed" }) as const);
      setStatus(result.ok ? done : APP_TEXT_PROBLEMS[result.error]);
      if (result.ok) after?.();
    });
  }

  // While there is typing, the field keeps its element and its first text (the key and text it was
  // drawn with when the typing began): React never redraws it under the user. Without typing, it
  // is drawn again whenever the stored text changes.
  const fieldKey = `${typing?.key ?? storedKey}:${resets}`;
  const waitId = `${id}-wait`;

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
        <span
          aria-label={`Text for ${row.key}`}
          className="admin-app-text-field"
          contentEditable
          data-testid={row.draft ? "draft-text" : row.published ? "published-text" : undefined}
          key={fieldKey}
          // Read back exactly (textContent): with pre-wrap a stored line break, a double space or
          // a no-break space stays as it is, and nothing else is inserted.
          onInput={(event) => type(event.currentTarget.textContent ?? "")}
          // App text is one line: Enter adds no line break.
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          // Pasted text arrives as plain text on one line, never as formatting.
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            insertPlainText(event.currentTarget, text.replace(/\s*[\r\n]+\s*/g, " "));
            type(event.currentTarget.textContent ?? "");
          }}
          onDrop={(event) => event.preventDefault()}
          ref={field}
          role="textbox"
          spellCheck={false}
          suppressContentEditableWarning
          suppressHydrationWarning
        >
          {typing ? typing.base : start}
        </span>
        {stale ? (
          <p className="admin-app-text-note admin-app-text-kept" role="alert">
            The stored text changed; your unsaved text was kept. It is now:{" "}
            <span className="admin-text-body">{start}</span>{" "}
            <button className="button-gray button-small" onClick={discard} type="button">
              Discard
            </button>
          </p>
        ) : null}
        {row.draft ? (
          <p className="admin-app-text-note" data-testid="published-text">
            {row.published
              ? `The app shows v${row.published.version}: ${row.published.body}`
              : `The app shows the default: ${row.defaultText}`}
          </p>
        ) : !row.published ? (
          <p className="admin-app-text-note">Not in the database. The app shows this default.</p>
        ) : null}
        {edited && (row.draft || row.versions.some((version) => version.canRollBack)) ? (
          <p className="admin-app-text-note" id={waitId}>
            Save or cancel your edit first: Publish and Roll back use the stored text.
          </p>
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
                      aria-describedby={edited ? waitId : undefined}
                      className="button-gray button-small"
                      disabled={busy || edited}
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
                  () => saveAppTextDraftAction(row.key, typing?.text ?? start),
                  "Draft saved.",
                  () => setTyping(null),
                )
              }
              type="button"
            >
              Save draft
            </button>
          </>
        ) : null}
        {edited && !stale ? (
          <>
            {" "}
            <button className="button-gray button-small" onClick={discard} type="button">
              Cancel
            </button>
          </>
        ) : null}
        {row.draft ? (
          <>
            {" "}
            <button
              aria-describedby={edited ? waitId : undefined}
              className="button-filled button-small"
              disabled={busy || edited}
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
