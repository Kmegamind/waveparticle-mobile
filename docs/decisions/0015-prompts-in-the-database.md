# 0015: The gateway's prompts live in the database, read through a token-checked function
- Status: accepted (Yue, 2026-11-14)
- Date: 2026-11-14
- Issue: #282

## Context
The model gateway built its prompts in TypeScript, so every prompt change needed a deploy. The
owner wants to change prompts in the Supabase table editor or in files. The project rule stays:
no service-role key in application code. The server must read prompts both for signed-in pages
and for the sign-in-free test path `/try`, which has no user session. Decision NO-BACKUP stays:
no stored line is ever shown, and no hidden default prompt may stand in for a missing one.

## Options
| Option | For | Against |
|---|---|---|
| A. RLS with no policy; a `security definer` function that returns active rows only for a server-only reader token (stored as a SHA-256) | No service-role key; works with or without a user session; the browser gets nothing even though it may call the function | One more server setting (`PROMPTS_READ_TOKEN`) and one row in `private.prompt_reader` |
| B. A select policy for signed-in users | No token | `/try` cannot read prompts; any signed-in browser could read every prompt through the public API |
| C. Service-role key on the server | Simple | Against the project rule |

## Decision
Option A.

- `public.prompts` (key, version, active, body, params, note); one active version per key.
- `getActivePrompt(key)` in `src/lib/prompts/repository.ts` reads all active rows in one call and
  keeps them at most 60 seconds.
- A missing or unusable prompt fails the call before any model call, with the failure reason
  `prompt`; the page shows its failure screen with Retry. The server logs the key only.
- `docs/ai/prompts/` is the seed; `scripts/prompts/import.mjs` prints SQL for it and
  `scripts/prompts/export.mjs` writes the table back.

## Consequences
- Production needs the migration, a reader token (Vercel setting plus its hash row) and the import
  before this ships; without them every generated line fails with the failure screen.
- The prompt text is no longer in the gateway's code; the golden test
  (`tests/fixtures/gateway-prompts.json`) proves the seed builds the same prompts as before.
