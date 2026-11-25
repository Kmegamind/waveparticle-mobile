# 0032: The AI feature pages live in three tables, written only through functions and SQL
- Status: proposed (agent, #436); the owner decided the rules in AI-PAGE-STORE, AI-PAGE-RUNS and AI-PAGE-STATUS (`docs/DECISIONS.md`)
- Date: 2026-11-25
- Issue: #436 (part of #430)

## Context
Each of the 7 AI features gets an admin page (AI-PAGES, `docs/ai/AI_11_feature-pages.md`).
Sections (a) purpose, (b) pass questions, (c) current approach and (d) status live in the
database and are edited in the admin (AI-PAGE-STORE); only the admin role changes a status, with
a history (AI-PAGE-STATUS); the test results of the #42 offline runs are imported, with fake-model
runs marked (AI-PAGE-RUNS). The prompt text (e) is read live from `public.prompts` and is never
copied. The first values are the drafts of AI_11 section 3, each with its source and marked
"draft - owner to edit"; a section with no source reads "Not written yet".

## Options
| Option | For | Against |
|---|---|---|
| A. One table per section | Each section has its own rows | Seven joins for one page; the status history still needs its own table |
| B. One feature table with each section as a JSON list of items `{text, source, draft}`, plus a status history table and a test-run table | One row per page; the source and the draft flag stay with each line; an empty list is "Not written yet" | The item shape is checked by a function, not by columns |
| C. Keep the texts in `AI_11` and read the file | No migration | The owner edits in the admin, not in git (AI-PAGE-STORE) |

## Decision
Option B, in `supabase/migrations/20261130000000_ai_features.sql`:
- `public.ai_features`: `slug` (the prompt key, or `pause_message` for the two-call feature),
  `position`, `title` ("Goal split (plan_split)"), `prompt_keys text[]`, `purpose`,
  `pass_questions` and `approach` (JSON lists checked by `private.ai_feature_items_valid`),
  `status` (`not_started`, `exploring`, `passed`, `frozen`; default `exploring`), and who saved
  the sections last. `retry_hints` is not a row.
- `public.ai_feature_status_history`: feature, from, to, note, who (`auth.uid()`), when.
- `public.ai_feature_test_runs`: feature, prompt key, kind (`fake_model` or `real`), run time,
  prompt version, pass, fail and target counts, a summary and the path of the run's report;
  unique per feature, prompt key, kind and run.
- Row level security on all three: content editors (`public.is_content_editor()`) read; no API
  role may insert, update or delete. Content editors save (a) to (c) through
  `public.save_ai_feature_sections`; only the admin role changes a status, through
  `public.set_ai_feature_status`, which writes the history row in the same transaction. Both are
  `security definer`, as the publish functions of the other content (`0016`, `0018`).
- The migration creates empty tables. The seven rows are SQL printed by
  `scripts/ai-features/seed.mjs` from AI_11 (insert only when the slug is missing), and test runs
  are SQL printed by `scripts/ai-features/import-runs.mjs` from a run folder. Both connect to
  nothing and have `--dry-run` (the same SQL ending in `ROLLBACK`), as the other import scripts.
- Writers may edit (a) to (c): AI-PAGE-STATUS limits only the status to the admin role.

## Consequences
- The seed reads AI_11 at the time it runs; after that the admin holds the text, and running the
  seed again changes nothing for an existing feature.
- A test run's pass and fail counts are the PASS and FAIL rows of the run's report summary for
  its suite's targets; pending scoring and no data count only in the total. Importing a run again
  (after scoring) updates its rows.
- The status history keeps the account id; the email is shown by a later read function (#430
  phase 2, T5 or T6), as the publish history does.
