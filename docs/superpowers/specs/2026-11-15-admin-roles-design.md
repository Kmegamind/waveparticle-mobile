# Admin area with admin and writer roles: design

Issue #287. Product choices approved by Yue on 2026-11-15 (phase 2 sheet); she waived waiting for
plan approval for this phase. Decisions ADMIN and NAMING in `docs/DECISIONS.md`.

## Intent
Content (app text first, #288; publish history, #289) will be edited in the real app at `/admin`
without a deploy. This issue builds only who may open it and the empty shell the later pages live in.

## Goals
- A roles table: each account is `admin` or `writer`, or has no row.
- A reusable database answer to "does the signed-in account have a content role?", for the app and
  for the row level security policies of later content tables.
- `/admin` and every path under it: the admin shell for an account with a role; the normal 404 for
  everyone else (signed in or not), so the admin is not advertised.
- The shell: the prototype's left menu with group headings and small page ids, the product name and
  "Content admin", and Sign out. Tokens from `DESIGN.md` only; 360 px wide without sideways scroll.

## Non-goals
Any content editing; an invite or role screen; different rights for admin and writer (both open the
whole shell for now); the other prototype pages (ADM-01 to ADM-06, ADM-08 to ADM-11, ADM-13).

## Anti-goals
- A service-role key anywhere in the app.
- A check that only runs in the browser.
- A signed-out or no-role visitor learning that `/admin` exists (a redirect to sign-in, a "forbidden"
  page or a different response than an unknown page would).

## Decided
| Item | Decision |
|---|---|
| Table | `public.content_roles`: `user_id uuid` primary key referencing `auth.users(id) on delete cascade`, `role text not null check (role in ('admin', 'writer'))`, `granted_at timestamptz not null default now()`. Deleting an account (`delete_my_account`) removes its role through the cascade |
| Access | Row level security on with no policy, and `revoke all ... from anon, authenticated`: no account can read or change it through the API |
| Role answer | `public.content_role() returns text`: `security definer`, `stable`, `set search_path = ''`, returns the role of `auth.uid()` or null. `public.is_content_editor() returns boolean`: true when `content_role()` is not null. Both: `revoke all ... from public`, `grant execute ... to authenticated`. A later policy writes `using (public.is_content_editor())` or `public.content_role() = 'admin'` |
| Granting | One SQL command in the Supabase SQL editor, documented in `docs/deploy.md`: an `insert ... select id, '<role>' from auth.users where email = '...' on conflict (user_id) do update set role = excluded.role`. Removing: one `delete` |
| Server check | `src/lib/admin/` reads `content_role()` through the signed-in user's own Supabase client (`rpc`). Any error or unknown value counts as no role |
| Where it runs | Twice, both on the server. The proxy (`src/proxy.ts` → `updateSession`) answers every `/admin` path: no user or no role → the app's normal 404 page with status 404 (a rewrite to a path that does not exist), never the sign-in redirect. The admin layout checks again and calls `notFound()` (defence if the proxy matcher ever misses a path). The database itself never hands rows to a no-role account in later tables |
| Shell | `src/app/admin/layout.tsx` (server) wraps the pages in `AdminShell`: a rail with the brand ("WaveParticle", "Content admin" below), group "Content" with App text `ADM-07` (`/admin/app-text`), group "Review and logs" with Publish history `ADM-12` (`/admin/publish-history`), the current page marked with `aria-current="page"`, and Sign out (the existing browser sign-out, then `/auth/sign-in`). `/admin` itself is an overview page in the shell; the two menu pages are placeholders that say they arrive with #288 and #289 |
| App header and tab bar | Hidden inside the admin: the app shell's width limit and header give way only when the admin shell is on the page (CSS `:has(.admin-shell)`), so the 404 page for `/admin` looks exactly like any other 404 page |
| Layout | Wide screens: rail left (its own width token), content right. Phone (below the wide breakpoint): brand and Sign out on top, then the menu as a wrapping row without group headings and ids (as the prototype hides them), then the page. No sideways scroll at 360 px, also checked at 320 px with 200% text (`e2e/large-text.spec.ts`) |
| Look | `DESIGN.md` tokens only (no prototype teal, no IBM Plex or Fraunces): `--raised` rail with a `--hairline` divider, current item on `--tint` with `--ink` text weight 800, ids in `--type-mono` at caption size in `--ink-2`, group headings as the small upper-case label, the display face for the brand and titles |
| Tests | Unit (`tests/admin-roles.test.ts`): the migration text (table, RLS, revokes, function attributes, grants, no service role), the role reader (`rpc` result and errors), the admin path rule, the proxy answer, deploy and architecture docs. E2E (`e2e/admin.spec.ts`) through the Supabase stub, which learns `rpc/content_role` and a seeded role: 404 for signed out, for a no-role account on `/admin` and a path under it; the shell for a writer and an admin; no sideways scroll at 360 px |

## Approaches considered
1. **Security-definer role function, checked in the proxy and the layout with the user's session
   (chosen).** No service-role key; the same function serves later RLS policies; one round trip per
   admin request.
2. A select policy letting each account read its own `content_roles` row. Works for the app, but RLS
   policies on later tables would need the same subquery each time, and the table becomes readable
   through the API, which the issue rules out.
3. Role in the JWT (`app_metadata` or a custom access token hook). No query per request, but granting
   needs the auth admin API or a hook to set up, and a role change waits for the token to refresh.

## Left to the builder
File and component names inside `src/app/admin/` and `src/lib/admin/`, the overview page text, the
exact breakpoint, and the stub's seed field name.
