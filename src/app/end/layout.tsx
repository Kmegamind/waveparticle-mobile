import type { ReactNode } from "react";
import { TryFrame } from "../try/try-frame";

// The signed-in summary (#258): a session page in the Oppenheimer skin, no tab bar. It exists in
// every environment for signed-in users (#278).
export default function EndLayout({ children }: { children: ReactNode }) {
  return <TryFrame>{children}</TryFrame>;
}
