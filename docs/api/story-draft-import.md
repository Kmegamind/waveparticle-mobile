# Story draft import (#502, #516)

A Companion's stories, part titles and cards, imported as **drafts** from the owner's story-pipeline export folder, which stays outside the repository (`docs/decisions/0038`). Nothing is published; the owner edits and publishes in the admin.

## The import: `scripts/content/import-drafts.mjs`

```
node scripts/content/import-drafts.mjs <export folder>                 # the SQL (begin ... commit)
node scripts/content/import-drafts.mjs <export folder> --dry-run       # ends in ROLLBACK, lists added / changed / removed
node scripts/content/import-drafts.mjs <export folder> --check         # read-only SELECT by md5, both ways, no text
node scripts/content/import-drafts.mjs <export folder> --undo          # the undo SQL
node scripts/content/import-drafts.mjs <export folder> --source-check [--base origin/main] [--extra <file>]...
```

- `<export folder>` is the pipeline's `characters/<id>/export/` folder: `app/companion.json`, `app/parts_and_cards.json`, `app/stories.json`, `app/stage0/<story>.stage0.json`, `<id>/periods.json`. A folder inside the repository is refused, compared by device and inode after following links (so a symbolic link, another letter case or the main checkout seen from a worktree are refused too). The script writes no file, connects to nothing and never calls a model. The SQL holds story text: paste it straight into the SQL editor and never save it in the repository.
- The Companion must be in `src/content/companions.json` with `enterHref` null and his portrait in `public/`; the export's name, mode, key code and line must match.

| Table | What the run writes |
|---|---|
| `companions` | his row; on conflict only `line`, `portrait`, `mode`, `key_code` and `enter_href = null` |
| `stories` | id, sequence, title, period; `goal_short`, `who`, `opening` empty ("Not written yet") |
| `story_inputs` | facts, forbidden terms, key moments (`confirmed: false`), provenance with `outsideRepository: true`, stage 0 with the screen-line places null |
| `story_parts` | the five part titles of each story |
| `story_cards` | every card as version 1, `published = false`, `published_at` null; `slice` is `s<part>` |
| `content_fields` | `<code>.<story>.goal`, `.who` and `.opening` as version 1 drafts |

- **Guards.** Before any write the run stops if a story id belongs to another Companion, or if any card or field of this Companion was ever published.
- **A changed export.** Run again before anything is published, the run brings the database to the export: this Companion's stories, part titles and cards that the export no longer has are removed (a removed story takes its inputs, cards and fields with it), and the rest is written again. Later versions saved in the admin stay for the cards still in the export. Other Companions are never touched.
- **Dry run.** Takes a snapshot of this Companion's rows before any write, runs the import, and lists per kind (companion, story, inputs, part, card, field) how many rows the run adds, changes, removes and leaves unchanged; then ROLLBACK. A Companion row counted as added was not in the database before.
- **Refusals.** It prints nothing, and names each problem, when a gap would have to be invented: an empty Companion line, a missing stage 0 file or screen line, an empty key line, a story without a period, a part without a title or cards, a missing background card, a wrong card key or a slice other than `s<part>`.
- **Check.** Compares both ways: one row per item of the file or of this Companion in the database (Companion, story, inputs row, part title, card version 1, draft field): `ok`, `missing` (in the file only), `only in the database, not in the file`, or `differs from the file` (a published card or field differs too). Only ids and md5 sums are printed.
- **Undo.** Deletes every story of this Companion, whichever export it came from (their inputs, parts, cards and fields cascade). It stops with an error, removing nothing, when anything of his was published. His Companion row stays, because it may have been there before the run (`scripts/content/import.mjs` writes it from `companions.json`); the Human steps say how to remove it when the dry run counted it as added.
- **Source check (AC4).** Compares every 40-character window of the export's texts with the text the branch adds since its merge base (the added lines of each changed file, every new file, and any `--extra` file such as a pull request body); prints only file names and counts. The Companion's committed short fields are allowed.

## Keep published: new cards next to published ones (#516, `docs/decisions/0039`)

```
node scripts/content/import-drafts.mjs <export folder> --keep-published               # the SQL
node scripts/content/import-drafts.mjs <export folder> --keep-published --dry-run     # stops with its report
node scripts/content/import-drafts.mjs <export folder> --keep-published --check       # read only, by md5
node scripts/content/import-drafts.mjs <export folder> --keep-published --undo        # the undo SQL
node scripts/content/import-drafts.mjs <export folder> --keep-published --undo --dry-run   # stops with its report
```

- For a Companion who already has published cards (Oppenheimer's regenerated decks). The folder needs only `app/companion.json` and `app/parts_and_cards.json`; the same repository refusal applies. The Companion's id, name, mode and key code must match `companions.json`; his line, tags and portrait are not compared, because this mode writes no Companion row. `merged_titles` must be a list when present and is not stored. The default mode still refuses a Companion with anything published, and points a cards-only export to this mode.
- **Guards.** Before any write: the Companion is in the database, and every story of the file is one of his stories there.
- **What it writes: `story_cards` only.** Every published row stays exactly as it is.
  - A key in both sets: the file's text becomes a new draft version (the history stays).
  - A new key (a seventh card, a fifth part): a version 1 draft.
  - An old key the file does not have: untouched, still published, until that story's switch-over.
  - A key whose newest version already holds the file's text: untouched, so a second run changes nothing.
  - **A key whose newest version is an editor's unpublished draft** (`created_by` set: saved in the admin before or after an earlier run): untouched, and reported as `kept: editor draft`. The file's text is never stacked on top of an editor's draft, so the switch-over publishes the editor's version (#522 review).
- **Its own drafts** are the versions no editor wrote (`created_by` null) and nobody ever published, above the key's last published version. A run with a changed export rewrites them and removes those of keys the file no longer has.
- **Every dry run stops with its report.** The Supabase SQL editor shows only the last statement's result, so a dry run ends with an error that starts "Dry run: nothing was changed." and lists one line per count (as `scripts/story-cards/fix-published.mjs`). Nothing is kept.
- **Dry run report.** Stories, part titles and cards of the file; drafts added, changed and removed; cards of the file that are drafts after the run; published cards the file does not have (retired at the switch-over); **published rows changed (always 0)**; `kept: editor draft` (and one `editor draft kept: <key>` line per key); part titles changed (0); then one line per part title, "<story> part <n>: now <stored title or none>; new <title>", and "removed at the switch-over" for a stored part the file does not have.
- **Check.** One row per key of the file or of these stories: `ok, draft`, `ok, published`, `ok, published now; retired at the switch-over` (an old key), `ok, retired`, `ok, published before (the switch-over was undone)`, `kept: editor draft`, or `missing`, `differs from the file`, `only in the database, not in the file`. Keys and md5 sums only.
- **Undo.** Removes this import's own drafts of these stories, nothing else. It stops when a story of the file is not this Companion's, and while a switch-over of one of them is not undone. Its dry run reports `drafts removed` and `published rows changed` (0). Order: undo the switch-overs first, then the import; the switch-over's undo turns the versions it published back into drafts, so the import's undo then removes them and the database is as before the import.

## Switch-over of one story (#516)

```
node scripts/content/switch-story.mjs <export folder> <story> --by <admin email>             # the switch-over
node scripts/content/switch-story.mjs <export folder> <story> --by <admin email> --dry-run   # stops with its report
node scripts/content/switch-story.mjs <export folder> <story> --check                        # read only
node scripts/content/switch-story.mjs <export folder> <story> --by <admin email> --undo [--dry-run]
```

- Needs `supabase/migrations/20261207000000_story_switch.sql` and the keep-published import of the same folder. `--by` names an account with the admin role (any other email is refused); the Publish history rows record it.
- **One transaction:** publishes the newest version of every card of the story's new set (the imported draft, or an editor's draft, which the import keeps), retires the story's other published cards (`published` false; `published_at` stays, so a session pinned to them keeps its cards), sets the part titles to the new set (3 to 5), and writes Publish history rows: `publish` and `retire` per card and one `story_switch` row (item key: the story id). `private.story_switches` keeps the published versions and part titles before and after.
- **It stops, changing nothing,** when `--by` is not an admin account, the story is not his, it is already switched over, or a card of the new set has neither a version with the file's text nor an editor's draft on top (the import has not run).
- **Undo:** the cards published before and the part titles of before come back, with `roll_back` rows (and `retire` rows for new cards that had no earlier version) and a `story_switch` `roll_back` row. It stops when any card of the story was published, rolled back or retired after the switch-over. The earlier versions come back with their own publish times. Of the versions the switch-over published: one published before it gets its earlier publish time back; one a phone session pinned keeps its publish time, so that session keeps every card (it stays as an earlier version, and the import's undo leaves it); every other one becomes a draft again, so the story can be switched again and the import's undo can remove it. The undo's report counts `versions kept for a pinned session`. A part title renamed in the admin after the switch-over is put back without a warning. Dry run: `--undo --dry-run` stops with its report (cards published again, retired, published now, part titles now).
- **Check:** every card of the new set published, no other card of the story published, the part titles as in the file, and the switch-over on record.
- **Card checks.** The SQL cannot run the admin's TypeScript checks. Run `CARD_EXPORT="<export folder>" npm run check:export-cards` first: per story, how many cards fail and the kinds of problem, with keys only. The admin story page also shows each draft's problems.
- The Publish history page shows a retired card as "Retired" and a switch-over as "Story switch-over", neither with a Roll back button.
- The admin story page marks a retired card "Retired" (no version published now, one before, no draft); the Stories list counts neither retired cards nor a part that holds only retired cards and has no title, so a story switched to 3 parts reads "3 parts".

## Stage 0 with each switch-over (#526)
Needs `supabase/migrations/20261209000000_story_switch_stage_zero.sql` (`docs/decisions/0041`).

- **Export.** `app/stage0/<story>.stage0.json` per story: `slices` (one per part, sK = part K, SLICE-SUBTASK), `steps` (n, title, covers) and `scene`. Only those three values are read; the display texts in the file (`who`, `story.goalShort`, `whereNow.s1`) are not, because `content_fields` holds them. Either every story of the export has its file or none has (a cards-only export, as #516's, still works). Refused, with nothing printed (no dry run either): no slices, a slice without an id or twice, no steps, a step covering no slice or a slice the file does not have, no scene object, a part card whose slice is not one of the file's slices, steps that do not match the deck's parts (one step per part, numbered as the parts), or a step n that does not cover the slice of part n's cards. Nothing is filled in or moved.
- **Import (`--keep-published`).** Writes each story's three values to `story_inputs.stage_zero_next`, where they wait. `stage_zero`, which phones read, is not touched; a story already switched over is left alone. Dry run: `stage 0 files in the export`, `stage 0 waiting for the switch-over`, `stage 0 left alone (story switched over)`, `stage 0 that phones read, changed` (always 0). Check: one `stage 0 <story>` row per story: `ok, waiting for the switch-over`, `ok, switched over`, `not imported`, `differs from the file`, `missing: no story inputs row`. Undo: also sets `stage_zero_next` to null (`stage 0 waiting cleared`).
- **Switch-over.** Needs the story's stage 0 file (otherwise nothing is printed). In the same transaction it replaces `slices`, `steps` and `scene` in the story's `stage_zero` with the file's, keeps every other value, sets `stage_zero_next` to null, marks the story's `provenance` with `outsideRepository` and `switchedOver`, and records in `private.story_switches` the exact text of `stage_zero` and `provenance` before, the `stage_zero` text it wrote, and the waiting value. Dry run line: `stage 0 replaced (slices, steps, scene)`. Check row: `stage 0` (`ok`, `differs from the file`, `still waiting in stage_zero_next`).
- **Undo.** Puts back the exact text of `stage_zero` and `provenance` and the waiting value, so an md5 check of the story inputs matches again. It stops, changing nothing, when the story's `stage_zero` changed in any way after the switch-over. A switch-over recorded before the migration (no values stored) leaves `stage_zero` alone, as then.
- **Repository content scripts.** A switched story (`provenance.switchedOver`) keeps its record in `src/content/<companion>/stories.json` (written without the two marks) but `scripts/content/export.mjs` never writes its stage 0 file: `docs/demo` keeps the placeholder and the owner's text stays out of git. `scripts/content/import.mjs` never overwrites the inputs of a story marked `outsideRepository` (its upsert has a `where` on the stored provenance), so a content import cannot put the placeholder back under the new cards.
- **Pre-switch checks.** `CARD_EXPORT=<folder> npm run check:export-cards` checks each story with the export's new slices, steps and scene. The admin story page reads the waiting values through `get_story_stage_zero_next(reader_key)` and shows, under each card and draft, the problems only the new stage 0 finds, as "After the switch-over: ... This does not block Publish now." Publish (the server's re-check), the problems on the page, the Stories list and the status board use the LIVE stage 0, which phones read until the switch-over (#533 review I1). When the waiting read fails (the migration not applied yet), the server logs `stage_zero_next_read_failed` and the story page says the warnings are not shown. Phones never read the waiting values.

## Admin pages
- `/admin/stories?companion=<id>` lists that Companion's stories by Life Path period (Oppenheimer without the parameter); `/admin/stories/<story>` opens a story of any Companion, with the breadcrumb back to its Companion's list. Parts and cards are filtered by the Companion's story ids in the database and read page by page (1000 rows per request), so the API's row limit never cuts a list short.
- When none of the shown cards was ever published, the notice reads "Imported as drafts" instead of "Published first, read afterwards".
- The story fields page shows "Not written yet" for a missing input: no people, no later words or scene table (the pause and rest-chat inputs), an empty key line, and the closing and carried line (no table yet).
