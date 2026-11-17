# Pre-made story cards on the focus page (#300) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The signed-in focus page shows a story's published pre-made cards, spread across the user's Steps, pinned to the versions the session first read; no model call for cards.

**Architecture:** A keyed security-definer function `get_story_cards(reader_key, story, versions)` (same `CONTENT_READ_KEY` as #284) returns a story's published cards, or the pinned versions. `src/lib/content` parses it into a deck; `spreadCards` in `src/lib/story/start.ts` spreads the deck across Steps; `src/lib/progress/premade-cards.ts` pins `sessions.card_versions` on first read and answers the focus page's existing `loadStepCards` contract. `/try` keeps its live cards.

**Tech Stack:** Next.js 16, Supabase Postgres, Vitest, Playwright with the Supabase stub.

**Spec:** issue #300 and Yue's build instruction of 2026-11-16 (CARDS-PER-PART, CARDS-SPREAD, FAIL-PREMADE; CARDS-SPREAD and FAIL-PREMADE are being recorded by #298).

## Global Constraints

- Published rows only, read by the server with the reader key; the browser never reads `story_cards` or `story_parts`.
- No card dropped; T7's 1–5 limit no longer cuts pre-made cards (it stays for /try's live cards).
- Background card first, as the opening card of Step 1; no special Step-start or 00:00 card.
- Read failure or no published cards → existing failure screen with Retry, clock not started (FAIL-PREMADE).
- Still live and unchanged: pause message, stuck situation, rest conversation, return pop-up, goal split, closing line. `step_cards` prompt stays in the table.
- No admin editing/publishing, no styling changes, /try unchanged.

## Review Focus

1. More Steps than part cards (plans allow 50 Steps; stories have 8–12 cards) — every card shown once in order, later Steps repeat the last card rather than failing — test in Task 2.
2. A card edited and republished during a session — the session keeps showing the pinned version — test in Task 3/4.
3. Two Step requests racing to pin — both end with the same versions — test in Task 4 (conditional update, re-read).
4. A pinned version missing from the table — failure screen, not a partial deck — test in Task 4.
5. A request for another account's session id — failed (RLS read returns nothing) — test in Task 4.

---

### Task 1: Migration — card versions on sessions and the keyed reader
Files: `supabase/migrations/20261121000000_premade_cards.sql`; test `tests/premade-cards-migration.test.ts`.
- `alter table public.sessions add column card_versions jsonb check (card_versions is null or jsonb_typeof(card_versions) = 'object')`.
- `public.get_story_cards(reader_key text, story text, versions jsonb default null) returns json`, security definer, `set search_path = ''`; null unless `encode(extensions.digest(...))`/the same key check as `get_story_content`; returns `{ "cards": [{key, version, kind, part, position, body}] }` ordered by kind, part, position — published rows when `versions` is null, otherwise rows whose `(key, version)` is in `versions`. Granted to anon, authenticated; revoked from public.
- Verify in PGlite.

### Task 2: `spreadCards` (CARDS-SPREAD)
File: `src/lib/story/start.ts`; test `tests/spread-cards.test.ts`.
- `spreadCards<T>(deck: { background: T; parts: T[][] }, stepCount: number): { opening: T; story: T[] }[]`.
- Steps ≤ parts: whole parts grouped into contiguous Steps, extra parts to earlier Steps. Steps > parts: each part gets ≥1 Step, extra Steps go to the part with the most cards per Step that can still split; a part's cards split evenly, earlier Steps larger. Step 1 opening = background, story = its cards; Step k>1 opening = its first card, story = the rest. More Steps than cards: one card per Step in order, later Steps' opening = the last card, story [].

### Task 3: Deck read through the content interface
Files: `src/lib/content/story-deck.ts` (`StoryDeck`, `DeckCard`, `parseStoryDeck(doc) → StoryDeck | null`, `deckVersions(deck) → Record<string, number>`), `readStoryCardsFromSupabase({ storyId, versions, env?, fetchImpl? })` in `src/lib/content/repository.ts`; test `tests/story-deck.test.ts`.
- null deck when there is no background or no part card; throws on malformed rows.

### Task 4: Account cards from the deck, pinned
Files: `src/lib/progress/premade-cards.ts` (`premadeStepCards(raw, deps) → StepCardsResponse`), `src/app/focus/actions.ts`, `src/app/focus/account-focus.tsx`, `src/lib/progress/account-lines.ts` (remove `accountStepCards`), `src/lib/prototype/session.ts` (`setStepCards` keeps every card), `src/lib/prototype/focus-cards.ts` (/try applies `maxStoryCards`), `src/lib/progress/focus-session.ts` (card lines source `authored`); tests `tests/premade-step-cards.test.ts`, updates in `tests/signed-in-focus.test.ts`, `tests/story-content-unavailable.test.ts`, `tests/prototype-focus-session.test.ts`.
- deps: `readSession(sessionId) → { storyId, stepCount, cardVersions } | null`, `pinVersions(sessionId, versions) → Promise<void>` (update where `card_versions is null`), `readDeck(storyId, versions | null) → Promise<StoryDeck | null>`.
- No gateway in the signed-in card path.

### Task 5: Stub, e2e, docs, production files
- Stub: `get_story_cards` from the seed deck (published v1), fail toggle; e2e: signed-in /focus shows the background card; failure screen with Retry and the full clock when the read fails.
- Docs: `docs/decisions/0021-premade-cards-on-the-focus-page.md`, architecture, deploy, data; production folder `2_Areas/Product/content-admin/production-setup-premade-cards_2026-11-16/`.
