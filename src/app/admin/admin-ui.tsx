import Link from "next/link";

// Small pieces of the admin prototype's look (#313): the breadcrumb above a title, the coloured
// state pill and the grey id chip.

export type Crumb = { label: string; href?: string };

/** "Content", or "Companions › J. Robert Oppenheimer": the last item is the page itself. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="admin-crumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">›</span> : null}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * #435: the prototype's header row (.head), under the breadcrumb: the title and lede on the left
 * and the page's actions (for example Save draft and Publish) right-aligned beside them.
 */
export function PageHead({
  title,
  lede,
  actions,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="admin-head">
      <div>
        <h1>{title}</h1>
        {lede ? <p className="admin-lede">{lede}</p> : null}
      </div>
      {actions ? <div className="admin-actions">{actions}</div> : null}
    </div>
  );
}

export type PillState = "published" | "draft" | "earlier" | "failed" | "passed" | "default";

/** A state in words with the prototype's colour and dot; the word carries the meaning. */
export function StatePill({ state, children }: { state: PillState; children: React.ReactNode }) {
  return <span className={`admin-pill admin-pill-${state}`}>{children}</span>;
}

/** An id in the prototype's grey mono chip, for example `chr.opp.who` or `v2`. */
export function KeyChip({ children }: { children: React.ReactNode }) {
  return <span className="admin-chip">{children}</span>;
}
