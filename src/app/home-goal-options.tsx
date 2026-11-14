"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GoalStatus, SetGoalStatusOutcome } from "@/lib/home/goal-status";
import { setGoalStatusAction } from "./home-actions";

/** What the Undo toast needs after Put on hold or Mark done (#268 AC4). */
export type HomeToastState = {
  goalId: string;
  previous: GoalStatus;
  /** The session the change parked, if any: Undo reopens exactly this one. */
  parkedSessionId?: string;
  text: string;
};

const TOAST_MS = 5_000;
const UNDO_FAILED = "Could not undo. Please try again.";

/** The request Undo sends: the previous status and the session that was parked. */
export function undoRequest(toast: HomeToastState) {
  return { goalId: toast.goalId, status: toast.previous, sessionId: toast.parkedSessionId };
}

/** After Undo: no toast when it worked; otherwise a toast that says so, with Undo to retry. */
export function afterUndo(
  toast: HomeToastState,
  outcome: SetGoalStatusOutcome,
): HomeToastState | null {
  return outcome.status === "ok" ? null : { ...toast, text: UNDO_FAILED };
}

/**
 * ⋯ on the Home Goal card and its "Goal options" sheet (HOME-MENU, #88): Put on hold, Mark done,
 * Close. A native modal dialog gives the focus trap, the inert background and Esc (DESIGN 6.7);
 * focus returns to ⋯ when it closes. No confirmation, no Delete, nothing red.
 */
export function HomeGoalOptions({
  goalId,
  onChanged,
}: {
  goalId: string;
  onChanged: (toast: HomeToastState) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function open() {
    setFailed(false);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  async function choose(status: "on_hold" | "done") {
    setBusy(true);
    const outcome = await setGoalStatusAction({ goalId, status }).catch(() => ({
      status: "failed" as const,
    }));
    setBusy(false);
    if (outcome.status !== "ok") {
      setFailed(true);
      return;
    }
    close();
    onChanged({
      goalId,
      previous: outcome.previous,
      parkedSessionId: outcome.parkedSessionId,
      text: status === "on_hold" ? "Goal put on hold" : "Goal marked done",
    });
    router.refresh();
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Goal options"
        className="home-more"
        onClick={open}
        ref={opener}
        type="button"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      <dialog
        aria-labelledby="goal-options-title"
        className="home-sheet"
        onClose={() => opener.current?.focus()}
        ref={dialog}
      >
        <h2 className="home-sheet-title" id="goal-options-title">
          Goal options
        </h2>
        {failed ? <p role="alert">Could not change the Goal. Please try again.</p> : null}
        <button
          className="button-gray"
          disabled={busy}
          onClick={() => void choose("on_hold")}
          type="button"
        >
          Put on hold
        </button>
        <button
          className="button-gray"
          disabled={busy}
          onClick={() => void choose("done")}
          type="button"
        >
          Mark done
        </button>
        <button className="button-gray" onClick={close} type="button">
          Close
        </button>
      </dialog>
    </>
  );
}

/** "Goal put on hold · Undo" for five seconds, paused while focused or hovered (DESIGN 6.8). */
export function HomeToast({
  toast,
  onClose,
  onReplace,
}: {
  toast: HomeToastState;
  onClose: () => void;
  onReplace: (toast: HomeToastState) => void;
}) {
  const router = useRouter();
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const id = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [held, onClose]);

  async function undo() {
    onClose();
    const outcome = await setGoalStatusAction(undoRequest(toast)).catch(() => ({
      status: "failed" as const,
    }));
    const next = afterUndo(toast, outcome);
    if (next) onReplace(next);
    router.refresh();
  }

  return (
    <div
      className="focus-toast home-toast"
      onBlur={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      role="status"
    >
      <span>{toast.text}</span>
      <button className="focus-toast-action" onClick={() => void undo()} type="button">
        Undo
      </button>
    </div>
  );
}
