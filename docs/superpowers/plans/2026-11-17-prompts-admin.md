# ADM-08 Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins and writers edit the gateway's 7 prompts as draft versions in `/admin/prompts`. Only an admin publishes or rolls back, and every publish is recorded in Publish history.

**Architecture:**
- **Publish check:** the gateway exports its own row check, `promptRowProblems`, so Publish refuses exactly what a live call would refuse.
- **Database:** one migration adds role-checked functions for listing, saving drafts, publishing and rolling back. Publish and roll back go through the existing `public.activate_prompt` and write a `publish_history` row in the same transaction.
- **Pages:** they follow ADM-07 App text and ADM-06 Stories. Server actions check the role, then the database checks it again.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Supabase Postgres (SQL migration), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-prompts-admin-design.md` (issue #308)

## Global Constraints
- No service-role key. Every call runs as the signed-in user: the server checks the role, and so does the database.
- Do not change the live gateway path. A row with a problem still fails the call with the reason `prompt`, and the existing gateway tests stay green unchanged.
- Version numbers are `max + 1` for the key and never reused. A draft is never `active`.
- Only the `admin` role publishes or rolls back. A writer sees "Only an admin can publish."
- Limits:
  - body: not blank, at most 20000 characters;
  - note: at most 500 characters;
  - settings: a JSON object.
- UI uses `DESIGN.md` tokens and existing admin classes only. English only. Use the product words Companion, Goal and Step.
- Do not split PROMPT-PARTS and add no Test button. Both are listed under "Left for later" in the PR and the docs.
- Test names follow `test_308_acN_…`.

## Review Focus
1. **Settings JSON that parses but is not an object** (`[]`, `null`, `"x"`, `3`): refused in words, nothing saved. Pinned in Task 3.
2. **A draft whose problem shows only in one branch**, for example `text.situation_harder` missing while `situation_first` is fine: Publish is refused. Pinned in Task 1.
3. **A key with no active version** (never imported): the list says so, the detail page has no diff and Publish still works. Pinned in Tasks 3 and 5.
4. **Roll back to a version that today's gateway refuses:** refused with the reasons. Pinned in Task 3.
5. **Saving the same text, settings and note as the newest version:** refused ("Nothing changed"), and no version is used up. Pinned in Task 3.

---

### Task 1: The gateway's row check

**Files:**
- Modify: `src/lib/model-gateway/gateway.ts`
  - Move each method's `build` closure into a named builder per key, which the live call and the check both use.
  - `PromptRowError` carries readable problems.
- Modify: `src/lib/prompts/template.ts` to add `placeholderNames`.
- Modify: `src/lib/model-gateway/index.ts` to export the check.
- Test: `tests/prompt-row-check.test.ts`

**Interfaces:**
- Produces:
  - `promptRowProblems(row: PromptRow): string[]`, exported from `@/lib/model-gateway`;
  - `placeholderNames(template: string): string[]`, exported from `@/lib/prompts/template`.

- [ ] **Step 1: Write the failing tests.** The seed rows come from `tests/support/seed-prompts.ts`.
  - `test_308_ac7_every_seed_prompt_passes`: for each of the 7 seed rows, `promptRowProblems(row)` is `[]`.
  - `test_308_ac7_an_unknown_placeholder_is_named`: in rest_reply, replace `{{facts}}` with `{{fatcs}}`. The result contains `"Unknown {{fatcs}} in the prompt."`.
  - `test_308_ac7_every_unknown_placeholder_is_listed`: a body with `{{a1}}` and `{{b2}}` gives both, each once.
  - `test_308_ac7_a_missing_line_limit_is_named`: rest_reply without `checks.max_words` gives `"Missing or unusable setting: checks."`. stuck_story without `checks` gives the same.
  - `test_308_ac7_a_setting_used_in_only_one_branch_is_checked`:
    - stuck_story without `text.situation_harder` gives `"Missing or unusable setting: text.situation_harder."`;
    - return_popup without `text.situation_absence` gives the matching message;
    - step_cards without `text.nothing_new` gives the matching message;
    - plan_split without `text.split_finer_yes` gives the matching message.
  - `test_308_ac7_step_cards_checks_are_named`: without `checks.background_card`, the result contains `"Missing or unusable setting: checks.background_card."`. With `checks.max_story_cards: "3"`, it contains `"Missing or unusable setting: checks.max_story_cards."`.
  - `test_308_ac7_an_unknown_placeholder_inside_a_text_setting_is_named`: `text.cards_counted` containing `{{storyCrads}}` gives `"Unknown {{storyCrads}} in text.cards_counted."`.
  - `test_308_ac7_retry_hints_is_rendered_with_fixes`: a retry_hints body with `{{fix}}` gives `"Unknown {{fix}} in the prompt."`.
  - `test_308_the_live_call_still_fails_with_reason_prompt`: a gateway whose stub source serves the broken rest_reply row returns `{ source: "failed", reason: "prompt" }`, and the provider is never called.
- [ ] **Step 2: Run** `npx vitest run tests/prompt-row-check.test.ts`. Expected: FAIL, because `promptRowProblems` is not exported.
- [ ] **Step 3: Implement.**
  - **`render(row, values, where)`:** on an unknown name, throw `PromptRowError` with the problems `Unknown {{name}} in the prompt.` (or `in text.<name>.`), one per name in `placeholderNames(template)` that is missing from `values`.
  - **Readable messages:** `text()`, `count()`, `checks()`, `lineLimits()` and `readPlanLimits` failures throw `Missing or unusable setting: <path>.`, where the path is `checks`, `checks.step_card`, `checks.max_story_cards`, `harder_from_pause`, `text.<name>` and so on.
  - **The cases checked** (the exact values are the builder's choice): the builders for each key are called with sample inputs covering every branch.
    - plan_split: `splitFiner` true and false.
    - step_cards:
      - `{storyCards: 2, background: true, stepFacts: "x", stepNumber: 1, stepCount: 2, mustUse: ["a"]}`;
      - `{storyCards: undefined, background: false}`, with no `stepFacts`;
      - `{stepFacts: ""}`.
    - stuck_story: `pauseNumber` 1 and 1000.
    - return_popup: triggers `rest` and `absence`.
    - rest_reply and closing_line: their one case.
    - retry_hints: `render(row, { fixes: "x" })`.
  - **Result:** the distinct problems in first-seen order. Any other thrown error becomes `"The prompt cannot be built."`.
- [ ] **Step 4: Run** `npx vitest run tests/prompt-row-check.test.ts tests/model-gateway.test.ts tests/gateway-prompts-golden.test.ts tests/gateway-prompt-source.test.ts tests/prompt-template.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: the gateway's prompt row check, shared by the live call and Publish (#308)`.

### Task 2: Migration

**Files:**
- Create: `supabase/migrations/20261125000000_prompt_editing.sql`
- Modify: `tests/story-card-editing-migration.test.ts`.
  - Its `names.at(-1)` assertion becomes "after 20261121000000_premade_cards.sql and 20261122000000_companion_mode.sql". That is what the test's name says.
  - This is the only edit to a #304 file, and it needs your OK (see the handoff).
- Test: `tests/prompt-editing-migration.test.ts`, which reads the SQL with comments removed, as `story-card-editing-migration.test.ts` does.

**Interfaces:**
- Produces these SQL functions:
  - `public.list_prompt_versions()` returns key, version, active, body, params, note, created_at, activated_at;
  - `public.save_prompt_draft(prompt_key text, prompt_body text, prompt_params jsonb, prompt_note text) returns integer`;
  - `public.publish_prompt(prompt_key text, prompt_version integer)`;
  - `public.roll_back_prompt(prompt_key text, prompt_version integer)`;
  - `private.set_active_prompt(prompt_key text, prompt_version integer, publish_action text)`;
  - `list_publish_history` with `when 'prompt'`.

- [ ] **Step 1: Write the failing tests.**
  - `test_308_runs_last_after_story_card_editing`.
  - `test_308_ac3_save_adds_version_max_plus_one_and_is_never_active`, which checks the migration for:
    - `is_content_editor`;
    - `pg_advisory_xact_lock(hashtext('prompt:' || prompt_key))`;
    - `coalesce(max(version), 0) + 1`;
    - `jsonb_typeof(prompt_params) = 'object'`;
    - `errcode = 'P0002'` for an unknown key;
    - no `active = true`, and no call to `activate_prompt` in the save function.
  - `test_308_ac5_publish_and_roll_back_are_admin_only`: both check `content_role() is distinct from 'admin'` and use `errcode = '42501'`.
  - `test_308_ac5_set_active_prompt_uses_activate_prompt`:
    - it locks with `for update` and calls `perform public.activate_prompt(prompt_key, prompt_version)`;
    - it sets `activated_at = now(), activated_by = auth.uid()`;
    - it refuses an already active version;
    - roll back needs `activated_at is not null`.
  - `test_308_ac6_history_row_in_the_same_function`:
    - an `insert into public.publish_history (...) values ('prompt', ...)` inside `private.set_active_prompt`;
    - the kind check lists `'app_text', 'story_card', 'prompt'`;
    - `list_publish_history` has `when 'prompt'`.
  - `test_308_ac2_list_is_editors_only_security_definer`.
  - `test_308_backfills_activated_at_for_the_active_rows`.
  - Grants: `grant execute … to authenticated` for the four public functions. `private.set_active_prompt` is revoked from `public`, `anon` and `authenticated`.
- [ ] **Step 2: Run** `npx vitest run tests/prompt-editing-migration.test.ts`. Expected: FAIL (no file).
- [ ] **Step 3: Write the migration.** It copies the structure of `20261123000000_story_card_editing.sql`. `list_publish_history` keeps the app_text and story_card branches and adds the prompt branch.
- [ ] **Step 4: Run** `npx vitest run tests/prompt-editing-migration.test.ts tests/story-card-editing-migration.test.ts tests/prompts-migration.test.ts tests/publish-history-migration.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: database functions to save prompt drafts, and admin-only publish and roll back with history (#308)`.

### Task 3: Admin logic (views, diff, writes)

**Files:**
- Create: `src/lib/prompts/diff.ts`
- Create: `src/lib/prompts/admin.ts` for the views and `writePrompt`.
- Create: `src/lib/prompts/admin-reader.ts`, `readPromptVersions(rpc)`, which calls `list_prompt_versions`.
- Modify: `src/lib/publish-history/admin.ts`:
  - `PUBLISH_HISTORY_KINDS.prompt = "Prompt"`;
  - `canRollBack` is admin only for `prompt`, as for `story_card`.
- Tests:
  - `tests/prompt-diff.test.ts`
  - `tests/prompts-admin.test.ts`
  - `tests/prompt-writes.test.ts`
  - `tests/publish-history-admin.test.ts`, which gets new cases only.

**Interfaces:**
- Consumes: `promptRowProblems` from Task 1, and `PROMPT_KEYS` and `PromptKey` from `@/lib/prompts/repository`.
- Produces:
  - `type DiffLine = { kind: "same" | "added" | "removed"; text: string }`
  - `lineDiff(before: string, after: string): DiffLine[]`
  - `settingsText(params: Record<string, unknown>): string`, which writes JSON with sorted keys and a two-space indent.
  - `type PromptVersionRow = { key: string; version: number; active: boolean; body: string; params: Record<string, unknown>; note: string; created_at: string; activated_at: string | null }`
  - `promptList(rows): PromptListRow[]`, with:
    - `{ key, purpose, active: { version, settings: string[] } | null, draftVersion: number | null }`;
    - always the 7 keys, in `PROMPT_KEYS` order;
    - `settings` holds flattened lines such as `"checks.max_words: 80"`.
  - `promptDetail(key, rows): PromptDetail | null`, with:
    - `{ key, purpose, active, draft: { version, body, params, note, problems, bodyDiff, settingsDiff } | null, versions: { version, state: "active" | "draft" | "earlier", note, createdAt }[] }`;
    - the draft is the newest version above the active one with `activated_at === null`, or the newest version when nothing is active.
  - `type PromptWrite = { kind: "save"; key; body; settings: string; note } | { kind: "publish" | "roll_back"; key; version }`
  - `type PromptWriteError = "not-allowed" | "invalid" | "blank" | "too-long" | "note-too-long" | "settings-json" | "unchanged" | "checks-failed" | "failed"`
  - `writePrompt(write, deps: { userId; role; rpc; readVersions: () => Promise<PromptVersionRow[] | null> }): Promise<{ ok: true; version?: number } | { ok: false; error: PromptWriteError; problems?: string[] }>`
  - `PROMPT_PURPOSE: Record<PromptKey, string>`, with the "Used for" lines of `docs/ai/prompts/README.md`.

- [ ] **Step 1: Write the failing tests.**
  - **Diff:**
    - `test_308_ac4_diff_marks_added_and_removed_lines`: `lineDiff("a\nb\nc", "a\nx\nc")` gives same a, removed b, added x, same c.
    - `test_308_ac4_settings_diff_ignores_key_order`: `settingsText({b:1,a:{d:1,c:2}})` equals `settingsText({a:{c:2,d:1},b:1})`.
  - **Views:**
    - `test_308_ac1_list_has_seven_keys_with_active_version_and_settings`, which includes a key with no rows (`active: null`) and a key with a newer draft (`draftVersion`).
    - `test_308_ac3_detail_draft_is_newest_never_activated_above_active`: a version activated before and then rolled back past is `earlier`, not `draft`.
    - `test_308_ac7_detail_lists_draft_problems`.
    - `test_308_detail_unknown_key_is_null`.
  - **Writes:**
    - `test_308_ac3_save_refuses_blank_too_long_bad_json_non_object_and_unchanged`, covering `"[]"`, `"null"`, `"3"` and `"{"`. None of these makes an rpc call.
    - `test_308_ac3_save_calls_save_prompt_draft_and_returns_version`.
    - `test_308_ac5_writer_cannot_publish_or_roll_back`: `not-allowed`, no rpc call.
    - `test_308_ac7_publish_refuses_a_failing_version_with_problems`: `checks-failed`, the problems listed, no rpc call.
    - `test_308_ac7_roll_back_refuses_a_failing_version`.
    - `test_308_ac5_admin_publishes_a_passing_draft_through_publish_prompt`.
    - `test_308_unknown_key_or_version_is_invalid`.
  - **History:**
    - `test_308_ac6_history_labels_prompt_rows_and_offers_roll_back_to_admins_only`.
- [ ] **Step 2: Run** these four test files. Expected: FAIL (the modules are missing).
- [ ] **Step 3: Implement.**
  - **`lineDiff`:** a longest-common-subsequence table over the lines. For tied lines, the removed line comes before the added one.
  - **`writePrompt`:**
    - Validate in this order: account and role, then the key is in `PROMPT_KEYS`, then the input.
    - "Unchanged" compares body, `settingsText(params)` and note against the newest version.
    - Publish and roll back read the stored version through `readVersions` and run `promptRowProblems` on it.
- [ ] **Step 4: Run** the same files plus `tests/publish-history-admin.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: prompt drafts, diff and admin-only publish in the admin logic (#308)`.

### Task 4: Pages, actions, menu and the e2e stub

**Files:**
- Create:
  - `src/app/admin/prompts/page.tsx`
  - `src/app/admin/prompts/[key]/page.tsx`
  - `src/app/admin/prompts/[key]/prompt-editor.tsx` (client)
  - `src/app/admin/prompts/actions.ts`
- Modify:
  - `src/app/admin/admin-shell.tsx`: a group "AI rules" with `{ href: "/admin/prompts", id: "ADM-08", label: "Prompts" }`, placed between Content and Review and logs.
  - `src/app/admin/publish-history/actions.ts`: the `prompt` handler.
  - `e2e/support/stub-supabase.mjs`:
    - a prompt store seeded from the prompt files, v1 active;
    - `list_prompt_versions`, `save_prompt_draft`, `publish_prompt` and `roll_back_prompt`, with the same role rules;
    - history rows of kind `prompt`;
    - `is_current` for prompt rows;
    - `get_active_prompts` reading the store;
    - `POST /__prompts { reset: true }`.
  - `e2e/large-text.spec.ts`: add both pages to its list.
  - The admin CSS file the App text page uses: classes for the diff lines only, with tokens.
- Tests:
  - `tests/prompts-pages.test.ts` (static checks)
  - `e2e/prompts-admin.spec.ts`

**Interfaces:**
- Consumes: `promptList`, `promptDetail`, `writePrompt`, `readPromptVersions`, `lineDiff` and `settingsText` from Task 3.
- Produces these server actions:
  - `savePromptDraftAction(key: string, body: string, settings: string, note: string)`;
  - `publishPromptAction(key: string, version: number)`;
  - `rollBackPromptAction(key: string, version: number)`.
  - Each returns the `writePrompt` result, plus `draftProblems?: string[]` on a save.

- [ ] **Step 1: Write the failing tests.**
  - **Static:**
    - `test_308_ac1_menu_lists_prompts_as_adm_08_under_ai_rules`.
    - `test_308_pages_read_through_the_signed_in_users_own_client`.
    - `test_308_no_service_role_key`.
    - `test_308_publish_history_wires_the_prompt_roll_back`.
  - **e2e**, which resets the stub in `beforeEach`:
    - `test_308_ac1_lists_the_seven_prompts_with_v1_active_and_settings`: seven rows; rest_reply shows "v1" and "checks.max_words: 80".
    - `test_308_ac2_ac3_ac4_writer_saves_a_draft_and_sees_the_diff`:
      - open rest_reply and change one line;
      - Save draft gives "Draft v2 saved.";
      - the diff shows `−` with the old line and `+` with the new one;
      - Publish v2 is disabled, with "Only an admin can publish.".
    - `test_308_ac3_bad_settings_json_is_refused_in_words`.
    - `test_308_ac7_admin_cannot_publish_an_unknown_placeholder`: save `{{fatcs}}`; the page lists "Unknown {{fatcs}} in the prompt." and Publish is disabled.
    - `test_308_ac5_ac6_admin_publishes_and_rolls_back_from_history`:
      - Publish gives "Published v2.";
      - Publish history shows "Prompt", rest_reply, v2 and the admin's email;
      - Roll back to v1 makes v1 active again on the prompt page.
- [ ] **Step 2: Run** `npx vitest run tests/prompts-pages.test.ts` and `CI=1 npx playwright test e2e/prompts-admin.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Pages:** they mirror ADM-07 and ADM-06. `await connection()`, the user's own client through `createSupabaseServerClient`, and `notFound()` for a key that is not known.
  - **Editor:** labelled textareas for Prompt and Settings (JSON), a Note field, Save draft, Publish v{n}, and a status region with `role="status"`. Each diff line shows its `+`, `−` or space marker as visible text, in the mono type token.
  - **Copy:** the page says "Phones use a published prompt within a minute."
- [ ] **Step 4: Run** the same commands. Expected: PASS.
- [ ] **Step 5: Commit** `feat: ADM-08 Prompts lists, edits, diffs and publishes prompts; roll back from Publish history (#308)`.

### Task 5: Docs and production steps

**Files:**
- Create: `docs/decisions/0025-prompt-editing.md` (context, options A and B, the decision, consequences, and "Left for later": PROMPT-PARTS and Test).
- Modify:
  - `docs/architecture.md`: a Prompts row for ADM-08, the Admin area menu, and a data model paragraph.
  - `docs/deploy.md`: a "Prompt editing" section.
  - `docs/ai/prompts/README.md`: the admin page, and a note that the table editor and the import still work but write no history.
  - `docs/api/README.md`, if it lists database functions.
- Outside the repo: `2_Areas/Product/content-admin/production-setup-prompt-editing_2026-11-17/`, holding:
  - `1-prompt-editing.sql`, a copy of the migration;
  - `2-check-it-worked.sql`, read only, with one "ok" row per check: columns, the four functions, grants, the kind check, the backfill, and that `get_active_prompts` still returns 7 rows when the token is the stored one (left to the human);
  - `README_production-setup.md`, in the style of the #304 README: run it after the story-card-editing setup, then try it on the live site.

- [ ] **Step 1:** Write the docs. Run `npm run format:check`. Expected: clean.
- [ ] **Step 2: Commit** `docs: prompt editing in architecture, deploy, the prompts README and decision 0025 (#308)`.

### Final
- [ ] Merge origin/main, then run `npm test`, `CI=1 npm run test:e2e`, `npm run lint` and `npm run format:check`.
- [ ] Whole-branch review.
- [ ] Open the PR (`Closes #308`), with UI screenshots of both pages at 360 px.
