"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/** A date in the reader's own time zone; empty in the server HTML so nothing mismatches. */
export function LocalDate({ iso }: { iso: string }) {
  const ready = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!ready) return null;
  return <>{new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>;
}
