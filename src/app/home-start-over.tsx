"use client";

import { useRef, useState } from "react";
import { startOverAction } from "./home-actions";
import { fullPageLoad } from "./try/full-page-load";
import { HomeGoalOptions, type HomeToastState } from "./home-goal-options";

/**
 * HOME-3 (#87, US-HOME-3): after more than three days away, a system card (not his voice, so no
 * slip) with Pick it back up as the default and Start over second. No day count, no "abandoned",
 * no Meanwhile line. Start over opens HOME-3B, a native modal dialog like HOME-MENU (DESIGN 6.7):
 * Start from Step 1 restarts the Plan and his night (T5) and opens the focus page at Step 1; Not
 * now closes it and focus returns to Start over.
 */
export function WelcomeBack({
  goalId,
  title,
  continueHref,
  onChanged,
}: {
  goalId: string;
  title: string;
  /** #69's Continue: the focus page applies the return pop-up (T6). */
  continueHref: string | null;
  onChanged: (toast: HomeToastState) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    const outcome = await startOverAction({ goalId }).catch(() => ({ status: "failed" as const }));
    if (outcome.status !== "ok") {
      setBusy(false);
      setFailed(true);
      return;
    }
    // A full page load, as Continue does: the focus page opens the new session at Step 1.
    fullPageLoad(`/focus?goal=${encodeURIComponent(goalId)}`);
  }

  return (
    <section aria-label="Goal" className="home-card">
      <div className="home-card-top">
        <p className="focus-label">Welcome back</p>
        <HomeGoalOptions goalId={goalId} onChanged={onChanged} />
      </div>
      <h2 className="home-card-title">Your Goal is where you left it.</h2>
      <p className="home-card-text">{title}</p>
      {continueHref ? (
        <a className="button-filled" href={continueHref}>
          Pick it back up
        </a>
      ) : null}
      <button
        aria-haspopup="dialog"
        className="button-gray"
        onClick={() => {
          setFailed(false);
          dialog.current?.showModal();
        }}
        ref={opener}
        type="button"
      >
        Start over
      </button>
      <dialog
        aria-labelledby="start-over-title"
        className="home-sheet"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClose={() => opener.current?.focus()}
        ref={dialog}
      >
        <h2 className="home-sheet-title" id="start-over-title">
          Start over?
        </h2>
        <p>
          Nothing is lost. Your Steps begin again from Step 1, and his night begins again from the
          start.
        </p>
        {failed ? <p role="alert">Could not start over. Please try again.</p> : null}
        <button
          className="button-filled"
          disabled={busy}
          onClick={() => void confirm()}
          type="button"
        >
          Start from Step 1
        </button>
        <button
          className="button-gray"
          disabled={busy}
          onClick={() => dialog.current?.close()}
          type="button"
        >
          Not now
        </button>
      </dialog>
    </section>
  );
}
