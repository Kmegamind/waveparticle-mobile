# Publish history with roll back in the admin: design

Issue #289. Product choices approved by Yue on 2026-11-15 (phase 2 sheet and the task brief). Builds
on #287 (`docs/decisions/0016`) and #288 (`docs/decisions/0017`). Decision record:
`docs/decisions/0018-publish-history-in-the-same-transaction.md`.

## Intent
Every publish and every roll back in the content admin leaves one row that says who did it, when,
to which item and which version. An editor can open ADM-12 Publish history and put any listed
version back with one Roll back button.

## Goals
- `public.publish_history`, shared by every kind of content: today only `app_text`; characters,
  prompts and story cards widen the `kind` check later.
- The row is written inside `private.set_published_app_text`, so it commits or fails together with
  the publish or roll back.
- Only content editors read the history; nobody inserts, edits or deletes rows through the API.
- ADM-12 lists the newest 100 rows, newest first: time, person, kind, key, version, action, and a
  Roll back button on every row whose version is not the one published now.
- Fix from #288: a version that was published before is shown as "Earlier version", never as a
  draft.

## Non-goals
- Filters, paging past 100 rows, a diff between versions.
- History rows for saves of drafts.
- Other kinds of content (later phases).

## Anti-goals
- A service-role key anywhere in app code.
- Showing an editor's email to anyone without a content role.
- A history that can be changed after the fact through the API.

## Approaches
| Approach | For | Against |
|---|---|---|
| **A. Insert in the private publish function; read through a `security definer` function `list_publish_history(row_limit)` that checks `is_content_editor()` and joins `auth.users` for the email (chosen)** | Same transaction by construction; email without a service key; one place to add later kinds | One more function |
| B. A trigger on `app_text` when `published` changes | No change to the publish function | Cannot tell a publish from a roll back; each kind needs its own trigger |
| C. The page reads the table directly and shows a short account id | No extra function | Ids mean nothing to a person |

## Decided
- Table `public.publish_history (id identity, kind, item_key, version, action, acted_by, acted_at)`,
  `kind in ('app_text')`, `action in ('publish', 'roll_back')`, `acted_by = auth.uid()`
  (`on delete set null`, so deleting an account keeps the row), index on `acted_at desc`.
- Row level security on, one select policy for `is_content_editor()`; `revoke all` from `anon` and
  `authenticated`, `grant select` to `authenticated` only; update, delete and truncate revoked
  explicitly.
- `public.list_publish_history(row_limit integer default 100)`: editors only (`42501` otherwise),
  limit kept between 1 and 500, returns each row with the editor's email and `is_current` (the
  version is the published one now).
- Roll back now accepts any version that was published before and is not the current one (it was
  "only an earlier version"). Reason: a history row of a newer version that was rolled back past
  must be restorable too. `private.set_published_app_text` is replaced in the new migration
  `20261118000000_publish_history.sql`; the #288 migration is not edited.
- Page: one card per row (a table does not fit 360 px), time in UTC (`15 Nov 2026, 10:04 UTC`),
  person = email, or the first 8 characters of the account id, or "Deleted account". The Roll back
  button calls the existing roll back path of the row's kind (`writeAppText` for `app_text`).
- App text page: state "published" for the published row, "earlier" for a row with `published_at`,
  "draft" otherwise; the "Newer draft" is the newest never-published version above the published
  one; Roll back is offered on every earlier version.

## Testing
- SQL text tests (`tests/publish-history-migration.test.ts`), as #287 and #288: no local Postgres in
  this repo, so the migration is not run against a real database here.
- Unit tests of the row view and the roll back dispatch (`tests/publish-history-admin.test.ts`), and
  of the label fix (`tests/app-text-admin.test.ts`).
- e2e (`e2e/publish-history.spec.ts`) against the Supabase stub, which mirrors the history insert and
  `list_publish_history`.
