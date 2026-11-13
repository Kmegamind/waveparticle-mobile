"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isSessionPath } from "./session-paths";

// The test path frame. Session pages get the Oppenheimer skin (#240 C5); the start page stays in
// the Shell.
export function TryFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={isSessionPath(pathname) ? "try-shell skin-opp" : "try-shell"}>{children}</div>
  );
}
