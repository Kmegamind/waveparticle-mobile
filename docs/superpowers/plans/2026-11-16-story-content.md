# Story content in Supabase (#284) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Companions and Stories live in Supabase and the app reads them through `src/lib/content/repository.ts`, with the screens showing the same words as before.

**Architecture:** Three tables: `companions` and `stories` (display fields, readable by signed-in users) and `story_inputs` (model-only and admin fields, closed to the API). The server reads everything in one call to `get_story_content(reader_token)`, a security-definer function that answers only to the server-only `CONTENT_READ_KEY`. This is the pattern of `docs/decisions/0015`. The result is cached for 60 s. Every reader takes a `StoryContent` snapshot instead of importing bundled JSON.

**Tech Stack:** Next.js 16, TypeScript 6, Supabase (PostgREST rpc with the anon key), Vitest, Playwright with the Supabase stub.

**Spec:** issue #284 and Yue's answers of 2026-11-16 (in the PR). The decisions SHARED-STORY, DATES-ADMIN-ONLY and KEY-UNCONFIRMED are in `docs/DECISIONS.md`.

## Global Constraints
- No service-role key in application code. `CONTENT_READ_KEY` is server-only and never `NEXT_PUBLIC_`.
- Store exactly the text each screen reads today, under the screen's names: `title`, `goal_short`, `who`, `opening` and `period`. Do not invent a "description" field.
- Model-only inputs (facts, forbidden terms, later words, the other stage-0 inputs and key moments) are not readable from the browser.
- `date` is kept in `story_inputs`, is never returned to the app and never reaches a prompt. `export_story_content` is the only reader of it.
- Key moments are stored as `confirmed: false`.
- Moriarty is a Companion with no stories.
- Out of scope: a cards table (#293), prompts, the model gateway and styles.
- The migration is `supabase/migrations/20261119000000_story_content.sql`.

## Review Focus
1. Content read fails (token missing, wrong token, database down): actions return `failed`; pages behave as when progress reads fail. Pinned in the repository tests.
2. A wrong token returns an empty or null document: this is a failed read, not "no stories", and it is not cached.
3. An unknown story id in a request is still refused (#254 AC5). Pinned in the existing tests through `isStoryId(content, …)`.
4. An export of unchanged data rewrites no file. Pinned in the content-files tests.
5. A date never reaches the app snapshot. Pinned in the parse test.

---

### Task 1: Seed files and the shared row builder
**Files:** create `scripts/content/content-files.mjs`, `src/content/companions.json` and `src/content/oppenheimer/periods.json`; modify `src/content/oppenheimer/stories.json` (`confirmed: false`) and `tests/oppenheimer-story-database.test.ts`; test `tests/content-files.test.ts`.
**Produces:**
- `readContentRows(root?) → { companions, stories, storyInputs }`, rows as the tables hold them.
- `appDocument(rows)`, the shape `get_story_content` returns.
- `exportDocument(rows)`, the shape `export_story_content` returns.
- `writeContentFiles(exportDoc, root?) → string[]`, which writes only the files whose parsed content changed.
- [ ] Tests:
  - `test_284_reads_26_stories_and_two_companions_moriarty_without_stories`;
  - `test_284_round_trip_writes_no_file_when_nothing_changed`;
  - `test_284_round_trip_restores_every_file_exactly_as_parsed_json`;
  - `test_284_app_document_has_no_date_or_provenance`;
  - `test_284_key_moments_are_unconfirmed`.

  Run them and watch them fail, then implement and see them pass. Commit.

### Task 2: Migration
**Files:** `supabase/migrations/20261119000000_story_content.sql` and `tests/story-content-migration.test.ts`. The tests are text checks in the style of `tests/prompts-migration.test.ts`.
- [ ] Tests:
  - the migration runs after the publish history migration;
  - the three tables;
  - the select policy for `authenticated` on `companions` and `stories` only;
  - `story_inputs` has RLS with no policy and `revoke all`;
  - `private.content_reader` stores a SHA-256;
  - both functions are `security definer` with `search_path = ''`;
  - `get_story_content` does not select `date` or `provenance`;
  - `export_story_content` and `get_story_content` are executable by anon and authenticated; nothing else is granted.

  Then write the SQL, check it in PGlite in the scratchpad (not a repo dependency), and commit.

### Task 3: Import, export and token scripts
**Files:** `scripts/content/import.mjs` (prints SQL upserts in one transaction), `scripts/content/export.mjs` (`export_story_content` through rpc, then `writeContentFiles`), `scripts/content/token.mjs` (`CONTENT_READ_KEY` plus `insert into private.content_reader`), and `tests/content-scripts.test.ts`.
- [ ] Tests:
  - the import SQL upserts 2 companions, 26 stories and 26 input rows and quotes text safely;
  - the token SQL holds only the hash;
  - export refuses an empty answer.

  Implement and commit.

### Task 4: Repository
**Files:** `src/lib/content/types.ts`, `src/lib/content/parse.ts`, `src/lib/content/repository.ts`, `tests/content-repository.test.ts`, and `tests/support/seed-content.ts` (seed files → `appDocument` → `parseStoryContent`).
**Produces:**
- `StoryContent { companions: Companion[]; stories: Story[] }`.
- `Story { id, companionId, sequence, title, period, goalShort, who, opening, inputs: { goal, facts, forbiddenTerms, keySlices, stageZero } }`.
- `parseStoryContent(doc: unknown): StoryContent`, which throws on a bad document.
- `createContentRepository({ readDocument, cacheMs, now, log })` returning `{ getStoryContent(): Promise<StoryContent> }`. It throws `StoryContentUnavailable` and does not cache a failure.
- `readStoryContentFromSupabase({ env, fetchImpl, timeoutMs })`.
- `getStoryContent`.
- [ ] Tests:
  - the cache holds for 60 s;
  - a failed read is not cached;
  - a missing `CONTENT_READ_KEY` throws;
  - a null or empty answer throws;
  - the parsed seed has no `date` key anywhere.

### Task 5: Readers take the snapshot
**Files:** `src/lib/prototype/story-inputs.ts` (functions take `content`; `story-inputs-data.ts` and `src/content/oppenheimer/index.ts` are deleted), plus:
- `life-path.ts` and `finish-run.ts`;
- `me/records.ts`;
- `focus-cards.ts` and `rest-lines.ts`;
- `app/focus/account-progress.ts`;
- `content/companions.ts` (types and `companionById(companions, id)` only);
- the home, goals and me views;
- the pages and actions that call them.

The existing tests are updated to pass `seedContent()`; their assertions do not change. Add a guard test, `tests/story-content-imports.test.ts`: no file under `src/` imports `stories.json`, `companions.json`, `periods.json` or `docs/demo/*.stage0.json`. The one exception is the labelled `/try` test data (`test-story.ts`), which holds generated lines and belongs to #293.

### Task 6: e2e stub, configuration and docs
- `e2e/support/stub-supabase.mjs` answers `get_story_content` with `appDocument` when the token is `STUB_CONTENT_READ_KEY`.
- `playwright.config.ts` and `.env.example` gain `CONTENT_READ_KEY`.
- Docs: `docs/decisions/0019-story-content-in-the-database.md`, `docs/architecture.md` and `docs/deploy.md`.
- The production setup files go in Yue's `content-admin/` folder.

Then run the full checks: `npm test`, `npm run lint`, `npm run format:check`, `npm run build` and `npm run test:e2e`.
