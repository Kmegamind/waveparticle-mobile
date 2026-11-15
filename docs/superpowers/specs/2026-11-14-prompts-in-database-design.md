# Prompts in the database: design

Issue #282. Approved by Yue on 2026-11-14 ("Approve, build without plan wait"; gateway prompts only).

## Intent
The owner changes a prompt without a deploy, in the Supabase table editor or in the repository files.

## Scope
The prompts the model gateway sends (`src/lib/model-gateway/gateway.ts`): plan split, step cards with the background card, the pause's stuck situation, the rest reply, the return pop-up, the closing line, and the retry hints. Check parameters that are numbers: sentence and word limits per line kind, plan title, Step title and description limits, card counts, the harder-pause threshold.

Out of scope: `scripts/demo-prompts.mjs` (offline demo generator: feeling, resolve, demo background), story content, screens, the banned-word and pattern rules in `checks.ts` (rules, not parameters).

## Decided
| Item | Decision |
|---|---|
| Table | `public.prompts`: `key`, `version`, `active`, `body`, `params` (jsonb), `note`, `created_at`; primary key (`key`, `version`); a partial unique index allows one active version per key |
| Access | Row level security on with no policies: neither the anon key nor a signed-in user can read or write it through the API |
| Server read | `public.get_active_prompts(reader_token text)`, `security definer`, `search_path` fixed. It returns the active rows only when `sha256(reader_token)` equals a hash in `private.prompt_reader`; otherwise no rows. The token is the server-only env `PROMPTS_READ_TOKEN` (never `NEXT_PUBLIC_`). No service-role key anywhere |
| Interface | `src/lib/prompts/repository.ts`: `getActivePrompt(key)` returns the active row or null. Server-only. One cache for all keys, at most 60 seconds old |
| Templates | `{{name}}` placeholders filled in one pass (user text is never read as a placeholder). A line whose placeholders are all empty is dropped. Text pieces chosen by code (first or harder pause, return trigger, background lines) live in `params.text` |
| Missing prompt | Missing or inactive row, missing token or failed read: no model call, one log line without user text (`prompt_missing` with the key), the gateway's explicit failure with the new reason `prompt`, so the existing failure screen with Retry shows. No stored line and no default prompt |
| Seed | `docs/ai/prompts/<key>.md`: a JSON block (version, params) and a text block (body). `scripts/prompts/import.mjs` prints SQL that inserts a new version when a file changed and activates it; `scripts/prompts/export.mjs` writes the active rows back to the files through the same function |
| Same behaviour | A golden file of the prompts the current code builds for about 15 inputs is captured first; the new code must build exactly those strings from the seed. Checks read their limits from the seed and keep today's values |
| Tests | Unit tests use the seed files as the prompt source. The e2e Supabase stub answers `get_active_prompts` with the seed when the token matches |

## Approaches considered
1. **Token-checked security-definer function (chosen):** works for signed-in pages and `/try`, no service-role key, the browser can call the function but gets nothing without the server-only token.
2. Grant the read to signed-in users only: `/try` (no user) could not generate.
3. Service-role key on the server: ruled out by the project rule.

## Left to the builder
File names inside `src/lib/prompts/`, the exact template wording of each key (it must reproduce today's strings), test structure.
