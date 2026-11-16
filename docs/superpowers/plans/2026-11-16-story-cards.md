# Story cards in Supabase and a read-only Stories page (#293) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the 26 Oppenheimer stories' pre-written cards (and part titles) in Supabase as version 1, published, and show them read-only on ADM-06 Stories to admins and writers.

**Architecture:** One migration adds `public.story_parts` and `public.story_cards` (versioned like `app_text`, one published version per key), readable through the API by content editors only. A seed copy of `story-decks.json` and `scripts/story-cards/import.mjs` print idempotent SQL. `src/lib/story-cards/admin.ts` turns rows into the page's view (counts, grouping, CARD-LENGTH checks); `/admin/stories` and `/admin/stories/[id]` read through the signed-in user's own client. No phone screen changes.

**Tech Stack:** Next.js 16 (cacheComponents), Supabase Postgres + RLS, Vitest, Playwright with the Supabase stub.

**Spec:** GitHub issue #293 (acceptance criteria) and Yue's build instruction of 2026-11-16; decisions SHARED-STORY, CARDS-PER-PART, CARD-LENGTH, LEN-CARD, NAMING, STORY-PARTS in `docs/DECISIONS.md`.

## Global Constraints

- Keys: part card `crd.<story>.<part>.<slot>`, background `crd.<story>.bg` (frozen). `<story>` is `opp.<story id>` (NAMING: stories `<short>.<slug>`), `<part>` is `p<n>`, `<slot>` is `c<order within the part>` (the deck's slices repeat inside a part, so the slice cannot be the slot).
- CARD-LENGTH: part card 1–3 sentences and at most 45 words; background card at most 70 words. Over the limit = shown as failing; nothing blocks.
- Import as version 1, published; the deck `story1` is skipped; running twice changes nothing.
- Cards are AI-written drafts nobody has read: the admin page says so.
- Roles admin or writer see the page; everyone else gets the normal 404 (existing proxy and layout).
- Read-only: no editing, publishing, regenerating, publish_history rows, closing line.
- The phone keeps its current card source: no app code outside the admin reads `story_cards`.
- No service-role key; non-editors read no card or part row through the API.

## Review Focus

1. Sentence counting on "Mrs. Kennedy" and quotes (`."`, `.”`): must not count an honorific as a sentence end — test in Task 2.
2. A card row whose story is missing from `stories` (FK) — the import must name the story, not fail obscurely — test in Task 1 (import refuses unknown story ids only when given the list; the FK protects the database).
3. Re-import after a later version exists — inserts nothing for that key — test in Task 1 (SQL `where not exists` on key).
4. A story with no cards rows (table empty or read failed) — the list still shows 26 stories with 0, and a notice on a read failure — test in Task 2/3.
5. A card text containing a quote or backslash — stored literally — test in Task 1.

---

### Task 1: Migration, seed copy and import script

**Files:** Create `supabase/migrations/20261120000000_story_cards.sql`, `src/content/oppenheimer/story-decks.json` (verbatim copy), `scripts/story-cards/import.mjs`; Test `tests/story-cards-migration.test.ts`, `tests/story-cards-import.test.ts`.

**Interfaces — Produces:** `readStoryDecks(file?) → object`, `storyCardRows(decks, storyIds?) → { parts: PartRow[], cards: CardRow[] }`, `storyCardsImportSql(rows) → string`, `cardKey(storyId, part?, slot?) → string`.

- [ ] Tests first: table columns (key, version, story_id fk → stories, kind background|part, part, slice, position, body, published, published_at, created_at, …), key check pattern, consistency check (background ⇒ part/slice null), one-published unique index, RLS on, select policy `is_content_editor()` only, no anon grant, no write grants; `story_parts` (story_id, part, title) same access. Import: 26 stories, 26 backgrounds, 251 part cards, keys, `story1` skipped, SQL inserts `where not exists` by key, part titles `on conflict do nothing`, quoting literal.
- [ ] Run, see them fail; implement; run, see them pass; commit `feat: story cards table, seed and import (#293)`.

### Task 2: Admin view model

**Files:** Create `src/lib/story-cards/admin.ts`; Test `tests/story-cards-admin.test.ts`.

**Interfaces — Produces:** `cardLengthProblem(kind, text) → string | null`, `storyList(stories, parts, cards) → StoryListRow[]` (story order, parts and cards counts), `storyDetail(story, parts, cards) → StoryDetail | null` (background, parts in order with title and cards in order, each card's key, slice, version, words, problem). Shows the published version of each key, else the newest.

- [ ] Tests first (lengths at 45/46 words, 70/71 for background, 4 sentences, "Mrs." not a sentence end, grouping, counts, missing data); fail; implement; pass; commit.

### Task 3: ADM-06 pages, menu, stub and e2e

**Files:** Create `src/app/admin/stories/page.tsx`, `src/app/admin/stories/[id]/page.tsx`; Modify `src/app/admin/admin-shell.tsx`, `src/app/globals.css` (admin classes, tokens only), `e2e/support/stub-supabase.mjs`, `e2e/admin.spec.ts` paths; Create `e2e/story-cards.spec.ts`; Test `tests/story-cards-pages.test.ts` (phone source unchanged guard, "unreviewed drafts" notice, menu entry).

- [ ] Tests first; fail; implement; pass; e2e: writer sees 26 rows and a story's parts; no role gets 404; commit.

### Task 4: Docs and production files

Decision record `docs/decisions/0020-story-cards-in-the-database.md`, architecture, deploy and data docs; production folder `2_Areas/Product/content-admin/production-setup-story-cards_2026-11-16/` with `1-story-cards-tables.sql`, `2-story-cards-starting-data.sql`, `3-check-it-worked.sql`, README.
