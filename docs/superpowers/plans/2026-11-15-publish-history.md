# Publish history Implementation Plan

**Goal:** Write one `public.publish_history` row in the same transaction as every app text publish
and roll back, and list the rows with a Roll back button at `/admin/publish-history` (ADM-12).

**Spec:** `docs/superpowers/specs/2026-11-15-publish-history-design.md`

## Global Constraints
- No service-role key; the database checks `public.is_content_editor()`.
- The #288 migration is not edited; `20261118000000_publish_history.sql` replaces the private
  publish function.
- `DESIGN.md` tokens only; no sideways scroll at 360 px (and 320 px at 200% text).
- Commits `feat: … (#289)` ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: Migration (tests first: `tests/publish-history-migration.test.ts`)
Table, index, row level security, select policy, revokes, `list_publish_history`, the replaced
`private.set_published_app_text` with the insert and the wider roll back rule.

### Task 2: Data layer (tests first: `tests/publish-history-admin.test.ts`)
`src/lib/publish-history/admin.ts`: `publishHistoryEntries(rows)` (labels, person, time, newest
first, roll back only when not current and the kind is known), `readPublishHistory(rpc)` and
`rollBackHistoryItem(item, handlers)`.

### Task 3: App text label fix (tests first in `tests/app-text-admin.test.ts`)
A version published before is "Earlier version" with Roll back; the newer draft is never one that was
published before.

### Task 4: Page and action
`src/app/admin/publish-history/page.tsx`, `actions.ts`, `roll-back-button.tsx`, CSS with tokens.

### Task 5: Stub and e2e (tests first: `e2e/publish-history.spec.ts`)
The Supabase stub writes history rows on publish and roll back and answers
`list_publish_history` to editors only (403 otherwise); reset by key so parallel files do not meet.

### Task 6: Docs and verify
`docs/deploy.md`, `docs/api/README.md`; `npm test`, `npm run test:e2e`, `npm run lint`,
`npm run format:check`, `npx tsc --noEmit`, `npm run build`.
