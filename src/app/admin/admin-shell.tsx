"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "../auth/auth-form";

// The admin shell of the content-admin prototype (#287): the product name and "Content admin", the
// menu in groups with each page's id (decision NAMING), and Sign out. Later issues add pages here.
const GROUPS = [
  {
    heading: "Content",
    pages: [
      { href: "/admin/companions", id: "ADM-03", label: "Companions" },
      { href: "/admin/stories", id: "ADM-06", label: "Stories" },
      { href: "/admin/app-text", id: "ADM-07", label: "App text" },
    ],
  },
  {
    heading: "Review and logs",
    pages: [{ href: "/admin/publish-history", id: "ADM-12", label: "Publish history" }],
  },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="admin-shell">
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
                      aria-current={pathname === page.href ? "page" : undefined}
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
