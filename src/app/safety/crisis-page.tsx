"use client";

import { useAppText } from "@/lib/app-text/provider";
import { crisisPlaceholder } from "@/lib/safety/crisis";

// S1 of prototype v4 (#262, #233): one white card in the middle of the screen. The wording stays
// subject to the legal and clinical review (US-SAF-8, #121); both placeholders sit in one box.
export function CrisisPage({ onBack }: { onBack: () => void }) {
  // The title and the two buttons are app text (#288); the body waits for the legal review.
  const title = useAppText("ui.S1.title");
  const support = useAppText("ui.S1.support");
  const back = useAppText("ui.S1.back");
  return (
    <main className="crisis-page">
      <div className="crisis-card">
        <h1>{title}</h1>
        <p className="crisis-lead">
          If you are thinking about hurting yourself or someone else, please reach out to people who
          can help right now.
        </p>
        <div className="crisis-placeholder" id="region-resource">
          <p data-placeholder="legal-body">{crisisPlaceholder.legalBody}</p>
          <p data-placeholder="region-resource">{crisisPlaceholder.regionResource}</p>
        </div>
        <div className="crisis-actions">
          <a className="button-filled" href="#region-resource">
            {support}
          </a>
          <button className="button-tinted" onClick={onBack} type="button">
            {back}
          </button>
        </div>
      </div>
    </main>
  );
}
