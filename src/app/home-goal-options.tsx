"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GoalStatus } from "@/lib/home/goal-status";
import { setGoalStatusAction } from "./home-actions";

/** What the Undo toast needs after Put on hold or Mark done (#268 AC4). */
export type HomeToastState = { goalId: string; previous: GoalStatus; text: string };

const TOAST_MS = 5_000;

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
export function HomeToast({ toast, onClose }: { toast: HomeToastState; onClose: () => void }) {
  const router = useRouter();
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const id = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [held, onClose]);

  async function undo() {
    onClose();
    await setGoalStatusAction({ goalId: toast.goalId, status: toast.previous }).catch(() => null);
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
