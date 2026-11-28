# Prompt lab sample library and source excerpts (#479)

The sample library that fills a prompt's `{{variables}}` in the prompt lab (docs/PRD.md section 4.15; AI-LAB-SAMPLES, AI-SOURCE-EXCERPTS, AI-SAMPLES-LOCAL; `docs/decisions/0036`). The Samples page is `/admin/ai-samples` (drawing AIR-6, `docs/design/prototype/admin-ai-features.html#reg-samples`). The Run panel that picks a sample is #477.

Source excerpts and sample texts reach the database only through the owner's import below (the rule that no book text is ever committed was dropped by the owner on 2026-11-28, TEXT-IN-GIT-DROPPED; the import works as before), which reads the owner's local files and prints SQL. Tests, the Supabase stand-in and the screenshots use short invented text.

## The tables (`supabase/migrations/20261205000000_ai_samples.sql`)

- `public.ai_source_excerpts`, only the passage a story uses, never a whole book: `id` (a slug), `source_label` (**the source named**, required, 1 to 300 characters), `body` (the passage, at most 50 000 characters), `created_at`, `updated_at`.
- `public.ai_samples`, one sample: `id` (a slug), `position` (the library's order; equal positions are listed by id), `name`, `companion` (null when none), `mode` (`historical`, `fictional` or null), `persona`, `source_excerpt_id` (`public.ai_source_excerpts.id`, null when none), `background`, `facts` (a `jsonb` list of texts), `world_record`, `standing_task`, `plan` (`jsonb` object `{ goal, aims: [{ title, note }] }`, or null), `created_at`, `updated_at`. Text fields are at most 20 000 characters.
- `public.ai_runs.sample_id` now references `public.ai_samples.id` (`ai_runs_sample_fk`, no cascade): a run cannot name a sample that does not exist (`23503`), and a sample that a run used cannot be deleted, so the run log keeps it.
- Row level security: content editors (admin or writer, `public.is_content_editor()`) read every row of both tables. Accounts without a role (the app's users) read no row; `anon` has no right at all (`42501`). No API role inserts, updates or deletes either table (`42501`); the rows come from the import, run in the SQL editor.

Undo of the migration: `drop index public.ai_runs_sample; alter table public.ai_runs drop constraint ai_runs_sample_fk; drop table public.ai_samples; drop table public.ai_source_excerpts;` then, for the CLI's history, `supabase migration repair --status reverted 20261205000000` (owner only, `docs/HUMAN_STEPS.md`). Runs keep their `sample_id` text.

## The import: `scripts/ai-samples/import-samples.mjs`

```
node scripts/ai-samples/import-samples.mjs <samples-for-import folder>            # the SQL
node scripts/ai-samples/import-samples.mjs <samples-for-import folder> --dry-run  # ends in ROLLBACK
node scripts/ai-samples/import-samples.mjs <samples-for-import folder> --check    # read-only SELECT
node scripts/ai-samples/import-samples.mjs <samples-for-import folder> --undo     # the undo SQL
```

- The folder is always given on the command line; no path is written in the code. It must be outside the repository, and a folder inside `proposed4` is refused (AI-PROPOSED4-HOLD).
- Each `*.json` file of the folder is one sample, in file name order (its `position`). Fields: `id`, `name`, `companion`, `mode`, `persona`, `source_label`, `source_excerpt`, `background`, `facts`, `world_record`, `standing_task`, `plan`. Keys starting with `_` (notes for the owner) are not stored; any other unknown key, a missing source name for an excerpt, a text over the limits or two files with one id stops the script with a message and no SQL.
- The script prints to stdout only. It writes no file, connects to nothing and calls no model. Its output holds the source text: paste it into the SQL editor and never save it in the repository.
- The SQL inserts each excerpt (id = the sample's id) and each sample, or updates them by id, in one transaction; running it again updates the same rows. `--dry-run` ends in `ROLLBACK` after listing ids, sizes and whether each excerpt names its source. `--check` compares the stored rows with the files by md5 (no text printed): every row should say `ok`. `--undo` deletes those samples and excerpts; it stops with `23503` and removes nothing if a run used one of them.

## The page: `/admin/ai-samples`

`src/app/admin/ai-samples/page.tsx`, reading through `readSampleLibrary` in `src/lib/ai-samples/library.ts` with the signed-in user's own client.

- The list: name, Companion, the source named, and the words of the source excerpt ("No excerpt" when there is none). A row opens the sample below the list (`?sample=<id>`; the first sample when the id is missing or unknown).
- The sample: persona, source excerpt with "Source: <the source named>", background, facts, world record, standing task, finished plan (goal and aims). An empty field says "Not written yet", never filler.
- States: loading (three grey lines), empty ("No samples yet"), a failed read (error box with Retry), admin and writer (the role pill). Read only.
- "Add a finished story as a sample" is not built: no finished story with its source excerpt and persona exists in the data model to pick from (owner decision in #479's pull request).

## The Supabase stand-in (e2e)

`e2e/support/stub-ai-samples.mjs`, imported by `e2e/support/stub-supabase.mjs`: an invented library of three samples, read by content editors only; writes answer `42501`. `POST /__ai_samples { token, library: "empty" | null }` gives one account an empty library; `POST /__fail_reads { token, tables: ["ai_samples"] }` makes its read fail.
