// Every card on ADM-06 came from the prototype of 2026-11-12 and was loaded as version 1,
// published, without a person reading it (#293). The page says so until review exists (Phase 4).
const NOTICE =
  "Every card here is one of the AI-written drafts that no person has read yet. They are stored as version 1, published, so that they can be read in one place; the phone does not show them yet. Editing and publishing come later.";

export function UnreviewedNotice() {
  return (
    <p className="admin-notice" role="note">
      <strong>Unreviewed drafts.</strong> {NOTICE}
    </p>
  );
}
