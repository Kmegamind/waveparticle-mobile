"use client";

import { useSyncExternalStore } from "react";

/**
 * The device's clock and time zone, after hydration: "today" and dates are the device's calendar,
 * not the server's, and the server render never guesses them (no hydration mismatch). The value is
 * read once per page load, so it is stable between renders.
 */

type LocalNow = { now: Date; timeZone: string };

let cached: LocalNow | null = null;

function snapshot(): LocalNow {
  cached ??= { now: new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  return cached;
}

const subscribe = () => () => {};

export function useLocalNow(): LocalNow | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
