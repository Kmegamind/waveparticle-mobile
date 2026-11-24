"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HelpLineClear, HelpLineSync } from "./help-line-sync";
import { showsHeader, showsTabBar } from "./shell-rules";

// Order and icons from prototype version 4 (#240 C8; docs/FLOW.md 3.2 gives the same order).
const tabs = [
  { href: "/", label: "Home", icon: <path d="M4 11l8-7 8 7v9H4z" /> },
  { href: "/goals", label: "Goals", icon: <path d="M5 6h14M5 12h14M5 18h9" /> },
  {
    href: "/companions",
    label: "Companions",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c.8-3.6 3.2-5.4 6-5.4s5.2 1.8 6 5.4" />
        <path d="M16 5.4a3.2 3.2 0 010 5.8M18 14.8c1.8.8 2.8 2.4 3.2 5.2" />
      </>
    ),
  },
  {
    href: "/me",
    label: "Me",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" />
      </>
    ),
  },
] as const;

const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const isCurrent = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The sign-in-free test path (#208) has its own header and no account tab bar.
  if (pathname === "/try" || pathname.startsWith("/try/")) return <>{children}</>;

  return (
    <div className="app-shell">
      {/* #118: keeps the account's help line on the phone, so S1 works offline. */}
      {within(pathname, "/auth") ? <HelpLineClear /> : <HelpLineSync />}
      {showsHeader(pathname) ? (
        <header className="app-header">
          <Link aria-label="WaveParticle" href="/">
            <Image className="logo" src="/logo.svg" alt="" width={54} height={20} />
          </Link>
          <span className="app-logo" aria-hidden="true">
            WaveParticle
          </span>
        </header>
      ) : null}
      <div className="app-content">{children}</div>
      {showsTabBar(pathname) ? (
        <nav aria-label="Primary" className="app-tab-bar">
          {tabs.map((tab) => (
            <Link
              aria-current={isCurrent(pathname, tab.href) ? "page" : undefined}
              className="app-tab"
              href={tab.href}
              key={tab.href}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
