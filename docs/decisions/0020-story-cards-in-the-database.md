# 0020: Pre-written story cards in the database, read by editors only
- Status: accepted (Yue, build instruction of 2026-11-16)
- Date: 2026-11-16
- Issue: #293

## Context
SHARED-STORY and CARDS-PER-PART (2026-11-14) make the story cards content that is written ahead,
once per story part, and shared by every user. The 26 Oppenheimer stories already have cards: the
prototype deck of 2026-11-12 (`1_Projects/Newfeatures/wp-prototype_2026-11-12_story-decks.json`),
AI-written and not read by any person. The owner wants to read them all in one place before
anything is edited or regenerated. The phone keeps its current card source until a later issue
(NO-BACKUP, FAIL-SCREEN), and no service-role key is used.

## Options
| Option | For | Against |
|---|---|---|
| A. `story_parts` and versioned `story_cards` tables like `app_text`, readable through the API by content editors only; an SQL-printing import | Same version model as app text and prompts; the admin reads with the editor's own session; nothing reaches other browsers | The phone cannot read the cards yet (not needed in this issue) |
| B. Published rows readable by every signed-in account | The later phone switch needs no new reader | Card text would be in the browser before a story starts; the issue says the server reads it |
| C. Keep the cards in the repository only | Nothing to set up | No single place to read them, and Phase 4 needs versions in the database |

## Decision
Option A.

- `public.story_parts (story_id, part, title)`: each part's title.
- `public.story_cards (key, version, story_id, kind, part, slice, position, body, published,
  published_at, created_at)`: one row per card version, at most one published version per key.
  Keys follow NAMING: `crd.<story>.<part>.<slot>` and `crd.<story>.bg`, with `<story>` the
  story's `<short>.<slug>` (`opp.site-search`), `<part>` `p1` to `p5` and `<slot>` `c<n>`, the
  card's order in the part. The slice cannot be the slot, because the deck repeats a slice inside
  a part.
- Row level security on both tables; the only policy is select for `is_content_editor()`. No
  anonymous access, no write grants and no write functions.
- `node scripts/story-cards/import.mjs` prints SQL that inserts each card as version 1, published,
  only when its key has no rows, and each part title only when that part has none. Running it
  again changes nothing. The deck `story1` is skipped.
- ADM-06 Stories (`/admin/stories`, `/admin/stories/<id>`) lists the stories with their parts and
  cards and shows each card's key, slice, version and the CARD-LENGTH check. It says the cards are
  unreviewed drafts. Nothing can be edited or published there.

## Consequences
- The import loads 26 background cards, 251 part cards (the issue estimated about 262) and 104
  part titles. All of them pass CARD-LENGTH today.
- The phone screens do not read these tables; a guard test keeps it so until the issue that
  switches them.
- Editing, publishing, regenerating, the review queue, the publish history kind `story_card` and
  the closing line come later (Phase 4).
