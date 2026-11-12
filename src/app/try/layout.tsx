import type { ReactNode } from "react";

// Reachable only when PROTOTYPE_ENABLED is 1: src/proxy.ts answers 404 otherwise (#208).
export default function TryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="try-shell">
      <header className="try-header">
        <span className="try-badge">Test build</span>
      </header>
      {children}
    </div>
  );
}
