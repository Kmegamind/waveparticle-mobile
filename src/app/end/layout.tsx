import type { ReactNode } from "react";
import { TryFrame } from "../try/try-frame";

// The signed-in summary (#258): a session page in the Oppenheimer skin, no tab bar. Reachable only
// when PROTOTYPE_ENABLED is 1 (src/proxy.ts), because the run it sums up is the test focus page's.
export default function EndLayout({ children }: { children: ReactNode }) {
  return <TryFrame>{children}</TryFrame>;
}
