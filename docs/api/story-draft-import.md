# Story draft import (#502)

A Companion's stories, part titles and cards, imported as **drafts** from the owner's story-pipeline export folder, which stays outside the repository (`docs/decisions/0038`). Nothing is published; the owner edits and publishes in the admin.

## The import: `scripts/content/import-drafts.mjs`

```
node scripts/content/import-drafts.mjs <export folder>                 # the SQL (begin ... commit)
node scripts/content/import-drafts.mjs <export folder> --dry-run       # ends in ROLLBACK, lists counts
node scripts/content/import-drafts.mjs <export folder> --check         # read-only SELECT by md5, no text
node scripts/content/import-drafts.mjs <export folder> --undo          # the undo SQL
node scripts/content/import-drafts.mjs <export folder> --source-check [--base origin/main] [--extra <file>]...
```

- `<export folder>` is the pipeline's `characters/<id>/export/` folder: `app/companion.json`, `app/parts_and_cards.json`, `app/stories.json`, `app/stage0/<story>.stage0.json`, `<id>/periods.json`. A folder inside the repository is refused. The script writes no file, connects to nothing and never calls a model. The SQL holds story text: paste it straight into the SQL editor and never save it in the repository.
- The Companion must be in `src/content/companions.json` with `enterHref` null and his portrait in `public/`; the export's name, mode, key code and line must match.

| Table | What the run writes |
|---|---|
| `companions` | his row; on conflict only `line`, `portrait`, `mode`, `key_code` and `enter_href = null` |
| `stories` | id, sequence, title, period; `goal_short`, `who`, `opening` empty ("Not written yet") |
| `story_inputs` | facts, forbidden terms, key moments (`confirmed: false`), provenance with `outsideRepository: true`, stage 0 with the screen-line places null |
| `story_parts` | the five part titles of each story |
| `story_cards` | every card as version 1, `published = false`, `published_at` null; `slice` is `s<part>` |
| `content_fields` | `<code>.<story>.goal`, `.who` and `.opening` as version 1 drafts |

- **Guards.** Before any write the run stops if a story id belongs to another Companion, or if any card or field of this Companion was ever published. Run again before that, it updates the same rows; versions saved in the admin stay.
- **Refusals.** It prints nothing, and names each problem, when a gap would have to be invented: an empty Companion line, a missing stage 0 file or screen line, an empty key line, a story without a period, a part without a title or cards, a missing background card, a wrong card key or a slice other than `s<part>`.
- **Check.** One row per Companion, story, inputs row, part title, card (version 1) and draft field: `ok`, `missing` or `differs from the file` (a published card differs). Only ids and md5 sums are printed.
- **Undo.** Deletes the imported stories (their inputs, parts, cards and fields cascade) and the Companion row. It stops with an error, removing nothing, when anything of his was published.
- **Source check (AC4).** Compares every 40-character window of the export's texts with the text the branch adds (the added lines of each changed file, every new file, and any `--extra` file such as a pull request body); prints only file names and counts. The Companion's committed short fields are allowed.

## Admin pages
- `/admin/stories?companion=<id>` lists that Companion's stories by Life Path period (Oppenheimer without the parameter); `/admin/stories/<story>` opens a story of any Companion, with the breadcrumb back to its Companion's list.
- When none of the shown cards was ever published, the notice reads "Imported as drafts" instead of "Published first, read afterwards".
- The story fields page shows "Not written yet" for a missing input: no people, no later words or scene table (the pause and rest-chat inputs), an empty key line, and the closing and carried line (no table yet).
