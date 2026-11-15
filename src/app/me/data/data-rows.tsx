import Link from "next/link";

/** Data (#103, prototype v4 ME "Data"): the privacy notice, Export my data and Delete my data. */
const ROWS = [
  { href: "/privacy?from=me", label: "Privacy notice" },
  { href: "/me/export", label: "Export my data" },
  { href: "/me/delete-account", label: "Delete my data" },
] as const;

export function DataRows() {
  return (
    <nav aria-label="Data">
      {ROWS.map((row) => (
        <Link className="me-row me-row-button" href={row.href} key={row.href}>
          {row.label}
          <span aria-hidden="true" className="me-caret">
            ›
          </span>
        </Link>
      ))}
    </nav>
  );
}
