"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { accountSessionKey, snapshotOf } from "@/lib/progress/focus-session";
import { isFinished, loadSession } from "@/lib/prototype/session";
import type { FinishOutcome, SummaryView } from "@/lib/summary/finish-run";
import { focusLabel, focusSecondsOf, type FinishShown } from "@/lib/summary/run";
import { useAppText } from "@/lib/app-text/provider";
import { recordFocusProgress } from "../focus/actions";
import { finishRunAction } from "./actions";

const NO_SUMMARY_TEXT = "There is no finished Step to sum up.";

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

  useEffect(() => {
    if (view.kind !== "waiting" || requested.current) return;
    requested.current = true;
    const device = loadSession(window.localStorage, accountSessionKey(summary.sessionId));
    // The last Done's progress may still be on its way: send this device's state first, so the
    // account knows the session is complete (#257 records it the same way).
    const recorded =
      device && isFinished(device)
        ? recordFocusProgress(snapshotOf(summary.sessionId, device)).catch(() => false)
        : Promise.resolve(false);
    recorded
      .then(() => finishRunAction({ sessionId: summary.sessionId }))
      .catch((): FinishOutcome => ({ status: "failed" }))
      .then((outcome) => {
        requested.current = false;
        if (outcome.status === "ok") setView({ kind: "shown", shown: outcome.shown });
        else if (outcome.status === "failed") setView({ kind: "failed" });
        else setView({ kind: "none" });
      });
  }, [summary.sessionId, view.kind]);

  if (view.kind === "none") return <NoSummary />;

  return (
    <main
      aria-busy={view.kind === "waiting"}
      className="app-screen end-page"
      data-ready="true"
      data-state={view.kind}
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
    </main>
  );
}
