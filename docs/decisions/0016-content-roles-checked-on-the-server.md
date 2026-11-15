# 0016: Keep content roles in a closed table, answered by a security-definer function
- Status: accepted (Yue, 2026-11-15, phase 2 sheet)
- Date: 2026-11-15
- Issue: #287

## Context
The content admin at `/admin` (decision ADMIN) may be opened only by accounts with the `admin` or
`writer` role. The project rule stays: no service-role key in application code. The check must run
on the server, and later content tables (#288 app text, #289 publish history) need the same answer in
their row level security policies. An account without a role must get the normal 404, so the admin
is not advertised.

## Options
| Option | For | Against |
|---|---|---|
| A. `public.content_roles` with RLS on and no policy; `security definer` functions `content_role()` and `is_content_editor()` that answer for `auth.uid()` only (null or false without a session) | No service-role key; nobody can read or change roles through the API; later policies call one function | One database call per admin request |
| B. A select policy that lets each account read its own role row | No function | The table is readable through the API; every later policy repeats the subquery |
| C. The role in the access token (`app_metadata` or a custom access token hook) | No query per request | Granting needs the auth admin API or a hook; a change waits for the token to refresh |

## Decision
Option A.

- `public.content_roles (user_id, role, granted_at)`, `role` is `admin` or `writer`, cascades with
  the account (`delete_my_account` removes it).
- `public.content_role() returns text` and `public.is_content_editor() returns boolean`:
  `security definer`, `stable`, `search_path` set to empty, executable by `anon` and `authenticated` (a policy that also applies to anon requests needs the execute right; without a session the answer is null or false).
  A later policy writes `using ((select public.is_content_editor()))`, or
  `(select public.content_role()) = 'admin'`
  for admin-only rights.
- The app reads the role with the signed-in user's own client (`readContentRole` in
  `src/lib/admin/roles.ts`). The proxy answers every `/admin` path with the app's normal 404 when
  there is no user or no role (any read error counts as no role); the admin layout checks again.
- A role is granted with one SQL command in the Supabase SQL editor (`docs/deploy.md`). There is no
  invite screen.

## Consequences
- Production needs the migration and at least one granted role before anyone can open `/admin`.
- Admin and writer open the same pages for now; later issues decide what only an admin may do.
- Removing a role takes effect on the next request; no token refresh is needed.
