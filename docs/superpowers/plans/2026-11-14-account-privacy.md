# Account and privacy pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Privacy notice, About the stories, Terms, Data, Export and Delete for the signed-in account.

**Architecture:** One migration adds `delete_my_account()`; a server action calls it through the user's client and signs out. Export is a route handler reading the six tables through the user's client. Pages are server components in the Me style.

**Tech Stack:** Next.js 16, Supabase, Vitest, Playwright with the Supabase stub.

**Spec:** `docs/superpowers/specs/2026-11-14-account-privacy-design.md`

## Global Constraints
- No model calls, prompts or caps; do not touch `src/app/{focus,rest,goal}`, `src/app/_session`, `src/app/companions`.
- Tokens only; reuse `me-page`, `me-row`, `life-back`, `home-card`, `button-filled`, `button-gray`.
- Notice copy states only the spec's facts; every legal-sounding sentence is listed in the PR as a draft.
- `src/app/*/page.tsx` keeps `<h1` and `app-screen` where existing shell checks require it.

## Review Focus
1. Deletion when the function is missing (migration not applied): the page shows an error in words, the user stays signed in, nothing is half-deleted. Test in Task 1.
2. A signed-out request to the export route: 401 or redirect, never another account's data. Test in Task 2.
3. Export for an account with no Goals: a valid file with empty lists. Test in Task 2.
4. Double tap on Delete account: one request; the button is disabled while pending. Test in Task 1.
5. `/terms` and `/privacy` open signed out. Test in Task 3.

---

### Task 1: Delete my account
**Files:** `supabase/migrations/20261114120000_delete_my_account.sql`, `src/lib/account/delete-account.ts`, `src/app/me/delete-account/{page.tsx,delete-account-screen.tsx,actions.ts}`, `src/app/auth/sign-in` (deleted message), `e2e/support/stub-supabase.mjs`, `e2e/support/account.ts`.
**Produces:** `deleteAccount(deps: { userId: string | null; rpc: () => Promise<{ error: unknown }>; signOut: () => Promise<unknown> }): Promise<{ status: "deleted" | "signed-out" | "failed" }>`; `deleteAccountAction(): Promise<{ status: "failed" | "signed-out" }>` that redirects to `/auth/sign-in?deleted=1` on success.
- [ ] Failing tests: `tests/delete-account.test.ts` — migration defines `public.delete_my_account()` `security definer` with `set search_path = ''`, deletes from all six tables filtered by `auth.uid()` before `auth.users where id = auth.uid()`, `revoke ... from public, anon`, `grant execute ... to authenticated`; `deleteAccount` returns `signed-out` without a user and never calls rpc, `failed` and no signOut when rpc errors, `deleted` after rpc then signOut; screen renders "Delete your account", "Keep my account" link to `/me/data`, "Delete account" button; sign-in with `deleted=1` shows "Your account and your data are deleted." E2E `e2e/account-data.spec.ts`: delete flow empties the six tables for that user, keeps another user's row, the user can no longer reach `/me`.
- [ ] Implement. Commit `feat: delete my account (#103)`.

### Task 2: Export my data
**Files:** `src/lib/account/export.ts`, `src/app/me/export/{page.tsx,download/route.ts}`.
**Produces:** `readAccountExport(client, user: { id: string; email: string | null }, now: Date): Promise<AccountExport>`; `exportFileName(now: Date): string` → `waveparticle-data-YYYY-MM-DD.json`.
- [ ] Failing tests: `tests/account-export.test.ts` — reader asks each table with the user's filter (ids chunked by 100), returns empty lists for a new account, throws on a read error; file name; route returns 401 without a user, otherwise `application/json` with `Content-Disposition: attachment`. E2E: the Export screen's link downloads a file whose goals and steps match the seed.
- [ ] Implement. Commit `feat: export my data (#103)`.

### Task 3: Privacy notice, Terms, About the stories, Data, Me rows
**Files:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/me/about/page.tsx`, `src/app/me/data/page.tsx`, `src/app/me/me-screen.tsx`, `src/lib/supabase/session.ts`.
- [ ] Failing tests: `tests/account-pages.test.ts` — notice has a date, says what is stored (Goals, Steps, history, his lines), that the Goal text and rest messages are sent to the language model and nothing else of the user's, that the safety check sends nothing and logs hold no words, that retention is not decided, and contains no "placeholder"/"not written yet"; About states the lines are imagined and he is an AI and links `/terms`; Terms state AI and "not a medical or crisis service"; Data links `/privacy`, `/me/export`, `/me/delete-account`; Me links `/me/about` and `/me/data`; `isPublicPath("/terms")` true. E2E: Me → Data → Privacy notice; `/terms` and `/privacy` open signed out.
- [ ] Implement. Commit `feat: privacy notice, Terms and About the stories (#102, #104)`.

### Task 4: Check, compare, document
- [ ] Unit, lint, format, e2e; screenshots of ME, DATA, ACCOUNT-DELETE day and night next to the prototype in `docs/design/prototype/pr-103/`.
- [ ] Docs: architecture, api, known-issues (migration to apply). Merge origin/main; PR closing #103.
