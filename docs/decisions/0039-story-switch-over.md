# 0039: Import regenerated cards next to the published ones, and switch a story over with printed SQL
- Status: proposed
- Date: 2026-11-27
- Issue: #516

## Context
Oppenheimer's 26 stories are live with the placeholder decks of 2026-11-12 (4 parts each). The story pipeline regenerated them (3 to 5 parts per story, many more cards, `merged_titles` empty). The owner wants the new cards in the app as drafts next to the published placeholders, and then to switch over one story at a time, only when she decides to. The repository is public, so no card text may be committed. #514 (`docs/decisions/0038`) added `scripts/content/import-drafts.mjs`, which reads the owner's export folder and prints SQL, but refuses a Companion with anything published.

## Options for the import
| Option | For | Against |
|---|---|---|
| Fork #514's script | Simple | Two copies of the folder checks and SQL quoting |
| **A `--keep-published` mode of the same script** | One script, the same folder refusal, quoting and four SQL forms | The script grows |

## Options for the switch-over
| Option | For | Against |
|---|---|---|
| An admin action "Switch this story to the new cards" | One button; the admin's card checks could run first; the acting admin is recorded by `auth.uid()` | A screen change: the spec (`docs/FLOW.md`, `docs/DECISIONS.md`) and the admin prototype change first, and the spec files are owned by another pull request this round; new database functions with full rights to publish and retire; the new part titles would need a draft table before the switch |
| **Printed SQL per story (`scripts/content/switch-story.mjs`): dry run, run, check, undo** | The same pattern the owner already uses for #502 and the #514 import; no screen or spec change; the new part titles come from the folder at switch time; one transaction per story; an exact undo | The card checks are TypeScript and cannot run in the SQL editor; the acting admin is named with `--by <email>` |

## Decision
- **Import.** `import-drafts.mjs <folder> --keep-published [--dry-run | --check | --undo]` reads only `app/companion.json` and `app/parts_and_cards.json`. It writes only `story_cards`: a key in both sets gets the file's text as a new draft version, a new key a version 1 draft, and old keys stay published. It writes no Companion, story, part title, input or field row. Its own drafts (no editor, never published, above the last published version) are rewritten or removed on a re-run; its undo removes only them. A key whose newest version is an editor's unpublished draft is never touched (reported as `kept: editor draft`), so an edit made in the admin is what the switch-over publishes (#522 review). Every dry run stops with its report as an error, because the Supabase SQL editor shows only the last result (the pattern of `scripts/story-cards/fix-published.mjs`). The default mode and every #514 guard stay as they were.
- **Switch-over.** `switch-story.mjs <folder> <story> --by <admin email> [--dry-run | --undo]` and `--check`. In one transaction it publishes the newest version of each card of the new set, retires the story's other published cards (published false, `published_at` kept so pinned sessions still read them), sets the part titles to the new set's, and writes Publish history rows: `publish` and `retire` per card, and one `story_switch` row for the story. The undo puts back exactly what was published and the part titles of before, and refuses when a card of the story changed after the switch-over.
- **Migration** `20261207000000_story_switch.sql`: `publish_history.action` takes `retire`, `publish_history.kind` takes `story_switch`, and `private.story_switches` keeps the before and after state for the undo.
- **Card checks.** `CARD_EXPORT=<folder> npm run check:export-cards` runs the admin's checks on the new set of each story, as if it were published, and prints keys and problem kinds only. Whether a story whose cards fail is switched anyway is the owner's decision, story by story; the Human step runs the checks first.
- **Testing.** `@electric-sql/pglite` 0.5.16 (dev only) runs every migration and the printed SQL in memory in `tests/story-switch-database.test.ts`, with invented cards. The newest versions (0.6.0 and 0.6.1) were days old when this was written; 0.5.16 is the newest release more than two weeks old.

## Consequences
- Phones keep reading the placeholders until a story is switched over; the admin shows each placeholder with its newer draft, the new keys as drafts, and the old keys as published.
- Running SQL is the owner's Human step, one story at a time.
- The SQL does not run the card checks; `check:export-cards` and the admin's draft problems are the safeguard. On 2026-11-27 most of the regenerated cards failed them (see the pull request).
- `merged_titles` is not stored; no screen reads it.
