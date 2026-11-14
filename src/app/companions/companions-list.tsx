"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { COMPANIONS, companionById, type CompanionId } from "@/content/companions";

/** Where Enter goes for the selected Companion; null keeps it disabled (#268 AC7, #93). */
export function enterFor(id: CompanionId | null): string | null {
  return id ? companionById(id).enterHref : null;
}

/** The visible reason when a selected Companion cannot be entered (DESIGN 6.1). */
export function reasonFor(id: CompanionId | null): string | null {
  return id && enterFor(id) === null ? "His stories are not ready yet." : null;
}

/**
 * COMP: select a Companion, then one Enter. A radio group, so arrow keys move the selection and
 * the state is announced. No "last observed" line, no long profile, no moving effects.
 */
export function CompanionsList() {
  const router = useRouter();
  const [selected, setSelected] = useState<CompanionId | null>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const href = enterFor(selected);
  const reason = reasonFor(selected);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : 0;
    const back = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!step && !back) return;
    event.preventDefault();
    const next = (index + step + back + COMPANIONS.length) % COMPANIONS.length;
    setSelected(COMPANIONS[next].id);
    rows.current[next]?.focus();
  }

  return (
    <>
      <div aria-label="Companions" className="comp-list" role="radiogroup">
        {COMPANIONS.map((companion, index) => {
          const isSelected = selected === companion.id;
          return (
            <button
              aria-checked={isSelected}
              className="comp-row"
              key={companion.id}
              onClick={() => setSelected(companion.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              ref={(element) => {
                rows.current[index] = element;
              }}
              role="radio"
              tabIndex={isSelected || (selected === null && index === 0) ? 0 : -1}
              type="button"
            >
              <Image
                alt={companion.shortName}
                className="comp-portrait"
                height={64}
                src={companion.portrait}
                width={64}
              />
              <span className="comp-text">
                <span className="comp-name">{companion.name}</span>
                <span className="comp-tags">{companion.tags}</span>
                <span className="comp-line">{`“${companion.line}”`}</span>
              </span>
              {isSelected ? (
                <span aria-hidden="true" className="comp-check">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="comp-enter">
        {/* Announced when Moriarty is chosen, and the reason Enter is disabled. */}
        <p aria-live="polite" className="comp-reason" id="comp-reason">
          {reason}
        </p>
        <button
          aria-describedby={reason ? "comp-reason" : undefined}
          className="button-filled"
          disabled={href === null}
          onClick={() => {
            if (href) router.push(href);
          }}
          type="button"
        >
          Enter
        </button>
      </div>
    </>
  );
}
