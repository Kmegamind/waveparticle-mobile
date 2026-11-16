# 0019: Story content lives in the database, read through a key-checked function
- Status: accepted (Yue, 2026-11-14; open questions answered 2026-11-16)
- Date: 2026-11-16
- Issue: #284

## Context
The Companions and their stories were bundled into the app from `src/content` and `docs/demo`, so
every content change needed a deploy. The owner wants to edit story content in the Supabase table
editor or in files, and the content admin (ADMIN, #293) builds on these tables. The project rule
stays: no service-role key in application code. The server reads story content both for
signed-in pages and for the sign-in-free test path `/try`, which has no user session. Decisions
SHARED-STORY (stored story content is allowed), DATES-ADMIN-ONLY and KEY-UNCONFIRMED apply.

## Options
| Option | For | Against |
|---|---|---|
| A. Display tables readable by signed-in users; a closed inputs table; a `security definer` function that returns everything the app needs only for a server-only reader key (stored as a SHA-256), the pattern of `0015` | No service-role key; works with or without a session; model-only inputs never reach a browser | One more server setting (`CONTENT_READ_KEY`) and one row in `private.content_reader` |
| B. Select policies for signed-in users on every table | No key | `/try` cannot read; any signed-in browser could read the facts, forbidden and later words |
| C. Service-role key on the server | Simple | Against the project rule |

## Decision
Option A.

- `public.companions`, `public.stories`: display fields under the names the screens use (`title`,
  `goal_short`, `who`, `opening`, `period`, the Companion's name, tags, line, portrait and
  `enter_href`). Signed-in users may select them.
- `public.story_inputs`: facts, forbidden terms, key moments (unconfirmed), the other stage 0
  inputs (`stage_zero`), and the writers' `date` and `provenance`. Row level security with no
  policy.
- `get_story_content(reader_key)` returns the Companions and stories with their inputs, without
  `date` and `provenance`; `export_story_content(reader_key)` returns every column, for the export
  script.
- `getStoryContent()` in `src/lib/content/repository.ts` reads once and keeps the result at most
  60 seconds. A failed read throws `StoryContentUnavailable`: a page fails as when the account
  cannot be read, and a server action answers "failed" (the failure screen with Retry). There is
  no copy of the content in code.
- The files stay the seed: `scripts/content/import.mjs` prints the SQL that loads them,
  `scripts/content/export.mjs` writes the tables back (only files whose content changed), and
  `scripts/content/token.mjs` makes a reader key.

## Consequences
- Production needs the migration, a reader key (Vercel setting plus its hash row) and the import
  before this ships; without them the pages that show story content fail.
- The labelled `/try` test data (`docs/demo/site-search.generated.json`) is still bundled: it is
  generated cards, not story content; stored cards are #293.
