import type { ReactNode } from "react";
import { TryFrame } from "./try-frame";

// Reachable only when PROTOTYPE_ENABLED is 1: src/proxy.ts answers 404 otherwise (#208).
export default function TryLayout({ children }: { children: ReactNode }) {
  return (
    <TryFrame>
      <header className="try-header">
        <span className="try-badge">Test build</span>
      </header>
      {children}
    </TryFrame>
  );
}
