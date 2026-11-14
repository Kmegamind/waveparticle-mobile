"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GoalStatus } from "@/lib/goals/goals-view";
import { startHref } from "@/lib/goals/goals-view";

/**
 * The Goals area's sheets and toast (prototype v4 G2b, G3, #79 toasts). Native modal dialogs give
 * the focus trap, the inert background and Esc (DESIGN 6.7); focus returns to the opener.
 */

export type GoalToast = {
  text: string;
  /** What Undo sends; null for a toast without Undo. */
  undo: { goalId: string; previous: GoalStatus; parkedSessionId?: string } | null;
  failed?: boolean;
};

const TOAST_MS = 5_000;

export function Toast({
  toast,
  onClose,
  onUndo,
}: {
  toast: GoalToast;
  onClose: () => void;
  onUndo: () => void;
}) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const id = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [held, onClose, toast]);

  return (
    <div
      className="focus-toast goals-toast"
      onBlur={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      role={toast.failed ? "alert" : "status"}
    >
      <span>{toast.text}</span>
      {toast.undo ? (
        <button className="focus-toast-action" onClick={onUndo} type="button">
          Undo
        </button>
      ) : null}
    </div>
  );
}

/**
 * `returnTo` is the button that opened the sheet. Safari does not focus a button on click, so the
 * active element at opening time is not a reliable opener.
 */
function useModal(open: boolean, onClose: () => void, returnTo: HTMLElement | null) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      opener.current = returnTo ?? document.activeElement;
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, returnTo]);
  const onDialogClose = () => {
    onClose();
    if (opener.current instanceof HTMLElement) opener.current.focus();
  };
  return { dialog, onDialogClose };
}

/** G2b: Put on hold and Mark done, no Delete, nothing red, no question asked. */
export function GoalMenu({
  status,
  busy,
  onChoose,
  onClose,
  returnTo,
}: {
  status: GoalStatus | null;
  busy: boolean;
  onChoose: (status: "on_hold" | "done") => void;
  onClose: () => void;
  returnTo: HTMLElement | null;
}) {
  const { dialog, onDialogClose } = useModal(status !== null, onClose, returnTo);
  return (
    <dialog
      aria-labelledby="goal-menu-title"
      className="home-sheet goals-sheet"
      onClose={onDialogClose}
      ref={dialog}
    >
      <h2 className="home-sheet-title" id="goal-menu-title">
        Goal menu
      </h2>
      {status !== "on_hold" ? (
        <button
          className="button-gray"
          disabled={busy}
          onClick={() => onChoose("on_hold")}
          type="button"
        >
          Put on hold
        </button>
      ) : null}
      {status !== "done" ? (
        <button
          className="button-gray"
          disabled={busy}
          onClick={() => onChoose("done")}
          type="button"
        >
          Mark done
        </button>
      ) : null}
      <button
        className="button-plain goals-sheet-close"
        onClick={() => dialog.current?.close()}
        type="button"
      >
        Close
      </button>
    </dialog>
  );
}

const DRAFT_KEY = "waveparticle.goals.draft";

function readDraft(): string {
  try {
    return window.sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(value: string) {
  try {
    if (value) window.sessionStorage.setItem(DRAFT_KEY, value);
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Blocked storage: the draft lives only while the sheet is open.
  }
}

/** G3: one question with an arrow; no type, date or Companion picker (#77 AC1). */
/** The draft kept from an earlier visit of the sheet (#77 AC2). */
export function keptDraft(): string {
  return readDraft();
}

export function NewGoalSheet({
  open,
  initialDraft,
  onClose,
  returnTo,
}: {
  open: boolean;
  initialDraft: string;
  onClose: () => void;
  returnTo: HTMLElement | null;
}) {
  const { dialog, onDialogClose } = useModal(open, onClose, returnTo);
  const [draft, setDraft] = useState(initialDraft);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const line = draft.trim();
    if (!line) return;
    writeDraft("");
    window.location.assign(startHref(line));
  }

  return (
    <dialog
      aria-labelledby="new-goal-title"
      className="home-sheet goals-sheet"
      onClose={onDialogClose}
      ref={dialog}
    >
      <div className="goals-sheet-head">
        <h2 className="home-sheet-title" id="new-goal-title">
          New goal
        </h2>
        <button className="try-link" onClick={() => dialog.current?.close()} type="button">
          Close
        </button>
      </div>
      <form className="goals-new" onSubmit={onSubmit}>
        <label className="goals-caption" htmlFor="goals-new-line">
          What are you working on?
        </label>
        <div className="try-composer">
          <input
            aria-label="Your goal"
            autoComplete="off"
            className="try-field"
            id="goals-new-line"
            maxLength={1000}
            onChange={(event) => {
              setDraft(event.target.value);
              writeDraft(event.target.value);
            }}
            placeholder="e.g. Methods section for Friday"
            value={draft}
          />
          <button aria-label="Next: choose steps" className="try-send" type="submit">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </form>
    </dialog>
  );
}
