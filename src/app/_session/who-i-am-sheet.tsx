"use client";

import { useEffect, useRef, type MouseEvent, type RefObject } from "react";

/**
 * F1-C, the "Who I am" sheet opened from his portrait on the focus page (#72, PORTRAIT-SHEET), as
 * in prototype v4: the title "Where I am now", "Who I am" in his voice and "What I have done" with
 * one line per finished Step (DONE-LINE), then Close. A native modal dialog gives the focus trap,
 * the inert page behind it and Escape (DESIGN 6.7); a tap on the shade also closes it, and focus
 * returns to the portrait. The clock keeps running behind it.
 */
export function WhoIAmSheet({
  open,
  onClose,
  who,
  lines,
  returnTo,
}: {
  open: boolean;
  onClose: () => void;
  who: string;
  lines: string[];
  /** The portrait button; Safari does not focus a button on click. */
  returnTo: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  function onDialogClose() {
    onClose();
    returnTo.current?.focus();
  }

  // A tap on the shade reaches the dialog element at a point outside its box (prototype v4).
  function onShade(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    if (!inside) event.currentTarget.close();
  }

  return (
    <dialog
      aria-labelledby="who-i-am-title"
      className="home-sheet who-sheet"
      onClick={onShade}
      onClose={onDialogClose}
      ref={dialog}
    >
      <h2 className="home-sheet-title" id="who-i-am-title">
        Where I am now
      </h2>
      <div className="who-sheet-part">
        <h3 className="focus-label">Who I am</h3>
        <p className="who-sheet-voice">{who}</p>
      </div>
      <div className="who-sheet-part">
        <h3 className="focus-label">What I have done</h3>
        {lines.length > 0 ? (
          <ul className="who-sheet-done">
            {lines.map((line, index) => (
              <li key={`${index}-${line.slice(0, 12)}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="try-caption">Nothing yet tonight.</p>
        )}
      </div>
      <button className="button-gray" onClick={() => dialog.current?.close()} type="button">
        Close
      </button>
    </dialog>
  );
}
