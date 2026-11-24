# 0018: Write the publish history in the publish transaction and read it through an editor-only function
- Status: accepted (Yue, 2026-11-15, phase 2 sheet)
- Date: 2026-11-15
- Issue: #289

## Context
Every publish and roll back in the content admin must leave a row (who, when, which kind and key,
which version, publish or roll back) written in the same database transaction. Rows must not be
editable or deletable through the API, and accounts without a content role must not read them.
Characters, prompts and story cards will write to the same table later. No service-role key in app
code (0016, 0017).

## Options
| Option | For | Against |
|---|---|---|
| A. Insert in `private.set_published_app_text`; read through `public.list_publish_history(row_limit)`, `security definer`, editors only, joining `auth.users` for the email | One transaction by construction; emails without a service key; a `kind` column serves later content | One more function |
| B. Trigger on `public.app_text` | Publish function unchanged | Cannot tell publish from roll back; one trigger per kind |
| C. Select policy only, page shows account ids | Smallest | Ids mean nothing to an editor |

## Decision
Option A.

- `public.publish_history (id, kind, item_key, version, action, acted_by, acted_at)` in
  `supabase/migrations/20261118000000_publish_history.sql`; `kind in ('app_text')` for now, each later
  kind widens the check in its own migration.
- Row level security with one select policy, `is_content_editor()`. No insert, update or delete
  policy or grant; update, delete and truncate are revoked explicitly. Only the private publish
  function inserts rows.
- `list_publish_history(row_limit default 100)`: editors only (`42501`), newest first, limit 1 to
  500, with the editor's email and whether the version is the published one now.
- Roll back accepts any version of the key that was published before and is not published now (0017
  allowed only an earlier version). A history row of a version that was rolled back past is then
  restorable too.

## Consequences
- Production must run the new migration after `20261117000000_app_text.sql`. Publishes before it
  have no history rows.
- Deleting an account keeps its history rows with `acted_by` set to null ("Deleted account").
- A later kind adds its value to the check, its own insert in its publish function, a branch for
  `is_current` in `list_publish_history`, and a roll back handler in
  `src/lib/publish-history/admin.ts`.

## Addition (2026-11-23, #402 for #118): the `hotline` kind
- Decision HOTLINES: the hotline list is edited in the admin and every publish and roll back of an
  entry writes one `public.publish_history` row in the same transaction, as above.
- The new kind is `hotline`. `item_key` is the entry's country code (ISO 3166-1 alpha-2, upper case,
  for example `US`). A later migration widens the `kind` check for it, as the consequences above
  describe.
- Only the admin role may publish or roll back a `hotline` row (`content_role() = 'admin'`, 0016).
  Writers may read the rows, as for every kind.
- ADM-12 names the kind "Hotline" and shows the country name beside the code.
