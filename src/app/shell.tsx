"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/companions", label: "Companions" },
  { href: "/goals", label: "Goals" },
  { href: "/me", label: "Me" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The sign-in-free test path (#208) has its own header and no account tab bar.
  if (pathname === "/try" || pathname.startsWith("/try/")) return <>{children}</>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link aria-label="WaveParticle" href="/">
          <Image className="logo" src="/logo.svg" alt="" width={54} height={20} />
        </Link>
        <span className="app-logo" aria-hidden="true">
          WaveParticle
        </span>
      </header>
      <div className="app-content">{children}</div>
      <nav aria-label="Primary" className="app-tab-bar">
        {tabs.map((tab) => (
          <Link
            aria-current={pathname === tab.href ? "page" : undefined}
            className="app-tab"
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
