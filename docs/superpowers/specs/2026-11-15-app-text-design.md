# App text in the database with draft, publish and roll back: design

Issue #288. Product choices approved by Yue on 2026-11-15 (phase 2 sheet and the task brief); she
waived waiting for plan approval for this phase. Decisions ADMIN, APP-TEXT, NAMING, NO-BACKUP and
FAIL-SCREEN in `docs/DECISIONS.md`. Builds on #287 (`docs/decisions/0016`).

## Intent
A writer changes the app's own words (system voice: messages, button labels) in `/admin` and
presses Publish; phones show the new text within a minute, without a deploy. If the database cannot
answer, the screen shows the text written in the code, so it is never blank.

## Goals
- A versioned table `public.app_text`: keys `ui.<screen>.<slot>` (screen is the `docs/FLOW.md` id),
  every save a new draft version, at most one published version per key, roll back publishes an
  older version again.
- Drafts readable and writable only by content editors (`admin`, `writer`); published rows readable
  by anyone, anon included (app text is not secret).
- A server-side reader of the published texts, cached at most 60 seconds, with the code default for
  any key that has no published row or when the read fails.
- The first batch of 13 keys, defaults equal to today's strings (screens look the same).
- A seed and an import script that load the code defaults as version 1, published.
- ADM-07 App text: every key with its screen, its published text and any newer draft; edit (saves a
  draft), Publish, Roll back to an older version.
- `/admin` responses are never served from the browser cache after sign-out (deferred from #287).

## Non-goals
- Converting other screens; character and story text.
- Publish history (#289). Publish and roll back are built so #289 adds its insert in one place.
- Different rights for admin and writer.
- Building the offline state R-OFF (#21).

## Anti-goals
- A service-role key anywhere in app code.
- A blank or missing text on any screen when the database is down or a key is unpublished.
- Two sources for the defaults that can drift apart.
- A write path that relies on the browser or on the page check alone.

## Constraints
- No service-role key; the database enforces the role (`public.is_content_editor()`).
- `cacheComponents` is on: pages that read the database `await connection()`.
- Tokens from `DESIGN.md` only; 360 px wide without sideways scroll (also 320 px at 200% text).
- e2e runs in parallel against one shared Supabase stub.

## Approaches
| Approach | For | Against |
|---|---|---|
| **A. Table with select policy (published or editor); all writes through `security definer` functions that check `is_content_editor()`; the server reads published rows with the public key and no session; module cache with a clear on publish (chosen)** | No token needed for public text; one function per write so #289 can add its insert in the same transaction; same 60-second in-memory cache pattern as prompts (#282) | Each server instance has its own cache (each is still at most 60 seconds old) |
| B. Token-checked reader function like prompts | Same as prompts | App text is not secret; one more server setting for nothing |
| C. Direct insert/update policies for editors, publish as two updates from the app | Fewer functions | Publish is not one transaction; #289 cannot add its history row in the same transaction; the app would compute version numbers |
| D. Next `"use cache"` with `cacheLife` and `revalidateTag` | Shared cache invalidation | Prerender at build time reads the database; stale-while-revalidate can serve older than 60 seconds; failures harder to keep out of the cache |

Chosen: A (builder's call; Yue handed over the how).

## Decided

### Keys and the first batch
One source for the defaults: `src/content/app-text.json`, a list of `{ key, text, note }`. The code
imports it (`src/lib/app-text/catalog.ts`); the import script reads the same file. A test proves the
seed SQL carries every key and its exact text, and that each screen still renders that text.

| Key | Default (unchanged from the code) | Where |
|---|---|---|
| `ui.F3.fail.body` | He is not here right now. Please try again. | Focus page, cards failed (`focus-body.tsx`) |
| `ui.F3.fail.retry` | Retry | same |
| `ui.F-RET.fail.body` | He is not here right now. Please try again. | Return pop-up failed (`focus-body.tsx`) |
| `ui.F-RET.fail.retry` | Retry | same |
| `ui.R1.fail.body` | He is not here right now. Please try again. | Rest page, his line failed (`rest-body.tsx`, both places) |
| `ui.R1.fail.retry` | Retry | same |
| `ui.END.fail.body` | He is not here right now. Please try again. | Summary failed (`end-screen.tsx`) |
| `ui.END.fail.retry` | Retry | same |
| `ui.R-OFF.body` | No connection. You can still go back to your Step. | Not shown yet: R-OFF is built by #21. Wording from `docs/FLOW.md` R-OFF and the admin prototype |
| `ui.S1.title` | This is outside the story. | Safety page (`crisis-page.tsx`) |
| `ui.S1.support` | Get support now | same |
| `ui.S1.back` | Back to my Goal | same |
| `ui.HOME-0.greeting` | Let’s launch your first wave. | Home, first visit (`protected-home.tsx`) |

The failure message gets one key per screen (F3, F-RET, R1, END), as NAMING ties a key to one
screen and the admin lists the screen. Key format: `^ui\.[A-Z][A-Z0-9-]*\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`.

### Database (`supabase/migrations/20261117000000_app_text.sql`)
- `public.app_text`: `key text` (format check), `version integer >= 1`, `body text not null`
  (not blank, at most 1000 characters), `published boolean not null default false`,
  `created_at timestamptz default now()`, `created_by uuid` (references `auth.users`, on delete set
  null, default `auth.uid()`), `published_at timestamptz` (last time this version became the
  published one; stays set after it is replaced, so "was published" is known),
  `published_by uuid` (on delete set null), `screen text generated always as (split_part(key, '.', 2)) stored`.
  Primary key `(key, version)`. Unique partial index on `(key) where published`.
- Row level security on. `revoke all` from anon and authenticated, then `grant select` to both.
  One policy: `for select to anon, authenticated using (published or (select public.is_content_editor()))`.
  No insert, update or delete policy and no grant for them: writes only through the functions.
- `public.save_app_text_draft(text_key text, text_body text) returns integer`: `security definer`,
  `set search_path = ''`; raises unless `public.is_content_editor()`; checks the key format and a
  non-blank body; inserts the next version (max + 1), unpublished, by `auth.uid()`; returns it.
- `public.publish_app_text(text_key text, text_version integer) returns void` and
  `public.roll_back_app_text(text_key text, text_version integer) returns void`: `security definer`;
  raise unless editor; both call `private.set_published_app_text(text_key, text_version, publish_action)`
  (`'publish'` or `'roll_back'`), which locks the key's rows, unpublishes the current version and
  publishes the given one with `published_at = now()`, `published_by = auth.uid()`. Publish refuses a
  version that is already published. Roll back refuses a version that is not older than the current
  published one or was never published. **#289 adds its history insert inside
  `private.set_published_app_text`**, which already knows who, when, key, version and action.
- `public.import_app_text(text_key text, text_body text) returns integer`: for the seed, run by the
  owner in the SQL editor (revoked from anon and authenticated). Inserts version 1, published, only
  when the key has no rows; otherwise it changes nothing (a writer's edits are never overwritten).
- Execute on the three API functions: revoked from public, granted to authenticated only.
- Migration order test: runs after `20261116000000_content_roles.sql`.

### Seed and script
`scripts/app-text/import.mjs` prints SQL (`begin; select public.import_app_text(...); commit;`)
from `src/content/app-text.json`, like `scripts/prompts/import.mjs`. Paste into the SQL editor or
pipe to `psql`. Documented in `docs/deploy.md` and `docs/api/README.md` (no new README).

### Reading in the app
- `src/lib/app-text/catalog.ts` (browser-safe): `APP_TEXT_KEYS`, `AppTextKey`, `AppTexts`
  (`Record<AppTextKey, string>`), `APP_TEXT_DEFAULTS`, `appTextEntries`, `screenOf(key)`.
- `src/lib/app-text/repository.ts` (server only): `createAppTextRepository({ readRows, cacheMs, now,
  log })` returns `{ getAppTexts(): Promise<AppTexts>, clear(): void }`. One read of all published rows,
  kept `APP_TEXT_CACHE_MS = 60_000`; concurrent calls share one read; a failed read is logged
  (`{"source":"app_text","event":"app_text_read_failed"}`), not cached, and answers the defaults; an
  unknown key or blank body in a row is ignored. `clear()` drops the cache; a read in flight when
  `clear()` runs is not stored. `readPublishedAppText()` uses the public key, no session, a 3 second
  timeout, `select key, body from app_text where published`. Exports `getAppTexts` and
  `clearAppTextCache` for the server.
- `src/lib/app-text/provider.tsx` (client): `AppTextProvider({ texts })` and `useAppText(key)`;
  without a provider the hook answers the default, so a screen is never blank.
- Server pages wrap their screen in the provider with `await getAppTexts()`: `/` (Home), `/focus`,
  `/rest`, `/end`, `/goal`. The sign-in-free test path `/try` and the standalone `/safety` demo keep
  the code defaults: they are static, and `/safety` must work before its scripts load (changed during
  the build: making it dynamic broke `e2e/crisis-page.spec.ts`). S1 inside the rest page and the goal
  dialogue shows the published text.

### Admin page ADM-07 (`/admin/app-text`)
- Server page reads every `app_text` row with the signed-in user's client (the policy gives editors
  drafts), builds rows with the pure `appTextAdminRows(rows)` (`src/lib/app-text/admin.ts`): for each
  catalog key, its screen, default, published version and text (or none), the newer drafts, and all
  versions newest first.
- Layout (prototype spirit, `DESIGN.md` tokens): a list of key cards, each with the screen id and key
  in mono, the published text (or "Not in the database: the app shows the default"), a "Draft vN"
  label with the newer draft's text, a labelled text field with Save draft, a Publish vN button for
  the newest unpublished version newer than the published one, and a Versions disclosure listing
  versions with state (Published, Draft, Earlier) and a Roll back button on earlier published ones.
  A status line (`role="status"`) says what happened; errors in words.
- Server actions (`src/app/admin/app-text/actions.ts`): `saveAppTextDraftAction`,
  `publishAppTextAction`, `rollBackAppTextAction`. Each re-checks the user and role on the server
  (no role: refused, nothing written), validates the key against the catalog and the body, calls the
  function with the user's client, clears the reader cache and revalidates `/admin/app-text`.
- `/admin` responses: the proxy sets `Cache-Control: private, no-store, max-age=0` on every `/admin`
  response (pass and 404).

### Tests
- Unit: migration text (table, checks, index, RLS, policy, grants, function attributes and checks,
  the private publish function, order after content roles, no service role); catalog (13 keys,
  format, screens, defaults equal to the strings rendered); seed SQL from the JSON; repository
  (published text, defaults on failure and missing key, 60 second cache, clear, in-flight race);
  admin rows; actions refuse without role; proxy cache header; docs mention.
- e2e (`e2e/app-text.spec.ts`, serial, on keys no other spec asserts): a writer edits
  `ui.F3.fail.body`, publishes, and the focus failure screen shows it; roll back restores; with the
  database unavailable for published reads the screen shows the code default; a no-role account gets
  404 at `/admin/app-text` and the stub refuses its write call; no sideways scroll at 360 px.
- The stub learns a shared `app_text` store seeded from the JSON, the three functions with the
  editor check, and `POST /__app_text` `{ failReads }` to make published reads fail.

## Left to the builder
Component and CSS class names, exact admin wording, the order of rows (catalog order), and the
timeout value.

## Builder check
Read as the builder (self-check); open items were settled above and marked as builder's calls:
cache per server instance, one key per screen for the failure message, `/try` keeps defaults,
`ui.R-OFF.body` not rendered until #21.
