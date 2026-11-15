# Admin area with admin and writer roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin` opens a token-styled admin shell for accounts with the `admin` or `writer` role and answers the normal 404 to everyone else, with the role kept in an API-unreachable table and answered by a reusable security-definer function.

**Architecture:** A migration adds `public.content_roles` and `content_role()` / `is_content_editor()`. `src/lib/admin/` reads the role through the user's own Supabase client; the proxy answers 404 for `/admin` paths without a role, and the admin layout checks again. A client `AdminShell` draws the rail and pages.

**Tech Stack:** Next.js 16.4 App Router (`cacheComponents`), `@supabase/ssr`, Postgres, Vitest, Playwright with `e2e/support/stub-supabase.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-15-admin-roles-design.md`

## Global Constraints
- No service-role key in application code; the check runs on the server with the signed-in user's session.
- No role or not signed in: status 404 on `/admin` and every path under it, the same page as an unknown path.
- UI uses `DESIGN.md` tokens only (no hex, rgba, font names or raw spacing in `globals.css`); no sideways scroll at 360 px.
- English only. Commits `feat: ... (#287)` ending with the Co-Authored-By line.

## Review Focus
1. A role read that errors (function missing before the migration runs, network) must give 404, not 500 or the shell — Task 2 test `test_287_ac4_a_failed_role_read_counts_as_no_role`.
2. `/admin-anything` (not under `/admin/`) must not be treated as admin — Task 2 test `test_287_ac2_only_admin_and_paths_under_it_are_admin_paths`.
3. A signed-out visitor at `/admin` must get 404, not the sign-in redirect — Task 3 e2e `test_287_ac2_signed_out_gets_404`.
4. The 404 for `/admin` must not lose the app header (it would differ from other 404 pages) — header hiding is CSS `:has(.admin-shell)`, checked in Task 3 e2e by the header being visible on the 404.
5. An unexpected role value from the database (for example `owner`) counts as no role — Task 2 test in the reader.

---

### Task 1: Roles table and role functions

**Files:**
- Create: `supabase/migrations/20261116000000_content_roles.sql`
- Modify: `tests/prompts-migration.test.ts` (its "latest migration" test becomes "after the delete-account migration", the server-progress test's style; a new migration necessarily follows it)
- Test: `tests/admin-roles.test.ts`

**Interfaces:**
- Produces: `public.content_roles(user_id uuid pk → auth.users on delete cascade, role text check in ('admin','writer'), granted_at timestamptz)`; `public.content_role() returns text`; `public.is_content_editor() returns boolean`.

- [ ] Step 1: tests `test_287_ac1_creates_the_roles_table_with_admin_and_writer`, `test_287_ac1_row_level_security_is_on_and_the_api_cannot_reach_the_table` (enable RLS, no `create policy`, `revoke all on public.content_roles from anon, authenticated`), `test_287_ac1_content_role_is_a_security_definer_function_with_a_fixed_search_path` (`security definer`, `set search_path = ''`, `auth.uid()`, revoke from public, grant execute to authenticated), `test_287_ac1_is_content_editor_answers_from_content_role`, `test_287_ac4_no_service_role_key_is_mentioned`, `test_287_is_the_latest_migration`. Run `npx vitest run tests/admin-roles.test.ts`: FAIL (file missing).
- [ ] Step 2: write the migration; adjust the prompts test. Run the two test files: PASS. Commit.

### Task 2: Server role check and proxy answer

**Files:**
- Create: `src/lib/admin/roles.ts`
- Modify: `src/lib/supabase/session.ts` (`updateSession`)
- Test: `tests/admin-roles.test.ts`

**Interfaces:**
- Produces: `type ContentRole = "admin" | "writer"`; `isAdminPath(pathname: string): boolean`; `readContentRole(client: SupabaseClient): Promise<ContentRole | null>` (calls `client.rpc("content_role")`; error, null or other value → null); `adminAnswer(pathname, hasUser, role): "pass" | "not-found"` used by `updateSession`, which rewrites `"not-found"` to `/_admin-not-found` (no such route, so Next renders its 404 with status 404) before the sign-in redirect rule.

- [ ] Step 1: tests `test_287_ac2_only_admin_and_paths_under_it_are_admin_paths` (`/admin`, `/admin/app-text` true; `/administer`, `/`, `/me` false), `test_287_ac4_reads_the_role_through_the_users_own_client` (fake client `rpc` returns `{data:"writer"}` → `"writer"`, called with `"content_role"`), `test_287_ac4_a_failed_role_read_counts_as_no_role` (`{error}`, throw, `"owner"`, `null` → null), `test_287_ac2_no_user_or_no_role_gets_not_found` and `..._a_role_passes` for `adminAnswer`, `test_287_ac4_the_check_is_server_code_only` (`roles.ts` has no `"use client"`, `session.ts` calls `readContentRole`). FAIL.
- [ ] Step 2: implement. PASS. Commit.

### Task 3: Admin shell, pages and stub

**Files:**
- Create: `src/app/admin/layout.tsx` (server: `connection()`, user, role, `notFound()`, renders `AdminShell`), `src/app/admin/admin-shell.tsx` (client: rail, `aria-current`, sign out), `src/app/admin/page.tsx`, `src/app/admin/app-text/page.tsx`, `src/app/admin/publish-history/page.tsx`
- Modify: `src/app/auth/auth-form.tsx` (`SignOutButton` takes an optional `className`), `src/app/globals.css` (admin styles; `.app-shell:has(.admin-shell)` drops the phone width and hides `.app-header`), `src/app/tokens.css` (`--admin-rail-width`, `--admin-wide` not possible in media queries, so the breakpoint is written in rem), `e2e/support/stub-supabase.mjs` (seed `contentRole`, `POST /rest/v1/rpc/content_role`), `e2e/support/account.ts` (option `contentRole`), `e2e/large-text.spec.ts` (`/admin` with a writer)
- Test: `e2e/admin.spec.ts`, `tests/admin-roles.test.ts`

- [ ] Step 1: e2e tests `test_287_ac2_signed_out_gets_404` (`/admin`, `/admin/app-text`: status 404), `test_287_ac2_signed_in_without_a_role_gets_404` (same, header visible, no "Content admin"), `test_287_ac3_a_writer_sees_the_admin_shell` (navigation "Admin pages" with group headings "Content" and "Review and logs", links App text with ADM-07 and Publish history with ADM-12, "WaveParticle" and "Content admin", button Sign out, no tab bar; clicking App text marks it current and shows the #288 placeholder), `test_287_ac3_an_admin_sees_the_admin_shell`, `test_287_ac5_no_sideways_scroll_at_360_px` (scrollWidth ≤ 360 on all three pages), `test_287_ac3_sign_out_leaves_the_admin`; unit `test_287_ac5_admin_styles_use_tokens_only` (admin block of globals.css has no hex/rgba/px font sizes). FAIL.
- [ ] Step 2: implement stub, shell, pages, CSS. Run `npm run test:e2e -- admin large-text`: PASS. Commit.

### Task 4: Docs

**Files:**
- Modify: `docs/deploy.md` (section "Admin roles": the grant and remove commands), `docs/architecture.md` (Admin area row, data model paragraph), `docs/api/README.md` if it lists functions
- Create: `docs/decisions/0016-content-roles-checked-on-the-server.md`
- Test: `tests/admin-roles.test.ts` `test_287_ac6_deploy_says_how_to_give_a_role` (one `insert into public.content_roles` command), `test_287_ac6_architecture_lists_the_admin_area`

- [ ] Step 1: tests FAIL; Step 2: docs; PASS. Commit.

### Task 5: Verify and ship
- [ ] `npm test`, `npm run test:e2e`, `npm run lint`, `npm run format:check`, `npm run build`; screenshots at 360 px and 1280 px; merge `origin/main`; PR; issue comment.
