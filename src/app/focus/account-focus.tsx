"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  accountSessionKey,
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
}: {
  plan: AccountFocusPlan | null;
  goalLine: string;
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
        paths: accountPathsFor(plan.sessionId),
        storageKey: accountSessionKey(plan.sessionId),
        goalLine,
        plan: sessionPlanOf(plan),
        loadStepCards: loadAccountStepCards,
        loadReturnLine: loadAccountReturnLine,
        seed,
        onProgress: record,
      }}
    />
  );
}
