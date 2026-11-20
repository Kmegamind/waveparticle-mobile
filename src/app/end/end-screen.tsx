"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { accountSessionKey, snapshotOf } from "@/lib/progress/focus-session";
import { isFinished, loadSession, saveSession } from "@/lib/prototype/session";
import { summaryUndo, summaryUndoOpen } from "@/lib/summary/end-undo";
import type { FinishOutcome, SummaryView } from "@/lib/summary/finish-run";
import { focusLabel, focusSecondsOf, type FinishShown } from "@/lib/summary/run";
import { useAppText } from "@/lib/app-text/provider";
import { fullPageLoad } from "../try/full-page-load";
import { recordFocusProgress } from "../focus/actions";
import { finishRunAction } from "./actions";

const NO_SUMMARY_TEXT = "There is no finished Step to sum up.";
const UNDO_FAILED_TEXT = "The Step could not be undone. Try again.";
const currentTime = () => Date.now();

type View =
  | { kind: "waiting" }
  | { kind: "shown"; shown: FinishShown }
  | { kind: "failed" }
  | { kind: "none" };

const noSubscription = () => () => {};

export function NoSummary() {
  return (
    <main className="app-screen end-page" data-ready="true">
      <p>{NO_SUMMARY_TEXT}</p>
      <Link href="/">Home</Link>
    </main>
  );
}

/** END (#258, prototype v4): his closing line, what he still carries, the Steps and the record. */
export function EndScreen({ view: summary }: { view: SummaryView }) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!ready) return <main className="app-screen end-page" data-ready="false" />;
  return <EndBody summary={summary} />;
}

function EndBody({ summary }: { summary: SummaryView }) {
  const failureText = useAppText("ui.END.fail.body");
  const retryLabel = useAppText("ui.END.fail.retry");
  const [view, setView] = useState<View>({ kind: "waiting" });
  const [focusSeconds] = useState(() =>
    focusSecondsOf(loadSession(window.localStorage, accountSessionKey(summary.sessionId))),
  );
  const requested = useRef(false);
  // The last Done's own progress write; Undo waits for it so the run is reopened after it.
  const recording = useRef<Promise<unknown>>(Promise.resolve());
  const storageKey = accountSessionKey(summary.sessionId);
  // #27 AC4: the same "Step done" Undo toast as on the focus page, with the time it had left.
  const [now, setNow] = useState(currentTime);
  const [heldMs, setHeldMs] = useState<number | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
  const [device, setDevice] = useState(() => loadSession(window.localStorage, storageKey));
  const undoOpen = !undoFailed && (heldMs !== null || undoing || summaryUndoOpen(device, now));

  useEffect(() => {
    if (!undoOpen || heldMs !== null) return;
    const timer = window.setInterval(() => setNow(currentTime()), 250);
    return () => window.clearInterval(timer);
  }, [undoOpen, heldMs]);

  function holdToast() {
    if (heldMs === null && device?.undo)
      setHeldMs(Math.max(0, device.undo.untilMs - currentTime()));
  }

  function releaseToast() {
    if (heldMs === null || !device?.undo) return;
    const untilMs = currentTime() + heldMs;
    setDevice((current) =>
      current?.undo ? { ...current, undo: { ...current.undo, untilMs } } : current,
    );
    setHeldMs(null);
    setNow(currentTime());
  }

  async function onUndo() {
    if (undoing) return;
    const back = summaryUndo(device, currentTime(), heldMs);
    setHeldMs(null);
    if (!back) return;
    setUndoing(true);
    await recording.current.catch(() => undefined);
    const reopened = await recordFocusProgress(snapshotOf(summary.sessionId, back)).catch(
      () => false,
    );
    if (!reopened) {
      // The account still holds the finished run; this device keeps it too.
      setUndoing(false);
      setUndoFailed(true);
      return;
    }
    saveSession(window.localStorage, back, storageKey);
    fullPageLoad(`/focus?goal=${encodeURIComponent(summary.goalId)}`);
  }

  useEffect(() => {
    if (view.kind !== "waiting" || requested.current) return;
    requested.current = true;
    const stored = loadSession(window.localStorage, storageKey);
    // The last Done's progress may still be on its way: send this device's state first, so the
    // account knows the session is complete (#257 records it the same way).
    const recorded =
      stored && isFinished(stored)
        ? recordFocusProgress(snapshotOf(summary.sessionId, stored)).catch(() => false)
        : Promise.resolve(false);
    recording.current = recorded;
    recorded
      .then(() => finishRunAction({ sessionId: summary.sessionId }))
      .catch((): FinishOutcome => ({ status: "failed" }))
      .then((outcome) => {
        requested.current = false;
        if (outcome.status === "ok") setView({ kind: "shown", shown: outcome.shown });
        else if (outcome.status === "failed") setView({ kind: "failed" });
        else setView({ kind: "none" });
      });
  }, [storageKey, summary.sessionId, view.kind]);

  if (view.kind === "none") return <NoSummary />;

  return (
    <main
      aria-busy={view.kind === "waiting"}
      className="app-screen end-page"
      data-ready="true"
      data-state={view.kind}
      data-toast={undoOpen ? "open" : undefined}
    >
      <p className="focus-label">{summary.storyTitle}</p>

      {view.kind === "shown" ? (
        <>
          <figure className="focus-slip end-slip" data-testid="closing-line">
            <span aria-hidden="true" className="focus-tape" />
            <p>{view.shown.closingLine}</p>
          </figure>
          {view.shown.carryLine ? (
            <figure className="focus-slip end-slip end-carry" data-testid="carry-line">
              <span aria-hidden="true" className="focus-tape" />
              <p>{view.shown.carryLine}</p>
            </figure>
          ) : null}
        </>
      ) : null}
      {view.kind === "waiting" ? (
        <p aria-hidden="true" className="rest-dots">
          <span />
          <span />
          <span />
        </p>
      ) : null}
      {view.kind === "failed" ? (
        <div className="rest-failure">
          <p>{failureText}</p>
          <button
            className="button-filled button-small"
            onClick={() => setView({ kind: "waiting" })}
            type="button"
          >
            {retryLabel}
          </button>
        </div>
      ) : null}

      <section aria-labelledby="end-goal" className="end-card">
        <h2 className="focus-label" id="end-goal">
          Your goal
        </h2>
        <p>{summary.goalTitle}</p>
      </section>

      <section aria-labelledby="end-steps" className="end-card">
        <h2 className="focus-label" id="end-steps">
          Your steps
        </h2>
        <ul className="end-steps">
          {summary.steps.map((title, index) => (
            <li key={index}>
              <span aria-hidden="true" className="end-check">
                ✓
              </span>
              {title}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="end-record" className="end-card">
        <h2 className="focus-label" id="end-record">
          Your record
        </h2>
        <dl className="end-record">
          <div>
            <dt>Plan length</dt>
            <dd>{summary.planMinutes} min</dd>
          </div>
          <div>
            <dt>Focus time</dt>
            <dd>{focusSeconds === null ? "Not on this device" : focusLabel(focusSeconds)}</dd>
          </div>
        </dl>
      </section>

      <div className="end-actions">
        {view.kind === "shown" && view.shown.next ? (
          <Link className="button-filled" href="/companions/oppenheimer">
            Next
          </Link>
        ) : null}
        <Link className="end-home" href="/">
          Home
        </Link>
      </div>

      {undoFailed ? <p role="alert">{UNDO_FAILED_TEXT}</p> : null}
      {undoOpen ? (
        <div
          className="focus-toast"
          onBlur={releaseToast}
          onFocus={holdToast}
          onMouseEnter={holdToast}
          onMouseLeave={releaseToast}
          role="status"
        >
          <span>Step done</span>
          <button
            aria-disabled={undoing}
            className="focus-toast-action"
            onClick={onUndo}
            type="button"
          >
            Undo
          </button>
        </div>
      ) : null}
    </main>
  );
}
