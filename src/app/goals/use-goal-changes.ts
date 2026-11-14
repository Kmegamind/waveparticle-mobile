"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { undoStatusFor } from "@/lib/goals/goals-view";
import type { SetGoalStatusOutcome } from "@/lib/home/goal-status";
import { resumeGoalAction, setGoalStatusAction } from "./actions";
import type { GoalToast } from "./goal-sheets";

/**
 * Put on hold, Mark done, Resume and Reopen, each with a five-second Undo and no confirmation
 * (#79). Shared by the Goals list and the Goal detail.
 */

export type GoalChange = "on_hold" | "done" | "resume" | "reopen";

const TEXT: Record<GoalChange, string> = {
  on_hold: "Put on hold.",
  done: "Marked done.",
  resume: "Back in progress.",
  reopen: "Reopened.",
};

const CHANGE_FAILED = "Could not change the Goal. Please try again.";
const UNDO_FAILED = "Could not undo. Please try again.";
const failed: SetGoalStatusOutcome = { status: "failed" };
const nowhere = () => null;

function send(change: GoalChange, goalId: string): Promise<SetGoalStatusOutcome> {
  if (change === "resume") return resumeGoalAction({ goalId });
  const status = change === "reopen" ? "in_progress" : change;
  return setGoalStatusAction({ goalId, status });
}

/**
 * `focusAfter` names where keyboard focus goes once a change or Undo is over: the row or button
 * that had it may be gone (a finding left by #73). `changing` is true when the page is about to
 * show a new status, so a page can wait for it before moving focus.
 */
export function useGoalChanges(focusAfter: (changing: boolean) => HTMLElement | null = nowhere) {
  const router = useRouter();
  const [toast, setToast] = useState<GoalToast | null>(null);
  const [busy, setBusy] = useState(false);

  const change = useCallback(
    async (kind: GoalChange, goalId: string) => {
      setBusy(true);
      const outcome = await send(kind, goalId).catch(() => failed);
      setBusy(false);
      focusAfter(outcome.status === "ok")?.focus();
      if (outcome.status !== "ok") {
        setToast({ text: CHANGE_FAILED, undo: null, failed: true });
        return false;
      }
      setToast({
        text: TEXT[kind],
        undo: { goalId, previous: outcome.previous, parkedSessionId: outcome.parkedSessionId },
      });
      router.refresh();
      return true;
    },
    [focusAfter, router],
  );

  const undo = useCallback(async () => {
    const current = toast;
    setToast(null);
    // Undo itself goes away with the toast.
    focusAfter(Boolean(current?.undo))?.focus();
    if (!current?.undo) return;
    const { goalId, previous, parkedSessionId } = current.undo;
    const outcome = await setGoalStatusAction({
      goalId,
      status: undoStatusFor(previous),
      sessionId: parkedSessionId,
    }).catch(() => failed);
    if (outcome.status !== "ok") {
      setToast({ ...current, text: UNDO_FAILED, failed: true });
      focusAfter(false)?.focus();
    }
    router.refresh();
  }, [focusAfter, router, toast]);

  const close = useCallback(() => setToast(null), []);

  return { toast, busy, change, undo, close, setToast };
}
