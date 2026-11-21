// PUBLISH-FIRST (2026-11-21): there is no human review gate. Every card on ADM-06 is published
// first and read by a person afterwards. A new version is published only when it passes the
// automatic card checks; version 1 came from the AI-written prototype deck of 2026-11-12 and was
// loaded as published without them (#293), so a failing card is marked on the page.
const NOTICE =
  "Cards are published first and read afterwards, and phones show the published version. A card that fails an automatic check is marked on this page. Editing a card makes a new draft, and an admin can publish it only once it passes every check. Version 1 of each card was written by AI, loaded without the checks, and has not been read by a person yet.";

export function PublishFirstNotice() {
  return (
    <p className="admin-notice" role="note">
      <strong>Published first, read afterwards.</strong> {NOTICE}
    </p>
  );
}
