import {
  AI_FEATURE_STATUS_LABEL,
  type AiFeatureItem,
  type AiFeatureStatus,
} from "@/lib/ai-features/admin";
import { KeyChip } from "../admin-ui";

// #439: the small pieces of the AI feature pages (docs/design/prototype/admin-ai-features.html).

/** A feature's status (AI-PAGE-STATUS) as a pill in the drawing's colour; the word carries it. */
export function FeatureStatusPill({ status }: { status: AiFeatureStatus }) {
  return (
    <span className={`admin-pill admin-pill-ai-${status}`}>{AI_FEATURE_STATUS_LABEL[status]}</span>
  );
}

/** The mark of a draft item and of a fake-model run. */
export function MarkPill({ children }: { children: React.ReactNode }) {
  return <span className="admin-pill admin-pill-mark">{children}</span>;
}

/** "Draft - owner to edit" and "Source: <file:line>" under an item; nothing for owner text. */
export function ItemSource({ item }: { item: AiFeatureItem }) {
  if (!item.draft && !item.source) return null;
  return (
    <p className="admin-src">
      {item.draft ? <MarkPill>Draft - owner to edit</MarkPill> : null}
      {item.draft && item.source ? " " : null}
      {item.source ? (
        <>
          Source: <KeyChip>{item.source}</KeyChip>
        </>
      ) : null}
    </p>
  );
}

/** "Not written yet": a section with no item (no source, or every line removed by the owner). */
export function NotWrittenYet() {
  return <p className="admin-empty">Not written yet</p>;
}
