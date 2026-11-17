# Companion and story fields (#309) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins and writers edit Companion and story display fields as drafts; only the admin role publishes or rolls back, with a publish history row each time.

**Architecture:**
- **One versions table, `public.content_fields`,** in the shape of `app_text`, with role-checked `security definer` functions.
- **Publish copies the text** into the `companions` or `stories` column that `get_story_content` already reads.
- **App-side checks** live in a pure module, run on save and again before publish. The database re-checks the role and the period rules.

**Tech Stack:** Next.js 16 server actions, Supabase RPC, Vitest (SQL tested as text) and Playwright with the stub Supabase.

**Spec:** `docs/superpowers/specs/2026-11-17-companion-story-fields-design.md`

## Global Constraints
- Every save is refused when its text has a year, date or age, using `datesProblems` from `src/lib/story-cards/checks.ts`.
- Publish and roll back are for `content_role() = 'admin'` only. Saves are for `is_content_editor()`.
- No service-role key. No change to `get_story_content` or to any phone screen.
- Don't edit the #304 card editor files (`src/app/admin/stories/**`, `src/lib/story-cards/write.ts`).
- Opening suffix: `What are you working on?` (`OPENING_QUESTION`, `scripts/content/content-files.mjs`).
- Product words: Companion, Goal, Step. English only. `DESIGN.md` tokens, using only the existing admin classes.

## Review Focus
1. A story moved to a neighbouring period, then that period renamed: the story must follow the new name.
2. The only story of a period chooses another period: it must be refused, because the period would disappear.
3. A period renamed to the name of another period: it must be refused, because the two would merge.
4. A writer calls publish through the action directly: it must be refused before any database call.
5. A field whose column is blank (the two new fields) is saved for the first time: there must be no empty version 1, and the draft is version 1.

---

### Task 1: Field rules (pure)
**Files:**
- Create: `src/lib/content-fields/fields.ts`
- Test: `tests/content-fields.test.ts`

**Produces:**
- `FieldKey` parsing: `parseFieldKey(key): {item:"companion"|"story", code, storyId?, field, period?} | null`.
- `FIELD_LIMITS` (name 120, tags 200, who 600, period 80, title 120, goal 400, opening 600, path 400).
- `periodsOf(stories: {id, sequence, period}[]): {number, name, storyIds}[]`.
- `periodChoices(stories, storyId): string[]`: its own period, plus the previous period when it is the first of its period, plus the next when it is the last, never one that would leave its own period empty.
- `fieldProblems(field, text, context): string[]`. The context gives the period choices, or the other period names for a rename.

Tests:
- `test_309_ac2_blank_long_and_dated_text_is_refused`: "1943", "aged 38" and "May 3" give the DATES messages; blank gives `Write a text first.`; too long gives `Keep it under N characters.`
- `test_309_ac2_opening_must_end_with_the_question`.
- `test_309_ac2_story_period_only_neighbours` (Review Focus 2).
- `test_309_ac2_period_rename_cannot_take_another_periods_name` (Review Focus 3).
- `test_309_period_numbers_follow_story_order`.

### Task 2: Migration
**Files:**
- Create: `supabase/migrations/20261124000000_content_fields.sql`
- Test: `tests/content-fields-migration.test.ts`. Also loosen the #304 "last migration" test to "after premade cards" (ruling: it pinned "last", which every later migration breaks).

**Contents:**
- `companions.who` and `stories.path` (text, not null, default '').
- The table `content_fields` (key check, `companion_id`, `story_id`, `field`, version, body `\S` and ≤ 1000, published, `published_at`, `published_by`, `created_by`), with one published version per key, RLS on, and select for editors only.
- `save_content_field_draft(field_key, field_body) returns integer`:
  - editor only;
  - advisory lock;
  - resolves the key through `key_code`;
  - inserts the starting version 1 from the column when there are no rows and the column is not blank.
- `private.apply_content_field(...)`: writes the column. A period rename updates the n-th run of stories.
- `private.set_published_content_field(key, version, action)`:
  - the same checks as app text;
  - re-checks the period rules (a neighbour or own period, the period not emptied, a rename not to another period's name);
  - applies the text;
  - inserts history kind `companion_field` or `story_field`.
- `publish_content_field` and `roll_back_content_field`: admin only (42501).
- The publish history kind check widened to the four kinds, and `list_publish_history` gains `is_current` for the two new kinds.

**Tests:** one for each, named `test_309_ac1…` to `test_309_ac5…`, asserting the SQL text as the #304 tests do.

### Task 3: Import keeps edited fields
**Files:**
- Modify: `scripts/content/import.mjs`
- Test: `tests/content-scripts.test.ts` (new case)

**Test:** `test_309_ac6_import_keeps_the_edited_fields`. The `on conflict` update of companions has no `name` or `tags`; that of stories has no `title`, `period`, `goal_short`, `who` or `opening`. The insert values still contain them.

### Task 4: Writes and reads
**Files:**
- Create: `src/lib/content-fields/write.ts` and `src/lib/content-fields/reader.ts`
- Test: `tests/content-field-writes.test.ts`

**Produces:**
- `writeContentField(write: {kind:"save",key,body}|{kind:"publish"|"roll_back",key,version}, deps:{userId, role, rpc, problemsOf:(key, body)=>Promise<string[]|null>, storedBody:(key, version)=>Promise<string|null>})`.
  - Errors: not-allowed, invalid, checks-failed (with problems), failed.
  - Save checks before the RPC. Publish and roll back require admin and re-check the stored body.
- `readCompanionAdmin(client, id)` and `readStoryAdmin(client, companionId, storyId)`.

**Tests:** a writer can't publish (Review Focus 4, no RPC call); save refused with problems and no RPC; publish re-checks the stored body.

### Task 5: Pages, actions, history, stub, e2e
**Files:**
- Create: `src/app/admin/companions/{page.tsx, actions.ts, field-editor.tsx, [id]/page.tsx, [id]/stories/[story]/page.tsx}`
- Modify:
  - `src/app/admin/admin-shell.tsx` (the Companions entry, ADM-03);
  - `src/lib/publish-history/admin.ts`;
  - `src/app/admin/publish-history/actions.ts`;
  - `e2e/support/stub-supabase.mjs`;
  - `e2e/large-text.spec.ts`.
- Test:
  - `e2e/content-field-editing.spec.ts`;
  - `tests/publish-history-admin.test.ts` (new kinds, admin-only Roll back).

**E2e:**
- `test_309_ac1_ac3_a_writer_saves_a_draft_and_cannot_publish`
- `test_309_ac2_a_year_is_refused`
- `test_309_ac4_ac5_an_admin_publishes_a_period_name_and_rolls_back` (the stub's `get_story_content` shows the new name)

### Task 6: Docs and production setup
- `docs/decisions/0024-companion-story-fields.md`, `docs/architecture.md`, `docs/deploy.md`.
- `content-admin/production-setup-content-fields_2026-11-17/`:
  - README;
  - `1-content-fields.sql`;
  - `2-check-it-worked.sql`.
