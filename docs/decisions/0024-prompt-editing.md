# 0024: Prompts are edited as drafts in the admin, and only a version the gateway can use is published
- Status: accepted (Yue approved the design on 2026-11-17)
- Date: 2026-11-17
- Issue: #308

## Context
The gateway's 7 prompts live in `public.prompts` (`docs/decisions/0015`). Until now they were
changed in the Supabase table editor or through the files and the import, with no draft, no
record of who changed what, and no way to undo from the admin. ADMIN (2026-11-14) puts every
content change through a draft and a Publish. The gateway refuses a row it cannot use (an unknown
`{{name}}`, a missing or unusable setting) only when a call builds the prompt, and then the page
shows its failure screen.

## Options
| Option | For | Against |
|---|---|---|
| A. Settings edited as one JSON text box (chosen) | The settings exactly as in the table and the files; works for every key, including retry_hints' fixes per rule; a new setting needs no form change | A writer edits raw JSON (a parse error is shown in words and nothing is saved) |
| B. One form field per setting | Friendlier | A form per key that must change with every new setting |

For the publish check, a declared list of allowed names and required settings per key was
rejected. It would be a second copy of the gateway's rules, and the two could drift apart.

## Decision
Option A.
- **Drafts.** `save_prompt_draft` adds version `max + 1` of the key, which is never active. The
  active version is untouched, and `get_active_prompts` returns active rows only, so the gateway
  never reads a draft. Version numbers are never reused. A save that changes nothing (text,
  settings and note) is refused in the app.
- **The check is the gateway's own.**
  - `promptRowProblems(row)` in `src/lib/model-gateway/gateway.ts` runs the same builder a live
    call runs for that key, over every branch:
    - the first Pause and the harder one;
    - both return triggers;
    - counted and open cards, with and without the background card and the Step facts;
    - split finer, yes and no.
  - The problems are listed in words.
  - The admin shows them on every draft.
  - Publish and Roll back refuse a version that has any.
- **Publish and roll back:** the admin role only, checked by the button, the server action and
  the database (`content_role() = 'admin'`). A writer saves drafts and asks an admin.
  - Both go through `private.set_active_prompt`, which:
    - makes the version active with the existing `public.activate_prompt`;
    - records `activated_at` and `activated_by`;
    - writes a `publish_history` row of kind `prompt` in the same transaction.
  - Roll back is offered in Publish history. It restores only a version that was active before,
    and only if today's gateway can still use it.
- The table stays closed to the API. Editors read every version through `list_prompt_versions()`.

## Consequences
- **When phones see a change:** the server keeps the active prompts for up to a minute, so phones
  use a published version within a minute.
- **The database checks only the role.** An admin who calls `publish_prompt` directly through the
  API skips the row check.
- **The table editor and the import still work.** They make a version active without a history
  row, as before.
- **Left for later:**
  - building each prompt from the four parts of PROMPT-PARTS;
  - a Test button that runs a draft against a model.
