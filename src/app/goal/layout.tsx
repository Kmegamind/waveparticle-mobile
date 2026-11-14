import type { ReactNode } from "react";
import { TryFrame } from "../try/try-frame";

// The signed-in goal dialogue (#32). Start opens the signed-in /focus (#257). It exists in every
// environment for signed-in users (#278).
export default function GoalLayout({ children }: { children: ReactNode }) {
  return <TryFrame>{children}</TryFrame>;
}
