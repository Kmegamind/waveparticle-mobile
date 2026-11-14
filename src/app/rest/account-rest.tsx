"use client";

import { useState, useSyncExternalStore } from "react";
import {
  accountSessionKey,
  seedFocusSession,
  sessionPlanOf,
  type AccountFocusPlan,
} from "@/lib/progress/focus-session";
import { isFinished, loadSession, syncSession, type FocusSession } from "@/lib/prototype/session";
import { NoPlan } from "../_session/focus-body";
import { ACCOUNT_PATHS } from "../_session/paths";
import { RestBody } from "../_session/rest-body";
import { useAccountRecorder } from "../focus/use-account-recorder";
import { loadAccountPauseMessage, loadAccountRestReply } from "./actions";

const noSubscription = () => () => {};

/** /rest: the shared rest page (#257) on the account's open session. */
export function AccountRest({ plan }: { plan: AccountFocusPlan | null }) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!ready) return <main className="app-screen try-screen" data-ready="false" />;
  if (!plan) return <NoPlan paths={ACCOUNT_PATHS} text="There is no Step to rest from." />;
  return <AccountRestSession plan={plan} />;
}

/** This device's session for this Plan, or the one rebuilt from the account. */
function deviceSession(plan: AccountFocusPlan): FocusSession {
  const device = loadSession(window.localStorage, accountSessionKey(plan.sessionId));
  const speed = device?.speed ?? 1;
  return syncSession(
    device ?? seedFocusSession(plan, speed, Date.now()),
    sessionPlanOf(plan),
    speed,
  );
}

function AccountRestSession({ plan }: { plan: AccountFocusPlan }) {
  const [stored] = useState(() => deviceSession(plan));
  const record = useAccountRecorder(plan.sessionId);
  if (isFinished(stored)) {
    return <NoPlan paths={ACCOUNT_PATHS} text="There is no Step to rest from." />;
  }
  return (
    <RestBody
      host={{
        paths: ACCOUNT_PATHS,
        storageKey: accountSessionKey(plan.sessionId),
        plan: sessionPlanOf(plan),
        stored,
        loadPauseMessage: loadAccountPauseMessage,
        loadRestReply: loadAccountRestReply,
        onProgress: record,
      }}
    />
  );
}
