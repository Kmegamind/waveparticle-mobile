import type { ReactNode } from "react";
import { TryFrame } from "../try/try-frame";

// The signed-in goal dialogue (#32). Reachable only when PROTOTYPE_ENABLED is 1 (src/proxy.ts),
// because Start still opens the test path's focus page until US-FOC-1 (#18).
export default function GoalLayout({ children }: { children: ReactNode }) {
  return <TryFrame>{children}</TryFrame>;
}
