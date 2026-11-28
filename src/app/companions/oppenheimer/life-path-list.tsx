import Link from "next/link";
import type { LifePathRow, LifePathView } from "@/lib/summary/life-path";

/**
 * The rows of the Life Path (CPAGE, #96, #97, prototype v4). State is carried by the node's shape
 * and by a name for screen readers, never by colour alone: finished (filled dot), his memory (open
 * ring, italic), current (heavy ring and the card) and later (dotted circle, title only, not
 * focusable, read as "Later, not available"). A finished row's title and its › arrow open its Story record (#94).
 * No dates or ages (PERIODS).
 */
export function LifePathList({
  view,
  beginHref = "/goal",
}: {
  view: LifePathView;
  /** #521: the goal dialogue for this Companion (`goalHrefFor`); plain /goal for the default one. */
  beginHref?: string;
}) {
  return (
    <ol className="life-periods">
      {view.periods.map((period) => (
        <li key={period.name}>
          <h2 className="life-period">{period.name}</h2>
          <ol className="life-rows">
            {period.rows.map((row) => (
              <Row beginHref={beginHref} key={row.id} row={row} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

const NAMES: Record<Exclude<LifePathRow["state"], "later">, string> = {
  finished: "Finished: ",
  memory: "His memory: ",
  current: "Current story: ",
};

/** #521: a story line that is not published yet; nothing is invented in its place. */
export const NOT_WRITTEN_YET = "Not written yet";

function Row({ row, beginHref }: { row: LifePathRow; beginHref: string }) {
  const node = <span aria-hidden="true" className={`life-node life-node-${row.state}`} />;

  if (row.state === "later") {
    // Chapters are played in order (D4): visible, not tappable or focusable, title not read.
    return (
      <li className="life-row" data-id={row.id} data-state="later">
        {node}
        <div>
          <span className="sr-only">Later, not available</span>
          <h3 aria-hidden="true" className="life-title">
            {row.title}
          </h3>
        </div>
      </li>
    );
  }

  if (row.state === "current") {
    return (
      <li className="life-row" data-id={row.id} data-state="current">
        {node}
        <div className="life-current" id="current-story">
          <h3 className="life-title">
            <span className="sr-only">{NAMES.current}</span>
            {row.title}
          </h3>
          <p className="life-line">{row.line || NOT_WRITTEN_YET}</p>
          {/* The signed-in run plays this story: a new session takes the current story (#258). */}
          <Link className="button-filled" href={beginHref}>
            Begin
          </Link>
        </div>
      </li>
    );
  }

  const title = (
    <>
      <span className="sr-only">{NAMES[row.state]}</span>
      {row.title}
    </>
  );
  return (
    <li className="life-row" data-id={row.id} data-state={row.state}>
      {node}
      <div>
        <h3 className="life-title">
          {/* #94: a finished row opens the record of that Story as played; his memory has none. */}
          {row.recordHref ? (
            <Link className="life-record-link" href={row.recordHref}>
              {title}
              <span aria-hidden="true" className="life-arrow">
                ›
              </span>
            </Link>
          ) : (
            title
          )}
        </h3>
        {row.line ? (
          <p className={row.state === "memory" ? "life-line life-memory" : "life-line life-said"}>
            {row.line}
          </p>
        ) : null}
      </div>
    </li>
  );
}
