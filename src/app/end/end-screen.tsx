"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadSession, planKey } from "@/lib/prototype/session";
import type { FinishOutcome } from "@/lib/summary/finish-run";
import {
  finishedRun,
  focusLabel,
  loadSummaryRecord,
  planMinutesOf,
  saveSummaryRecord,
  type FinishShown,
  type FinishedRun,
} from "@/lib/summary/run";
import { usePrototypeState } from "../try/use-prototype-state";
import { finishRunAction } from "./actions";

const FAILURE_TEXT = "He is not here right now. Please try again.";

type View =
  | { kind: "waiting" }
  | { kind: "shown"; shown: FinishShown }
  | { kind: "failed" }
  | { kind: "no-goal" };

/** END (#258, prototype v4): his closing line, what he still carries, the Steps and the record. */
export function EndScreen({ titles }: { titles: Record<string, string> }) {
  const { ready, state } = usePrototypeState();
  if (!ready) return <main className="app-screen end-page" data-ready="false" />;
  const run = finishedRun(state, loadSession(window.localStorage));
  if (!run || !state.goal) {
    return (
      <main className="app-screen end-page" data-ready="true">
        <p>There is no finished Step to sum up.</p>
        <Link href="/">Home</Link>
      </main>
    );
  }
  return (
    <EndBody
      goal={state.goal.text}
      keyOfPlan={planKey(state)}
      run={run}
      title={titles[run.storyId] ?? ""}
    />
  );
}

function EndBody({
  goal,
  keyOfPlan,
  run,
  title,
}: {
  goal: string;
  keyOfPlan: string;
  run: FinishedRun;
  title: string;
}) {
  const [view, setView] = useState<View>(() => {
    const shown = loadSummaryRecord(window.localStorage, keyOfPlan)?.shown;
    return shown ? { kind: "shown", shown } : { kind: "waiting" };
  });
  const requested = useRef(false);

  useEffect(() => {
    if (view.kind !== "waiting" || requested.current) return;
    requested.current = true;
    // One run id per finished run, kept so a reload saves and shows the same run (never twice).
    const record = loadSummaryRecord(window.localStorage, keyOfPlan) ?? {
      runId: crypto.randomUUID(),
    };
    saveSummaryRecord(window.localStorage, keyOfPlan, record);
    finishRunAction({ runId: record.runId, ...run })
      .catch((): FinishOutcome => ({ status: "failed" }))
      .then((outcome) => {
        requested.current = false;
        if (outcome.status === "ok") {
          saveSummaryRecord(window.localStorage, keyOfPlan, { ...record, shown: outcome.shown });
          setView({ kind: "shown", shown: outcome.shown });
        } else if (outcome.status === "no-goal") {
          setView({ kind: "no-goal" });
        } else {
          setView({ kind: "failed" });
        }
      });
  }, [keyOfPlan, run, view.kind]);

  const focusSeconds = run.focusSeconds.reduce((total, seconds) => total + seconds, 0);

  return (
    <main
      className="app-screen end-page"
      data-ready="true"
      data-state={view.kind}
      aria-busy={view.kind === "waiting"}
    >
      {title ? <p className="focus-label">{title}</p> : null}

      {view.kind === "shown" ? (
        <>
          <figure className="focus-slip end-slip" data-testid="closing-line">
            <span aria-hidden="true" className="focus-tape" />
            <p>{view.shown.closingLine}</p>
          </figure>
          <figure className="focus-slip end-slip end-carry" data-testid="carry-line">
            <span aria-hidden="true" className="focus-tape" />
            <p>{view.shown.carryLine}</p>
          </figure>
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
          <p>{FAILURE_TEXT}</p>
          <button
            className="button-filled button-small"
            onClick={() => setView({ kind: "waiting" })}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
      {view.kind === "no-goal" ? <p>This Goal is not on your account.</p> : null}

      <section aria-labelledby="end-goal" className="end-card">
        <h2 className="focus-label" id="end-goal">
          Your goal
        </h2>
        <p>{goal}</p>
      </section>

      <section aria-labelledby="end-steps" className="end-card">
        <h2 className="focus-label" id="end-steps">
          Your steps
        </h2>
        <ul className="end-steps">
          {run.steps.map((step, index) => (
            <li key={index}>
              <span aria-hidden="true" className="end-check">
                ✓
              </span>
              {step.title}
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
            <dd>{planMinutesOf(run.steps)} min</dd>
          </div>
          <div>
            <dt>Focus time</dt>
            <dd>{focusLabel(focusSeconds)}</dd>
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
