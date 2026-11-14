"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { goalDetail, type GoalKind, type GoalsData } from "@/lib/goals/goals-view";
import { renameGoalAction, setGoalKindAction } from "../actions";
import { Toast } from "../goal-sheets";
import { HistoryList } from "../goals-screen";
import { useGoalChanges } from "../use-goal-changes";
import { useLocalNow } from "../use-local-now";

const EPOCH = { now: new Date(0), timeZone: "UTC" };

const KINDS: { id: GoalKind; label: string }[] = [
  { id: "one_time", label: "One-time" },
  { id: "ongoing", label: "Ongoing" },
];

const TAB_OF = { planned: "", in_progress: "", on_hold: "?tab=hold", done: "?tab=done" } as const;

export function GoalDetailScreen({
  data,
  goalId,
  sessionPagesEnabled,
}: {
  data: GoalsData;
  goalId: string;
  sessionPagesEnabled: boolean;
}) {
  const router = useRouter();
  const local = useLocalNow();
  const detail = useMemo(
    () => goalDetail(data, goalId, { ...(local ?? EPOCH), sessionPagesEnabled }),
    [data, goalId, local, sessionPagesEnabled],
  );
  const { toast, busy, change, undo, close, setToast } = useGoalChanges();
  const [title, setTitle] = useState(detail?.title ?? "");
  const [savedTitle, setSavedTitle] = useState(detail?.title ?? "");
  const [kind, setKind] = useState<GoalKind>(detail?.kind ?? "one_time");
  const [problem, setProblem] = useState<string | null>(null);
  if (!detail) return null;
  const ready = local !== null;

  async function saveTitle() {
    const next = title.trim();
    if (next.length === 0) {
      setTitle(savedTitle);
      return;
    }
    if (next === savedTitle) return;
    const outcome = await renameGoalAction({ goalId, title: next }).catch(() => ({
      status: "failed" as const,
    }));
    if (outcome.status === "crisis") {
      router.push("/safety");
      return;
    }
    if (outcome.status !== "ok") {
      setProblem("Could not rename the Goal. Please try again.");
      setTitle(savedTitle);
      return;
    }
    setProblem(null);
    setSavedTitle(next);
    setTitle(next);
    router.refresh();
  }

  async function chooseKind(next: GoalKind) {
    if (next === kind) return;
    const before = kind;
    setKind(next);
    const outcome = await setGoalKindAction({ goalId, kind: next }).catch(() => ({
      status: "failed" as const,
    }));
    if (outcome.status !== "ok") {
      setKind(before);
      setProblem("Could not change the type. Please try again.");
      return;
    }
    setProblem(null);
    router.refresh();
  }

  const primaryLabel = {
    continue: "Continue",
    start: "Start",
    resume: "Resume",
    reopen: "Reopen",
  } as const;

  return (
    <main className="app-screen goal-detail" data-ready={ready ? "true" : "false"}>
      <Link
        aria-label="Back to Goals"
        className="goal-back"
        href={`/goals${TAB_OF[detail.status]}`}
      >
        <span aria-hidden="true">‹</span>
        <span aria-hidden="true" className="goals-group">
          Goals
        </span>
      </Link>

      <div className="goal-detail-body">
        <label className="goals-group goal-label" htmlFor="goal-title">
          Goal
        </label>
        <input
          className="try-field goal-title"
          id="goal-title"
          maxLength={1000}
          onBlur={() => void saveTitle()}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveTitle();
            }
          }}
          value={title}
        />
        <p className="goals-caption goal-status">
          {detail.statusLabel} · with {detail.companion}
        </p>
        {problem ? (
          <p className="goals-caption" role="alert">
            {problem}
          </p>
        ) : null}

        <h2 className="goals-group" id="goal-type">
          Type
        </h2>
        <div aria-labelledby="goal-type" className="goal-chips" role="radiogroup">
          {KINDS.map((item) => (
            <button
              aria-checked={kind === item.id}
              className="goal-chip"
              key={item.id}
              onClick={() => void chooseKind(item.id)}
              role="radio"
              type="button"
            >
              {kind === item.id ? "✓ " : ""}
              {item.label}
            </button>
          ))}
        </div>

        <h2 className="goals-group">Your steps</h2>
        {detail.steps ? (
          <ul className="goal-steps">
            {detail.steps.map((step) => (
              <li key={step.id}>
                <button
                  className="goal-step"
                  onClick={() => setToast({ text: "Complete steps in your session.", undo: null })}
                  type="button"
                >
                  <span aria-hidden="true" className="goal-step-mark">
                    {step.done ? "✓" : "○"}
                  </span>
                  <span className="goal-step-text">
                    <span className="goal-step-title">{step.title}</span>
                    <span className="sr-only">{step.done ? " (done)" : " (not done)"}</span>
                    {step.description ? (
                      <span className="goals-caption goal-step-description">
                        {step.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="goals-caption">Nothing open right now.</p>
        )}

        <h2 className="goals-group">Recent sessions</h2>
        {detail.recent.length > 0 ? (
          <>
            <HistoryList ready={ready} rows={detail.recent} withGoal={false} />
            <Link className="try-link goal-see-all" href="/goals?tab=history">
              See all
            </Link>
          </>
        ) : (
          <p className="goals-caption">None yet.</p>
        )}
      </div>

      <div className="goal-footer">
        {detail.primary === "continue" || detail.primary === "start" ? (
          // A plain link: the focus page and the dialogue load fresh (return rule, #69).
          <a className="button-filled goal-primary" href={detail.primaryHref ?? undefined}>
            {primaryLabel[detail.primary]}
          </a>
        ) : null}
        {detail.primary === "resume" || detail.primary === "reopen" ? (
          <button
            className="button-filled goal-primary"
            disabled={busy}
            onClick={() => void change(detail.primary as "resume" | "reopen", goalId)}
            type="button"
          >
            {primaryLabel[detail.primary]}
          </button>
        ) : null}
        <div className="goal-footer-links">
          {detail.canHold ? (
            <button
              className="try-link"
              disabled={busy}
              onClick={() => void change("on_hold", goalId)}
              type="button"
            >
              Put on hold
            </button>
          ) : null}
          {detail.canDone ? (
            <button
              className="try-link"
              disabled={busy}
              onClick={() => void change("done", goalId)}
              type="button"
            >
              Mark done
            </button>
          ) : null}
        </div>
      </div>
      {toast ? <Toast onClose={close} onUndo={() => void undo()} toast={toast} /> : null}
    </main>
  );
}
