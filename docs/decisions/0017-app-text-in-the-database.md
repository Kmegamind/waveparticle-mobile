# 0017: Keep app text in a versioned table, read by anyone when published and written through role-checked functions
- Status: accepted (Yue, 2026-11-15, phase 2 sheet)
- Date: 2026-11-15
- Issue: #288

## Context
Decision APP-TEXT: the app's own words (system voice: messages, button labels, empty states) are
stored in the database under keys `ui.<screen>.<slot>` (NAMING), edited in the content admin
(ADMIN) as drafts and published, and phones show a publish within a minute without a deploy. If the
database cannot answer, the app shows the text written in the code, so a screen is never blank; this
is interface text, so NO-BACKUP does not apply. The project rule stays: no service-role key in app
code. Publish history (#289) must be written in the same transaction as each publish and roll back.

## Options
| Option | For | Against |
|---|---|---|
| A. `public.app_text` with a select policy (published rows for anyone, every row for content editors) and no write grants; `security definer` functions that check `is_content_editor()` for save, publish and roll back; the server reads published rows with the public key and no session, cached 60 seconds | No token or service key; publish is one transaction in one place (#289 adds its insert there); same cache pattern as the prompts | Each server instance keeps its own cache (still at most 60 seconds old) |
| B. A token-checked reader function like the prompts (0015) | Same as prompts | App text is not secret; one more server setting |
| C. Direct insert and update policies for editors; publish as two updates from the app | Fewer functions | Not one transaction; the app numbers versions; no single place for #289 |
| D. Next's `"use cache"` with tags | Shared invalidation | The build would read the database; stale-while-revalidate can be older than 60 seconds |

## Decision
Option A.

- `public.app_text (key, version, body, published, created_at, created_by, published_at,
  published_by, screen)`, primary key `(key, version)`, one published version per key, body never
  blank and at most 1000 characters. Migration `20261117000000_app_text.sql`.
- `save_app_text_draft(key, body)`, `publish_app_text(key, version)` and
  `roll_back_app_text(key, version)`, executable by `authenticated`, each checking
  `is_content_editor()`. Publish and roll back both call `private.set_published_app_text(key,
  version, action)`; roll back only to an earlier version that was published before.
- `src/content/app-text.json` is the one source of the defaults: the app imports it and
  `scripts/app-text/import.mjs` loads it as version 1, published, for keys without rows
  (`import_app_text`, SQL editor only; it never overwrites an edit).
- `getAppTexts()` (`src/lib/app-text/repository.ts`) reads all published rows once per minute at
  most; a failed read is logged without text, not cached, and answers the defaults. A publish on a
  server clears that server's cache at once. Pages pass the texts to client screens through
  `AppTextProvider`; `useAppText(key)` falls back to the default.
- `/admin` responses carry `Cache-Control: private, no-store, max-age=0`.

## Consequences
- Production needs the migration and the seed before the admin shows versions; until then the app
  shows the code defaults (the screens look the same).
- Converting more screens means adding keys to `src/content/app-text.json` and the key list in
  `src/lib/app-text/catalog.ts`, then running the seed again.
- #289 writes its history row inside `private.set_published_app_text`.
- The sign-in-free test path `/try` and the standalone `/safety` page stay static and show the
  defaults.
- `ui.R-OFF.body` is stored and editable but not shown until the offline state is built (#21).
