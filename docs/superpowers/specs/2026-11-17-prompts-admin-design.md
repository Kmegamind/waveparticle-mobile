# ADM-08 Prompts: design

Issue #308. Approved by Yue on 2026-11-17, with settings edited as one JSON text box (option A).

## Intent
The gateway's 7 prompts live in `public.prompts` (`docs/decisions/0015`). Today the owner changes them
in the Supabase table editor or through the files and the import. This page lets an admin or writer
change them in the admin, in the same way as app text (#288, #289) and story cards (#304). Every
change is a draft first. Only an admin makes it live, every publish is recorded, and a publish can be
rolled back (decision ADMIN).

## Goals
- `/admin/prompts` (ADM-08, a new menu group "AI rules", as in the admin prototype) lists the 7
  prompts with their active version and its settings, and says when a key has no active version or
  has a newer draft.
- `/admin/prompts/<key>` shows the active version's text, settings and note, an editor, the diff of
  the newest draft against the active version, Publish, and the versions.
- Save draft (admin or writer) always adds a new version, `max + 1`. Numbers are never reused, and
  the active version is untouched. `get_active_prompts` returns active rows only, so the gateway never
  reads a draft.
- Publish (admin only) makes the draft the one active version through the existing
  `public.activate_prompt`, and writes a `publish_history` row (kind `prompt`) in the same
  transaction. Publish history can roll it back (admin only).
- A version that the gateway would refuse cannot be published or rolled back to. That covers an
  unknown `{{name}}` and a missing or unusable setting. The reasons are listed in words.

## Non-goals (left for later)
- The four parts of PROMPT-PARTS.
- A Test button that runs a draft against a model.

## Anti-goals
- A second copy of the gateway's rules that could disagree with it. The publish check is the
  gateway's own row check.
- A service-role key, or a check that runs only in the browser.
- A draft reaching phones before Publish.

## Approaches considered
| | How settings are edited | Trade-off |
|---|---|---|
| **A (chosen)** | One JSON text box with the settings as they are in the table and in `docs/ai/prompts/*.md` | Works for all 7 keys, retry_hints' per-rule fixes included, and new settings need no form change. A writer edits raw JSON; a parse error is shown in words and nothing is saved |
| B | One form field per setting | Friendlier, but each key needs its own form, and the form must change whenever a setting is added |

For the publish check, a declared list of allowed names and required settings per key was rejected.
It would be a second source of truth beside the gateway's builders.

## The design

### The gateway's row check
`promptRowProblems(row)` is exported from `src/lib/model-gateway/gateway.ts`. It runs the same
builder the live call runs for that key, once for every branch:
- plan_split: split finer, yes and no.
- step_cards: counted and open cards, with and without the background card, and with no Step facts,
  empty Step facts and Step facts.
- stuck_story: the first Pause and a late Pause.
- return_popup: both triggers.
- rest_reply and closing_line: their one case.
- retry_hints: rendered with `fixes`.

It returns the distinct problems in words, for example:
- `Unknown {{nmae}} in the prompt.`
- `Missing or unusable setting: text.situation_harder.`
- `Missing or unusable setting: checks.step_card.`

An empty list means the row can be used. The live path keeps its behaviour: any problem fails the
call with the reason `prompt`.

### Database
Migration `supabase/migrations/20261125000000_prompt_editing.sql` runs after
`20261123000000_story_card_editing.sql`. It must come later, because it widens the same kind
constraint and replaces the same `list_publish_history`.
- **New columns on `public.prompts`:**
  - `created_by` (default `auth.uid()`);
  - `activated_at` and `activated_by`.
  - For the row that is active now, `activated_at` is backfilled from `created_at`.
- **`public.list_prompt_versions()`:** `security definer`, content editors only. Returns every
  version (key, version, active, body, params, note, created_at, activated_at).
- **`public.save_prompt_draft(prompt_key, prompt_body, prompt_params, prompt_note) returns integer`:**
  - content editors only;
  - an advisory lock per key;
  - the key must already exist and the params must be a JSON object;
  - inserts version `max + 1` with `active = false`.
- **`private.set_active_prompt(key, version, action)`:**
  - locks the key's rows;
  - refuses an unknown version, an already active version, and a roll back to a version that was
    never active;
  - calls `public.activate_prompt`;
  - sets `activated_at` and `activated_by`;
  - inserts the history row.
- **`public.publish_prompt` and `public.roll_back_prompt`:** admin role only.
- **Publish history:** the kind check takes `'prompt'`, and `list_publish_history` reports
  `is_current` for prompt rows.
- **Unchanged:** `import_prompt` and the scripts keep working. An import writes no history row, as
  before.

### App
- `src/lib/prompts/admin.ts`:
  - the page views: the list, the detail, the version states (active, draft, earlier) and the newest
    draft above the active version;
  - the flattened settings lines;
  - `writePrompt(write, deps)` for save, publish and roll back.
- **What a save refuses:**
  - an empty text;
  - a text over 20,000 characters;
  - a note over 500 characters;
  - settings that are not a JSON object;
  - no change from the newest version (text, settings and note).
- **What Publish and Roll back refuse:**
  - any account that is not an admin;
  - a version whose `promptRowProblems` is not empty. The check runs on the server, on the stored
    version.
- `src/lib/prompts/diff.ts`: `lineDiff(before, after)` is a plain line diff based on the longest
  common subsequence. The text and the settings (JSON with sorted keys, two-space indent) are diffed
  separately. Each line is shown with `+`, `−` or a space in text, not by colour alone.
- **Pages:** `src/app/admin/prompts/page.tsx`, `src/app/admin/prompts/[key]/page.tsx`, a client editor
  and `actions.ts`. These follow the App text and Stories pages, with `DESIGN.md` tokens and existing
  admin classes.
- **Publish history:** the kind label is "Prompt", Roll back is offered to admins only, and the
  handler is wired in `publish-history/actions.ts`.
- **The e2e Supabase stub:** a prompt store seeded from `docs/ai/prompts` (v1 active), the new
  functions, and `get_active_prompts` reading the store's active rows.

### Production
The folder `2_Areas/Product/content-admin/production-setup-prompt-editing_2026-11-17/` holds:
- `1-prompt-editing.sql`, a copy of the migration;
- `2-check-it-worked.sql`, which only reads;
- a README in the style of the earlier setups.

It runs after the story-card-editing setup.

## Left to the builder
Labels and layout within the existing admin classes; how branch inputs are named in the check; the
stub's internals.
