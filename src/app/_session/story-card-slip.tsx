import type { ReactNode } from "react";
import type { CardLabel } from "./card-label";

/**
 * His story card as the focus page draws it (prototype v4 .cslip, #238): the tape, the label and
 * the card text. The focus page adds the position, the dots and the pager; the Story cards admin
 * page (#444) shows the same card, read only, as its phone preview.
 */
export function StoryCardSlip({
  label,
  text,
  stacked = false,
  current = false,
  position,
  children,
}: {
  label: CardLabel;
  text: string;
  /** More than one card in the Step: the slip shows the edges of the cards under it. */
  stacked?: boolean;
  /** The newest card of the Step is shown. */
  current?: boolean;
  /** Read after the label, before the text (the position in words). */
  position?: ReactNode;
  /** After the text (the dots and the pager). */
  children?: ReactNode;
}) {
  return (
    <figure
      aria-current={current ? "true" : undefined}
      className={stacked ? "focus-slip focus-slip-stacked" : "focus-slip"}
      data-testid="story-card"
    >
      <span aria-hidden="true" className="focus-tape" />
      <span className="focus-card-label">{label}</span>
      {position}
      <div className="focus-card-text">
        <p>{text}</p>
      </div>
      {children}
    </figure>
  );
}
