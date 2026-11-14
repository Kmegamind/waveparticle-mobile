"use client";

import { isFinished, loadSession, SESSION_KEY } from "@/lib/prototype/session";
import { NoPlan } from "../../_session/focus-body";
import { TRY_PATHS } from "../../_session/paths";
import { RestBody } from "../../_session/rest-body";
import { usePrototypeState } from "../use-prototype-state";
import { loadPauseMessage, loadRestReply } from "./actions";

/** /try/rest: the shared rest page (#257) with the browser store and labelled test data. */
export function RestScreen() {
  const { ready, state } = usePrototypeState();
  if (!ready) return <main className="app-screen try-screen" data-ready="false" />;

  const stored =
    state.goal && state.steps.length > 0 ? loadSession(window.localStorage, SESSION_KEY) : null;
  if (!state.goal || !stored || isFinished(stored)) {
    return <NoPlan paths={TRY_PATHS} text="There is no Step to rest from." />;
  }
  return (
    <RestBody
      host={{
        paths: TRY_PATHS,
        storageKey: SESSION_KEY,
        plan: { goal: state.goal, steps: state.steps, storyId: state.storyId },
        stored,
        loadPauseMessage,
        loadRestReply,
      }}
    />
  );
}
