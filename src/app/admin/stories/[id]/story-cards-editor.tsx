"use client";

import { useState } from "react";
import type { ContentRole } from "@/lib/admin/roles";
import type { StoryCardView, StoryDetail } from "@/lib/story-cards/admin";
import { cardLabel } from "@/app/_session/card-label";
import { StoryCardSlip } from "@/app/_session/story-card-slip";
import { KeyChip } from "@/app/admin/admin-ui";
import { CardEditor } from "./card-editor";
import { PartTitleEditor } from "./part-title-editor";

/** Where a card sits, in words: "Background card" or "Part 2, card 1". */
function placeOf(card: StoryCardView): string {
  return card.kind === "background"
    ? "Background card"
    : `Part ${card.part}, card ${card.position}`;
}

/**
 * ADM-06 Story cards (#444): the prototype's cards editor. On the left one panel for the background
 * card and one per part, each card a row; on the right a phone preview that draws the chosen card
 * with the app's own card (the focus page's slip), read only.
 */
export function StoryCardsEditor({ detail, role }: { detail: StoryDetail; role: ContentRole }) {
  const all = [
    ...(detail.background ? [detail.background] : []),
    ...detail.parts.flatMap((part) => part.cards),
  ];
  const [previewKey, setPreviewKey] = useState<string | null>(all[0]?.key ?? null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const shown = all.find((card) => card.key === previewKey) ?? null;
  const preview = (card: StoryCardView) => setPreviewKey(card.key);

  return (
    <div className="admin-cards-editor">
      <section aria-label="Cards">
        <section aria-labelledby="background-heading" className="admin-cards-part">
          <header>
            <div>
              <h2 id="background-heading">Background card</h2>{" "}
              {detail.background ? <KeyChip>{detail.background.key}</KeyChip> : null}
            </div>
          </header>
          {detail.background ? (
            <CardEditor
              card={detail.background}
              onPreview={preview}
              previewed={previewKey === detail.background.key}
              role={role}
            />
          ) : (
            <p className="admin-cards-rename admin-cards-note">No background card yet.</p>
          )}
        </section>
        {detail.parts.map((part) => (
          <section
            aria-labelledby={`part-${part.part}`}
            className="admin-cards-part"
            key={part.part}
          >
            <header>
              <div>
                <h2 id={`part-${part.part}`}>
                  Part {part.part}
                  {part.title ? ` · ${part.title}` : ""}
                </h2>{" "}
                <KeyChip>{`crd.${detail.key}.p${part.part}`}</KeyChip>
              </div>
              {part.title !== null ? (
                <div className="admin-cards-buttons">
                  <button
                    aria-controls={`rename-${part.part}`}
                    aria-expanded={renaming === part.part}
                    className="button-gray button-small"
                    onClick={() => setRenaming(renaming === part.part ? null : part.part)}
                    type="button"
                  >
                    Rename part
                  </button>
                </div>
              ) : null}
            </header>
            {part.title !== null && renaming === part.part ? (
              <div className="admin-cards-rename" id={`rename-${part.part}`}>
                <PartTitleEditor part={part.part} storyId={detail.id} title={part.title} />
              </div>
            ) : null}
            {part.cards.map((card) => (
              <CardEditor
                card={card}
                key={card.key}
                onPreview={preview}
                previewed={previewKey === card.key}
                role={role}
              />
            ))}
          </section>
        ))}
        {detail.parts.length === 0 ? (
          <p className="admin-cards-note">This story has no part cards yet.</p>
        ) : null}
      </section>
      <aside aria-label="Preview">
        <div className="admin-phone">
          <div className="admin-phone-top">
            <span>
              {shown ? `${placeOf(shown)}${shown.published ? "" : " · not published"}` : "No card"}
            </span>
            <span>Preview</span>
          </div>
          {shown ? (
            <div className="focus-stack">
              <StoryCardSlip
                // The background card opens Step 1 ("Where I am"); any other card is shown as the
                // newest card of its Step ("Right now").
                label={shown.kind === "background" ? cardLabel(0, 0, 1) : cardLabel(1, 0, 1)}
                text={shown.body}
              />
            </div>
          ) : null}
        </div>
        <p className="admin-phone-note">
          Click a card&apos;s text to see it here as phones draw his card. Phones show the published
          version.
        </p>
      </aside>
    </div>
  );
}
