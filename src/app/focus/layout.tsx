import type { ReactNode } from "react";
import { TryFrame } from "../try/try-frame";

// The signed-in focus page (#257) is a session page: it uses the Oppenheimer skin.
export default function FocusLayout({ children }: { children: ReactNode }) {
  return <TryFrame>{children}</TryFrame>;
}
