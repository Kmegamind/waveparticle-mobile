# Story card editing (#304) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In ADM-06 an admin or writer edits story cards (as drafts) and part titles; every save runs the card checks; only the admin role publishes a passing draft; publish and roll back write `story_card` rows to the publish history.

**Architecture:** One migration adds the write functions, mirroring app text (#288, #289): `save_story_card_draft`, `save_story_part_title`, `publish_story_card`, `roll_back_story_card` over `private.set_published_story_card`, which writes the history row in the same transaction. Checks live in TypeScript (`src/lib/story-cards/checks.ts`); the server action re-runs them on the stored draft before calling publish. The phone read (`get_story_cards`, #300) is not changed.

**Tech Stack:** Next.js 16 server actions, Supabase RPC, Vitest (SQL tested as text), Playwright with the Supabase stub.

**Spec:** issue #304 and Yue's approval of 2026-11-17 (in the conversation): per-part spoiler words, part titles saved directly with no versions, the two published cards with years stay live and show as failing, the server re-runs the checks before Publish, only the admin role publishes.

## Global Constraints
- LEN-CARD: a part card 1 to 3 sentences and at most 45 words; the background card at most 70 words.
- DATES-ADMIN-ONLY: no year, date or age in a card.
- LEAK-BY-PART: a card in part p fails on any `leaks` word of a story-input slice whose cards sit in a part after p; the background card counts as before part 1.
- Banned words: the `BANNED` pattern of `src/lib/model-gateway/checks.ts`.
- Publish and roll back: admin role only (button, server action, database). Save draft and part titles: admin or writer.
- No service-role key; every call runs as the signed-in user. No change to the phone screens or to `get_story_cards`.

## Review Focus
- A draft saved, then the published version changes by roll back: the draft must not be shown as "published" and a rolled-back-past version must read "Earlier version". (Task 2 test)
- A writer calling the publish server action directly: refused with "not-allowed" before any RPC. (Task 2 test)
- A draft that fails a check published by a direct action call: refused with "checks-failed". (Task 2 test)
- Story inputs that cannot be read (content key missing): the page still shows cards, says the spoiler check could not run, and Publish stays disabled. (Task 2 test)
- Leak words matched inside longer words ("films" in "filmstrip"): matched on word boundaries only. (Task 1 test)

---

### Task 1: Card checks

**Files:** Create `src/lib/story-cards/checks.ts`; modify `src/lib/model-gateway/checks.ts` (export `BANNED`); test `tests/story-card-checks.test.ts`.

**Produces:**
- `datesProblems(text: string): string[]` (year 1500–2099 with optional "s", month-day dates, d/m numbers, ages such as "38 years old", "aged 38", "at the age of 38").
- `laterPartLeaks(stageZero: Record<string, unknown>, slicePart: Map<string, number>, part: number | null): string[]`.
- `cardProblems(card: { kind: "background" | "part"; part: number | null; body: string }, laterLeaks: string[] | null): string[]` — length problems (`cardLengthProblems`), dates, leaks (`Mentions "x", which comes in a later part.`), banned words; `laterLeaks === null` adds `The spoiler check could not run: the story inputs could not be read.`

- [ ] Tests: year "1943" fails, "1940s" fails, "May 3" fails, "38 years old" fails, "forty" alone passes; leak on word boundary only; background checks every part; part 4 card checks nothing; banned "vibes" fails; null leaks gives the could-not-run problem; the Cross-Examination card with 1939 fails.
- [ ] Run, see them fail; implement; run, pass; commit.

### Task 2: Admin view and writes

**Files:** Modify `src/lib/story-cards/admin.ts`, `src/lib/story-cards/reader.ts` (read `published_at`); create `src/lib/story-cards/write.ts`; test `tests/story-cards-admin.test.ts`, `tests/story-card-writes.test.ts`.

**Produces:**
- `StoryCardRow` gains `published_at: string | null`.
- `StoryCardView` gains `kind`, `published: {version, body} | null`, `draft: {version, body} | null`, `versions: {version, body, state: "published"|"draft"|"earlier", canRollBack}[]`; `problems` are the checks of the draft when there is one, else of the published body; `publishBlocked: string | null`.
- `storyDetail(story, parts, cards, laterLeaksFor?: (part: number | null) => string[] | null)`.
- `writeStoryCard(write: StoryCardWrite, deps): Promise<StoryCardWriteResult>` with `StoryCardWrite = {kind:"save"; key; body} | {kind:"publish"|"roll_back"; key; version} | {kind:"title"; storyId; part; title}` and errors `"not-allowed"|"invalid"|"blank"|"too-long"|"checks-failed"|"failed"`. Publish reads the version's row through `deps.readCard(key, version)` and refuses `checks-failed` when `cardProblems` is not empty.

- [ ] Tests from Review Focus plus: writer may save and set titles; writer publish refused before rpc; admin publish of passing draft calls `publish_story_card`; body over 2000 chars refused; title blank refused.
- [ ] Fail, implement, pass, commit.

### Task 3: Migration

**Files:** Create `supabase/migrations/20261123000000_story_card_editing.sql`; test `tests/story-card-editing-migration.test.ts`.

Adds `created_by`, `published_by` to `story_cards`; `save_story_card_draft(card_key text, card_body text) returns integer` (editor, advisory lock, copies story_id/kind/part/slice/position from the key's newest row, unknown key raises P0002); `save_story_part_title(story text, part_number integer, part_title text)` (editor, update only an existing row); `private.set_published_story_card(card_key, card_version, publish_action)` (same rules as app text, history insert kind `story_card`); `publish_story_card` and `roll_back_story_card` require `public.content_role() = 'admin'`; widens `publish_history_kind_check` to `('app_text','story_card')`; replaces `list_publish_history` with a `story_card` branch for `is_current`. Does not touch `get_story_cards`.

- [ ] Text tests for each of the above, including "get_story_cards is not redefined" and "drafts are inserted with published false and no published_at".
- [ ] Fail, write, pass, commit.

### Task 4: Screens, history and stub

**Files:** Create `src/app/admin/stories/actions.ts`, `src/app/admin/stories/[id]/card-editor.tsx`, `src/app/admin/stories/[id]/part-title-editor.tsx`; modify `src/app/admin/stories/[id]/page.tsx`, `src/lib/publish-history/admin.ts` (kind `story_card`: "Story card"), `src/app/admin/publish-history/actions.ts`, `e2e/support/stub-supabase.mjs`; tests `tests/story-cards-pages.test.ts` (replace the #293 read-only test with #304 rules), `tests/publish-history-admin.test.ts`, `e2e/story-card-editing.spec.ts`.

- [ ] e2e: writer saves a draft → v2 draft shown, problems listed, Publish absent with "An admin publishes"; admin saves a failing draft → Publish disabled with the reason; admin saves a passing draft, publishes → history row "Story card" → Roll back to v1; the phone read (`get_story_cards`) still returns v1 for a session pinned to v1; writer renames a part title.
- [ ] Fail, implement, pass, commit.

### Task 5: Docs and production setup

**Files:** `docs/architecture.md`, `docs/deploy.md`, `docs/decisions/0023-story-card-editing.md`, `2_Areas/Product/content-admin/production-setup-story-card-editing_2026-11-17/` (README, `1-story-card-editing.sql` = the migration, `2-check-it-worked.sql`).
