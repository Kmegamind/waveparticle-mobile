import { crisisPlaceholder } from "@/lib/safety/crisis";

export function CrisisPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="crisis-page">
      <h1>This is outside the story.</h1>
      <p data-placeholder="legal-body">{crisisPlaceholder.legalBody}</p>
      <div className="crisis-actions">
        <a className="button-filled" href="#region-resource">
          Get support now
        </a>
        <button className="button-tinted" onClick={onBack} type="button">
          Back to my Step
        </button>
      </div>
      <p data-placeholder="region-resource" id="region-resource">
        {crisisPlaceholder.regionResource}
      </p>
    </main>
  );
}
