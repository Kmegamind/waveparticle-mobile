# 0023: Story cards are edited as drafts in the admin, and only the admin role publishes them
- Status: accepted (Yue approved the design on 2026-11-17)
- Date: 2026-11-17
- Issue: #304

## Context
ADMIN (2026-11-14) puts every content change through a draft and a Publish. #293 stored the
story cards and part titles, read-only. #300 made phones read the published cards and pin a
session to the versions it first read. The cards must pass LEN-CARD, DATES-ADMIN-ONLY and
LEAK-BY-PART before phones see them.

## Decision
- **Drafts.** `save_story_card_draft` adds a new version with no `published_at`. The published
  version is untouched, and `get_story_cards` (#300) is not changed: it never returns a version
  that was never published, so neither phones nor pinned sessions read a draft.
- **Part titles** are saved directly (`save_story_part_title`), with no versions, because no phone
  shows them.
- **Checks** (`src/lib/story-cards/checks.ts`) run on every save, on every shown version, and
  again on the server just before Publish:
  - length (LEN-CARD);
  - a year, a date or an age (DATES-ADMIN-ONLY);
  - banned words (the `BANNED` pattern of the model gateway);
  - spoiler words (LEAK-BY-PART), described below.
- **Spoiler words.** For a card in part p, the spoiler words are the `leaks` of every story-input
  slice whose cards sit in a later part. The background card is checked against every part.
  - **Why not the story's `scene.laterWords`:** that list has no part. Checked against all 277
    published cards on 2026-11-17, it flags 12 of them, mostly last-part cards where the word
    belongs. The per-part words flag none.
  - **Without the story inputs** the check cannot run, and Publish stays off.
- **Publish and roll back:** the admin role only, checked by the button, the server action and
  the database (`content_role() = 'admin'`). A writer edits and asks an admin.
  - Both go through `private.set_published_story_card`, which writes a `publish_history` row of
    kind `story_card` in the same transaction.
  - Roll back is not blocked by the checks, because it restores a version that was live before.
    Since #377 the admin sees the version's problems and confirms first (a warning, not a block;
    `docs/decisions/0028`, ROLLBACK-WARN).
- **Existing cards.** Two published cards of "The Cross-Examination" mention 1939 and 1943. They
  stay live and show as failing in the editor.

## Consequences
- **The database checks only the role.** An admin who calls `publish_story_card` directly through
  the API skips the text checks.
- **Not possible yet:** adding, deleting or reordering cards or parts; regenerating cards.
