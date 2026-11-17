// Every card on ADM-06 came from the prototype of 2026-11-12 and was loaded as version 1,
// published, without a person reading it (#293). The page says so until review exists (Phase 4).
const NOTICE =
  "Every card here started as one of the AI-written drafts that no person has read yet. Version 1 of each is published, and phones show the published version. Editing a card makes a new draft; an admin publishes it.";

export function UnreviewedNotice() {
  return (
    <p className="admin-notice" role="note">
      <strong>Unreviewed drafts.</strong> {NOTICE}
    </p>
  );
}
