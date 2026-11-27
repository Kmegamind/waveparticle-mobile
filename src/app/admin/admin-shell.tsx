"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "../auth/auth-form";
import { menuCurrent } from "./menu-current";

// The admin shell of the content-admin prototype (#287): the product name and "Content admin", the
// menu in groups with each page's id (decision NAMING), and Sign out. Later issues add pages here.
const GROUPS = [
  {
    heading: "Overview",
    pages: [{ href: "/admin", id: "ADM-01", label: "Status board" }],
  },
  {
    heading: "Content",
    pages: [
      { href: "/admin/companions", id: "ADM-03", label: "Companions" },
      { href: "/admin/stories", id: "ADM-06", label: "Stories" },
      { href: "/admin/app-text", id: "ADM-07", label: "App text" },
      { href: "/admin/hotlines", id: "ADM-14", label: "Hotlines" },
    ],
  },
  {
    heading: "AI rules",
    pages: [
      // #439: one page per AI feature (AI-PAGES-7), above Prompts as in the drawing.
      { href: "/admin/ai-features", id: "ADM-16", label: "AI features" },
      // #479: the sample library (drawing AIR-6). Owner decided (2026-11-27): AIR-6 stays its
      // menu id.
      { href: "/admin/ai-samples", id: "AIR-6", label: "Samples" },
      // #478: the comparison lab (drawing AIR-4); its menu id is the drawing's, as AIR-5 and AIR-6.
      { href: "/admin/ai-lab", id: "AIR-4", label: "Comparison lab" },
      // #477: the run log (drawing AIR-5).
      { href: "/admin/ai-runs", id: "AIR-5", label: "Runs" },
      { href: "/admin/prompts", id: "ADM-08", label: "Prompts" },
    ],
  },
  {
    heading: "Review and logs",
    pages: [{ href: "/admin/publish-history", id: "ADM-12", label: "Publish history" }],
  },
] as const;

export function AdminShell({
  children,
  fontClassName,
}: {
  children: ReactNode;
  /** The next/font classes that set --font-adm-* (src/app/admin/fonts.ts). */
  fontClassName: string;
}) {
  const pathname = usePathname();
  return (
    <div className={`admin-shell ${fontClassName}`}>
      <aside className="admin-rail">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-name">WaveParticle</span>
          <span className="admin-brand-sub">Content admin</span>
        </Link>
        <nav aria-label="Admin pages" className="admin-menu">
          {GROUPS.map((group) => (
            <section className="admin-group" key={group.heading}>
              <h2 className="admin-group-heading">{group.heading}</h2>
              <ul>
                {group.pages.map((page) => (
                  <li key={page.href}>
                    <Link
                      aria-current={menuCurrent(pathname, page.href)}
                      className="admin-menu-link"
                      href={page.href}
                    >
                      {page.label}
                      <span className="admin-page-id">{page.id}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <SignOutButton className="button-plain button-small admin-sign-out" />
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
