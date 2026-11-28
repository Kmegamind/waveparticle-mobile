# 0041: A story's stage 0 slices, steps and scene change with its switch-over
- Status: proposed
- Date: 2026-11-28
- Issue: #526

## Context
The story pipeline now exports a new stage 0 per Oppenheimer story (`app/stage0/<story>.stage0.json`): one slice per part (sK = part K, SLICE-SUBTASK), steps (n, title, covers) and a refreshed scene. `story_inputs.stage_zero` holds the 4-part placeholder version, and phones play the 4-part placeholder cards until each story's switch-over (`docs/decisions/0039`). The later-part words (`src/lib/prototype/rest-later-words.ts`) and the card checks read `stage_zero.slices` and `.steps`, so they must match the cards that are live: the new stage 0 cannot be written to every story at once. The owner wants to see, before she switches a story, the card problems as they will be after.

## Options
| Option | For | Against |
|---|---|---|
| Write the new stage 0 only at the switch-over, from the file | Simple; the stage 0 changes exactly with the cards | The admin cannot check the new cards against it before the switch: the export folder is not on the server |
| Keep the new stage 0 inside `stage_zero` under another key | No new column | `stage_zero` reaches the phones and the model prompts; a hidden key could leak later slices |
| **A waiting column `story_inputs.stage_zero_next`, written by the draft import; the switch-over copies the file's values into `stage_zero`** | Phones never read it; the admin reads it with the reader key; one transaction per story; an exact undo | One more migration and one more read function |

## Decision
- **Migration** `20261209000000_story_switch_stage_zero.sql`: `story_inputs.stage_zero_next jsonb`; `private.story_switches` gets `stage_zero_before`, `stage_zero_after` and `stage_zero_next_before`; `get_story_stage_zero_next(reader_key)` returns the waiting values by story, for the server's reader key only. `get_story_content` is unchanged and does not name the new column.
- **Import** (`import-drafts.mjs --keep-published`): when the export has a stage 0 folder, every story must have its file; its `slices`, `steps` and `scene` go to `stage_zero_next` (a switched-over story is left alone). Only those three values are read; the display texts stay in `content_fields`. Its undo clears them.
- **Switch-over** (`switch-story.mjs`): refuses to print without the story's file. In the same transaction it replaces the three values in `stage_zero`, keeps every other value, clears `stage_zero_next`, and stores before and after. Its undo restores them and refuses when they changed after the switch-over. A switch-over recorded before this migration leaves `stage_zero` alone on undo.
- **Checks.** `check:export-cards` reads the export's stage 0. The admin's `readStageZeros` puts the waiting values in place for a story not switched over and marks the record; the spoiler check then places each slice in a part from the new cards (each key's newest draft first), and for the live stage 0 from the published cards first. Before, the first card version seen won, which after a switch-over would have placed a slice by a retired placeholder. When the waiting values cannot be read (before the migration), the stories' own stage 0 is used.

## Consequences
- Phones read the placeholder stage 0 of a story until its switch-over, and the new one after it; a session in progress keeps its cards until it ends.
- Before the switch-over, the admin checks a story's cards, including a Publish of a placeholder card, against the new stage 0. Publishing single cards of a story that waits for its switch-over is not the expected path.
- The migration, the re-import and each switch-over are the owner's Human steps.
