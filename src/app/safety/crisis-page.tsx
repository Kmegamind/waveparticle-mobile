import { crisisPlaceholder } from "@/lib/safety/crisis";

// S1 of prototype v4 (#262, #233): one white card in the middle of the screen. The wording stays
// subject to the legal and clinical review (US-SAF-8, #121); both placeholders sit in one box.
export function CrisisPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="crisis-page">
      <div className="crisis-card">
        <h1>This is outside the story.</h1>
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
            Get support now
          </a>
          <button className="button-tinted" onClick={onBack} type="button">
            Back to my Goal
          </button>
        </div>
      </div>
    </main>
  );
}
