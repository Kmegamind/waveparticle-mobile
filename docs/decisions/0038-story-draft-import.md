# 0038: Import a Companion's stories and cards as drafts from a folder outside the repository
- Status: proposed; its "no card or story text in git" reason dropped by the owner on 2026-11-28 (TEXT-IN-GIT-DROPPED: the repository will be made private later). The script and its checks stay as built.
- Date: 2026-11-27
- Issue: #502

## Context
The owner asked for the twelve Severus Snape stories in the app as drafts, so that she can edit the cards in the admin and publish them story by story herself. The repository is public and the cards are written from a novel under copyright, so no card or story text may be committed (dropped by the owner on 2026-11-28, TEXT-IN-GIT-DROPPED: the repository will be made private later). The existing imports (`scripts/content/import.mjs`, `scripts/story-cards/import.mjs`) read repository files and load cards as published. #479 (`docs/decisions/0036`) set the pattern for text that must stay out of git: a script reads the owner's folder from a path argument and prints SQL. Users must not see Snape yet: like Moriarty, his `enterHref` stays null.

## Options
| Option | For | Against |
|---|---|---|
| Copy the export into `src/content/snape/` and `docs/demo/` and use the existing imports | No new script | Commits the text; cards would load as published |
| **A new script reading the export folder (outside the repository) and printing SQL: dry run, run, md5 check, undo** | No text in git; the owner runs it; the same pattern as #479 | One more script |
| Story screen lines (goal sentence, "Who I am", opening) written into `public.stories` | One step | Signed-in accounts can read `public.stories`, and the text would count as published |
| **Screen lines as version 1 drafts in `public.content_fields`; the story columns stay empty until an admin publishes** | Nothing is published; Publish uses the existing flow and writes Publish history | The story row has empty columns until then ("Not written yet") |
| Title and period as drafts too | Everything a draft | The Stories list and the period rules need them; phones show only Oppenheimer's stories |
| **Title and period written straight into the story row** | The admin lists the stories by period | They are stored as the shown text |

## Decision
- `scripts/content/import-drafts.mjs <export folder> [--dry-run | --check | --undo | --source-check]` reads `app/companion.json`, `app/parts_and_cards.json`, `app/stories.json`, `app/stage0/<story>.stage0.json` and `<id>/periods.json`, refuses a folder inside the repository (compared by device and inode after following links), connects to nothing and prints SQL.
- Cards are version 1 with `published = false` and no `published_at`; the goal sentence, "Who I am" and opening are version 1 drafts in `content_fields`; key moments are stored unconfirmed (KEY-UNCONFIRMED); the Companion row keeps `enter_href` null. Slices are `s<part>` (SLICE-SUBTASK). The plan page's merged titles are not stored.
- The Companion's short fields (name, short name, tags, line, mode, key code) and his 300 px portrait are committed in `src/content/companions.json` and `public/companions/`, with `enterHref` null; the script refuses an export that disagrees with them.
- The import refuses to print anything when a gap would have to be invented (an empty line, a missing stage 0 file or screen line, an empty key line, a missing period, a part without a title or cards, a missing background card, a slice other than `s<part>`), and refuses to run again once any card or field of the Companion was published. Before anything is published, a run with a changed export removes this Companion's stories, part titles and cards that the export no longer has; the dry run lists what the run adds, changes and removes, and the check compares both ways (#514 review). The undo removes every story of the Companion and refuses to remove anything when something was published.
- `story_inputs.provenance.outsideRepository` is set to true, and the content export (`scripts/content/export.mjs`) never writes such a story back to the files.
- The admin's Stories pages read any Companion: `/admin/stories?companion=<id>` (Oppenheimer by default) and `/admin/stories/<story>` for a story of any Companion. A list of cards none of which was ever published shows "Imported as drafts" instead of "Published first, read afterwards".

## Consequences
- The owner runs the SQL in the SQL editor (dry run, run, check, undo); nothing is stored by the pull request.
- Until each story has a scene table (the pause and rest-chat inputs of stage 0), the existing card check marks every Snape card "The scene check could not run" and an admin cannot publish it. That work moved to #515.
- The phone's Companions list shows Snape (no Enter) once his Companion row exists, as it shows Moriarty.
- The undo keeps the Companion row, because it may have been there before the run (`scripts/content/import.mjs` writes it from `companions.json`); it holds only the committed short fields with `enter_href` null.
- The admin's Stories pages filter parts and cards by the Companion's story ids in the database and read them page by page, so the API's 1000-row limit never hides a card.
- Publishing the Snape cards needs a scene table per story or an owner rule (#515).
