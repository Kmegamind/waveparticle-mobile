import type { ReactNode } from "react";
import { TryFrame } from "../try/try-frame";

// The signed-in goal dialogue (#32). Start opens the signed-in /focus (#257). Reachable only when
// PROTOTYPE_ENABLED is 1 (src/proxy.ts) until the per-account daily cap on model calls (#256).
export default function GoalLayout({ children }: { children: ReactNode }) {
  return <TryFrame>{children}</TryFrame>;
}
