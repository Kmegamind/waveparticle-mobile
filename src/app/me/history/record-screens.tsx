import Link from "next/link";
import type { SessionRecordView, StoryRecordView } from "@/lib/me/records";
import { LocalDate } from "./local-date";

/**
 * ME-REC (#75): date, minutes (the Plan minutes of the done Steps), the Goal and the Steps marked
 * done. Never a count, pauses, a completion word or his closing line. "His chapter ›" opens the
 * record of the finished Story (#94) when there is one.
 */
export function SessionRecordScreen({ record }: { record: SessionRecordView }) {
  return (
    <>
      <Link aria-label="Back to History" className="life-back" href="/me">
        <span aria-hidden="true">‹</span>
        <span className="focus-label">History</span>
      </Link>
      <h1>{record.goalTitle}</h1>
      <p className="me-quiet rec-meta">
        <LocalDate iso={record.firstDoneAt} />
        {` · ${record.minutes} min`}
      </p>
      <section aria-labelledby="rec-done" className="rec-section">
        <h2 className="focus-label" id="rec-done">
          Steps you marked done
        </h2>
        <ul className="rec-steps">
          {record.doneSteps.map((title, index) => (
            <li key={`${index}-${title}`}>
              <span aria-hidden="true">✓</span>
              {title}
            </li>
          ))}
        </ul>
      </section>
      {record.storyRecordHref ? (
        <Link className="home-link rec-chapter" href={record.storyRecordHref}>
          His chapter ›
        </Link>
      ) : null}
    </>
  );
}

/** The record of a finished Story (#94): his cards as shown, the closing line, the key moments. */
export function StoryRecordScreen({
  record,
  backHref,
}: {
  record: StoryRecordView;
  backHref: string;
}) {
  return (
    <>
      <Link aria-label="Back to the session record" className="life-back" href={backHref}>
        <span aria-hidden="true">‹</span>
        <span className="focus-label">Session record</span>
      </Link>
      <h1>{record.storyTitle}</h1>
      {record.steps.map((step, index) =>
        step.cards.length > 0 ? (
          <section className="rec-section" key={`${index}-${step.title}`}>
            <h2 className="focus-label">{step.title}</h2>
            {step.cards.map((card, position) => (
              <figure className="focus-slip home-slip" key={`${position}-${card.slice(0, 12)}`}>
                <span aria-hidden="true" className="focus-tape" />
                <p>{card}</p>
              </figure>
            ))}
          </section>
        ) : null,
      )}
      {record.closingLine ? (
        <section className="rec-section" aria-label="How his day ended">
          <figure className="focus-slip home-slip">
            <span aria-hidden="true" className="focus-tape" />
            <p>{record.closingLine}</p>
          </figure>
        </section>
      ) : null}
      {record.keyMoments.length > 0 ? (
        <section aria-labelledby="rec-moments" className="rec-section">
          <h2 className="focus-label" id="rec-moments">
            Key moments
          </h2>
          <ul className="rec-moments">
            {record.keyMoments.map((moment) => (
              <li key={moment}>{moment}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
