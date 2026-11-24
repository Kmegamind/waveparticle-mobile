/**
 * The hand layer (DESIGN.md section 7, #83): a hand-written label and a hand-drawn mark. Both are
 * decorative. With Plain text on (the `plain-text` class on <html>), the label uses the body face
 * and the mark is drawn as a straight line in the same box, so the layout does not move.
 *
 * No screen uses the hand layer yet (DESIGN.md 3.6: Shantell Sans is not loaded). These are the
 * pieces a screen uses when it does, so Plain text already covers it.
 */

/** A short hand-written label. Hidden from screen readers when it repeats visible text. */
export function HandLabel({
  children,
  repeatsVisibleText = false,
}: {
  children: React.ReactNode;
  repeatsVisibleText?: boolean;
}) {
  return (
    <span aria-hidden={repeatsVisibleText ? true : undefined} className="hand">
      {children}
    </span>
  );
}

/** A hand-drawn underline: one wavy stroke, or a straight one under Plain text. */
export function HandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `mark-svg ${className}` : "mark-svg"}
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 8"
    >
      <path className="mark-hand" d="M2 5 C 18 2, 34 7, 52 4 S 84 3, 98 5" />
      <path className="mark-straight" d="M2 4 H 98" />
    </svg>
  );
}
