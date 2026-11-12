"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  emptyPrototypeState,
  loadPrototypeState,
  resetPrototypeState,
  savePrototypeState,
  type PrototypeState,
} from "@/lib/prototype/store";

const noSubscription = () => () => {};

/** Browser-only prototype state. `ready` is false in the server HTML and true once hydrated. */
export function usePrototypeState() {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [override, setOverride] = useState<PrototypeState | null>(null);
  const state =
    override ?? (ready ? loadPrototypeState(window.localStorage) : emptyPrototypeState());

  const update = useCallback((next: PrototypeState) => {
    savePrototypeState(window.localStorage, next);
    setOverride(next);
  }, []);

  const reset = useCallback(() => {
    resetPrototypeState(window.localStorage);
    setOverride(emptyPrototypeState());
  }, []);

  return { ready, state, update, reset };
}
