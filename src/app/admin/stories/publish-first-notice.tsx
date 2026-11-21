// PUBLISH-FIRST (2026-11-21): there is no human review gate. Every card on ADM-06 is published
// first and read by a person afterwards; the automatic card checks run before it is published.
// The first versions came from the AI-written prototype deck of 2026-11-12 (#293).
const NOTICE =
  "Cards are published first and read afterwards. Every card here passed the automatic checks before it was published, and phones show the published version. A person reads it later and can edit it: editing a card makes a new draft, and an admin publishes it once it passes every check. Version 1 of each card was written by AI and has not been read by a person yet.";

export function PublishFirstNotice() {
  return (
    <p className="admin-notice" role="note">
      <strong>Published first, read afterwards.</strong> {NOTICE}
    </p>
  );
}
