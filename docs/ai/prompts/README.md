# The gateway's prompts (#282)

Every prompt the model gateway sends lives in the Supabase table `public.prompts`. The files in
this folder are its seed and its copy in the repository. Edit a prompt in either place:

- **Table editor (no deploy):** change the text or settings of a row, or add a row with the next
  version and make it active. The app uses the change within one minute.
- **Files:** edit a file here, then load it with the import below. Write the table back to these
  files with the export.

| Key | Used for |
|---|---|
| `plan_split` | The goal split into Steps |
| `step_cards` | His cards for one Step, with the background card on Step 1 |
| `stuck_story` | His stuck situation when the person pauses (the harder one from the third Pause) |
| `rest_reply` | His reply in the rest chat |
| `return_popup` | His line in the return pop-up, after the rest chat or an absence |
| `closing_line` | His closing line and the line he carries, on the summary |
| `retry_hints` | The fix added to a prompt after a rejected answer, one per failed check |

## A prompt file

- **Settings** (JSON): `key`, `version` (informational in the file; the table numbers versions),
  `note`, and `params`:
  - `params.text`: pieces of text the app chooses between (for example the first or the harder
    stuck situation);
  - `params.checks`: the limits the answer is checked against (`max_words`, `max_sentences`,
    `min_sentences`, card counts, plan limits);
  - other numbers, such as `harder_from_pause`.
- **Prompt** (text): the prompt itself. `{{name}}` is filled in by the app; a line whose values are
  all missing is left out. An unknown `{{name}}` stops the call instead of sending a broken prompt.

The banned words and patterns in `src/lib/model-gateway/checks.ts` are rules, not settings, and
stay in code.

## When a prompt is missing

If a key has no active row, a row cannot be used (an unknown `{{name}}`, a missing limit), the
table cannot be read or `PROMPTS_READ_TOKEN` is not set, the call is not made. The server logs one
line with the key only (`{"source":"prompts","event":"prompt_missing","key":"…"}`), and the page
shows its usual failure screen with Retry. No stored line is shown and no prompt from the code is
used (NO-BACKUP).

## Who can read the table

Row level security is on with no policy, so neither the browser's public key nor a signed-in user
can read or change the table. The server reads it through `get_active_prompts(reader_token)`, a
`security definer` function that returns the active rows only for a token whose SHA-256 is stored
in `private.prompt_reader`. The token is the server-only setting `PROMPTS_READ_TOKEN`; it never
reaches the browser and is not a service-role key. See `docs/decisions/0015-prompts-in-the-database.md`.

## Commands

| What | Command |
|---|---|
| New reader token (prints the setting and one SQL line with its hash) | `node scripts/prompts/token.mjs` |
| Files to the table: SQL for the SQL editor | `node scripts/prompts/import.mjs > prompts-import.sql` |
| Files to the table: straight to the database | `node scripts/prompts/import.mjs \| psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1` |
| Table to the files | `node --env-file=.env scripts/prompts/export.mjs` |
| Make another version active (SQL editor) | `select public.activate_prompt('stuck_story', 2);` |

The import adds a new version only when a file's text or settings changed, and makes the file's
content active; running it twice changes nothing. Re-importing an older text makes that older
version active again.
