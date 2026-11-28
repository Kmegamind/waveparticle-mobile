"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  planStorageKey,
  seedFocusSession,
  sessionPlanOf,
  type AccountFocusPlan,
} from "@/lib/progress/focus-session";
import { FocusBody, NoPlan } from "../_session/focus-body";
import { ACCOUNT_PATHS, accountPathsFor } from "../_session/paths";
import { loadAccountReturnLine, loadAccountStepCards } from "./actions";
import { useAccountRecorder } from "./use-account-recorder";

const noSubscription = () => () => {};

/** /focus: the shared focus page (#257) on the account's Plan. No test data on this page. */
export function AccountFocus({
  plan,
  goalLine,
  keepClockRunning,
  who,
  portrait,
}: {
  plan: AccountFocusPlan | null;
  goalLine: string;
  /** The account's "Keep the clock running when I leave" (#71), read on each page load. */
  keepClockRunning: boolean;
  /** "Who I am" of the session's story, for the sheet from his portrait (#72). */
  who: string;
  /** #521: the session's Companion's portrait. */
  portrait?: string;
}) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const record = useAccountRecorder(plan?.sessionId ?? "");
  const seed = useCallback(
    (speed: number, nowMs: number) => seedFocusSession(plan!, speed, nowMs),
    [plan],
  );

  if (!ready) return <main className="app-screen try-screen" data-ready="false" />;
  if (!plan) return <NoPlan paths={ACCOUNT_PATHS} text="There is no Goal to work on yet." />;
  return (
    <FocusBody
      host={{
        // #114: with the Story off there is no summary (END is his closing line); the last Done
        // keeps the Undo toast here.
        paths: plan.storyOff ? ACCOUNT_PATHS : accountPathsFor(plan.sessionId),
        storageKey: planStorageKey(plan),
        goalLine,
        who,
        portrait,
        plan: sessionPlanOf(plan),
        // #300: the pre-made cards of this session, by Step; nothing else goes to the server.
        loadStepCards: (request) =>
          loadAccountStepCards({ sessionId: plan.sessionId, index: request.index }),
        loadReturnLine: loadAccountReturnLine,
        seed,
        onProgress: record,
        keepClockRunning,
        // #114: the study condition of the research flag (F1-STUDY).
        storyOff: plan.storyOff,
      }}
    />
  );
}
