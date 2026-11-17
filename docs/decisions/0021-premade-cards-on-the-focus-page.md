# 0021: The focus page shows the published pre-made cards, spread across the Steps
- Status: accepted (Yue, build instruction of 2026-11-16)
- Date: 2026-11-16
- Issue: #300

## Context
SHARED-STORY and CARDS-PER-PART (2026-11-14) make story cards content written ahead per story
part; #293 stored the 26 Oppenheimer stories' cards in `public.story_cards`. CARDS-SPREAD and
FAIL-PREMADE (2026-11-17, recorded by #298) say how the app spreads them across the user's Steps
and what happens when they cannot be read. Until now the signed-in focus page asked the model for
every Step's cards.

## Decision
- **Read.** `get_story_cards(reader_key, story, versions)` (`security definer`, the same
  `CONTENT_READ_KEY` and `private.content_reader` as #284) returns a story's published cards, or
  exactly the versions a session recorded. The card tables stay closed to the browser.
- **Pinning.** `sessions.card_versions` (card key → version) is written the first time a session
  reads its cards (only while it is empty); every later read asks for those versions, so an edit
  published during a session does not change it.
- **Spreading.** `spreadCards` in `src/lib/story/start.ts`: all cards in story order, none dropped
  (T7's 1 to 5 limit applies to live cards only); with no more Steps than parts, whole parts stay
  together; with more Steps than parts, a part is split across neighbouring Steps; the background
  card opens Step 1; every other Step opens with the story's next card; cards arrive evenly
  through the Step as before.
- **More Steps than cards** (a Plan may have up to 50 Steps; a story has 8 to 12 part cards): one
  card per Step in order, then the later Steps stay on the last card. Flagged for Yue.
- **Failure.** A failed read or a story with no published cards shows the existing failure screen
  with Retry, and the clock does not start (FAIL-PREMADE).
- **Still live:** the pause message and stuck situation, the rest conversation, the return pop-up,
  the goal split and the closing line. The `step_cards` prompt stays in `public.prompts`.
- Shown cards are recorded in `session_lines` with source `authored`.
- `/try` keeps its live cards and test data.

## Consequences
- The signed-in focus page no longer needs the model for cards and never waits for generation.
- A second device rebuilds a session from the cards already shown; the current Step then asks for
  its pinned cards again, so its unshown cards still arrive.
- A pinned read returns only versions that were published at some point, because a session's owner
  can write its `card_versions`.
- A session opened before this change keeps the live cards it already has; its later Steps get the
  pre-made cards (only while such sessions are still open).
