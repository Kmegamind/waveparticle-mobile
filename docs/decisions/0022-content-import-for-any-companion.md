# 0022: The content import works for any Companion
- Status: accepted (Yue, answers of 2026-11-17)
- Date: 2026-11-17
- Issue: #302

## Context
The book-to-story pipeline (outside this repository, `2_Areas/Product/story-pipeline/`) exports a
new character as a companion entry plus `<id>/stories.json` and `<id>/periods.json`, in the shape
of `src/content/oppenheimer/`. The tables of #284 and #293 are already per Companion, but the
scripts read only Oppenheimer's folder, the story card keys used a fixed `opp`, and the gateway's
`name` check matched Oppenheimer's name only.

## Decision
- **Files.** `src/content/companions.json` lists every Companion. A Companion with a folder
  `src/content/<id>/` holding `stories.json` and `periods.json` has stories; one without has none
  yet. The stage 0 file of every story stays `docs/demo/<story-id>.stage0.json`.
- **Import.** `scripts/content/import.mjs` writes every Companion row and every Companion's stories;
  `--companion <id>` limits the stories to one Companion. The export writes each Companion's stories
  back to its own folder.
- **Missing screen lines stop the import** (Yue, 2026-11-17). A story without its stage 0 file, or
  without the "Who I am" line, the goal sentence or the opening place, stops the import before any
  SQL is printed, with one line per story naming what is missing. Nothing half-finished reaches the
  app. The pipeline does not write these lines yet.
- **Mode and key code** (FICTION-RULES, NAMING). `public.companions` gets `mode` (`historical` or
  `fictional`) and `key_code` (`opp`, `mor`, `dra`; unique), both required. The key code is stored,
  not derived from the id (Yue, 2026-11-17). `companions.json` carries them as `mode` and
  `keyCode`. Nothing in the app reads `mode` yet; prompts by mode are content admin phase 3.
- **Story cards.** `scripts/story-cards/import.mjs <id>` reads `src/content/<id>/story-decks.json`
  and builds keys from that Companion's key code. With no id it imports Oppenheimer, as before.
- **Name check.** The gateway's `name` check rejects any word of three letters or more of the
  speaking Companion's name, titles left out ("Professor Moriarty" gives `moriarty`). The callers
  pass the story's Companion name (`generationInputs(...).companionName`). Superseded in part by
  AI-CHARACTER-NEUTRAL (2026-11-26, #468): there is no default name any more. The name is required;
  a check run without one throws, and a gateway call without one fails before any model call with
  `companion_name` in its log. It is never checked against Oppenheimer's name instead.

## Consequences
- Oppenheimer's import SQL is unchanged apart from the two new columns; his story card SQL is
  byte for byte the same.
- Run `supabase/migrations/20261122000000_companion_mode.sql` before the next content import, or
  the import fails on the unknown columns.
- The pipeline's `companion.json` has `mode` but no `keyCode`; a person adds the key code when
  pasting it into `companions.json` (the import refuses an entry without one).
