"use client";

import { useCallback, useRef } from "react";
import { snapshotOf } from "@/lib/progress/focus-session";
import type { FocusSession } from "@/lib/prototype/session";
import { recordFocusProgress } from "./actions";

/**
 * Sends the session's progress to the account after each change (#257). Only a changed snapshot
 * is sent (the clock is not in it), and one request runs at a time so that a line is never
 * inserted twice.
 */
export function useAccountRecorder(sessionId: string) {
  const last = useRef("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback(
    (session: FocusSession) => {
      const snapshot = snapshotOf(sessionId, session);
      const key = JSON.stringify(snapshot);
      if (key === last.current) return;
      last.current = key;
      queue.current = queue.current
        .then(() => recordFocusProgress(snapshot))
        .catch(() => undefined);
    },
    [sessionId],
  );
}
