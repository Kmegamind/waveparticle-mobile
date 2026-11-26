# 0033: Extend the AI feature tables into the registry; print the seed and the prompt import as SQL
- Status: proposed (agent, #473); the owner decided the rules in AI-REGISTRY-STORE, AI-PROMPT-CATEGORY, AI-SEED-STATUS and AI-REQUIREMENT-FIELD (`docs/DECISIONS.md`)
- Date: 2026-11-26
- Issue: #473 (slice 1 of the AI registry; spec #466, #469)

## Context
The registry (PRD section 4.14, FR-AIREG-1 to FR-AIREG-7) holds 19 AI features: the 7 runtime
features already in `public.ai_features` and 12 Pipeline and Quality gate rows. The owner decided:
no second registry table, the 7 rows keep their slugs, edited sections and status, a Feature ID
column next to the slug, a `category` column on `public.prompts` with the app reading runtime keys
only, and the 12 new rows starting with the seed's status. The seed (`registry-seed.json`) and the
prompt texts stay in the owner's planning folder (AI-SAMPLES-LOCAL): nothing from them is
committed. In production the 7 rows may already have edited sections and statuses.

## Options
| Option | For | Against |
|---|---|---|
| A. New columns on `public.ai_features`, a field history table and an example history table; writes through `security definer` functions that write the history | One row per feature, as before; the role rules sit in the functions, as #436; the seed and its undo can run in the SQL editor without writing history | The functions must be kept in step with the fields |
| B. A trigger on `public.ai_features` writes every change to the history | Every write is caught | The owner's seed and undo in the SQL editor would also write history rows, so the undo could not restore the state before |
| C. Fields as JSON item lists `{text, source, draft}`, as sections (a) to (c) | Same shape as (a) to (c) | The seed has plain owner text with no source or draft flag; every reader must unwrap lists |

## Decision
Option A, in `supabase/migrations/20261202000000_ai_registry.sql`:
- `public.ai_features` gets `feature_id` (unique, `^[PGR]-[0-9]{2}$`), `category` (`pipeline`,
  `gate`, `runtime`), `where_used`, `requirement`, `output_format`, `design_rationale`,
  `room_to_improve`, `notes` (text, `''` = "Not written yet"), `example_text`, `example_state`
  (`none`, `candidate`, `confirmed`), `example_set_by`, `example_set_at`, `fields_updated_at` and
  `fields_updated_by`. The existing rows get `R-01` to `R-07` by slug and `runtime`; nothing else
  in them changes. A row with another slug stops the migration.
- `public.ai_feature_field_history` (field, old and new value as JSON, who, when) and
  `public.ai_feature_example_history` (every example set: text, state, who, when). Content
  editors read both; no API role writes a table.
- `public.save_ai_feature_fields` and `public.set_ai_feature_example`: content editors.
  `public.set_ai_feature_category`: admin only (`42501` otherwise), as `set_ai_feature_status`.
  Each writes its history rows in the same transaction; `save_ai_feature_sections` now also writes
  a field history row for each of (a) to (c) that changed. Changes made in the SQL editor (the
  seed, an undo) write no history.
- `public.prompts.category` (default and existing rows `runtime`); a trigger gives a new version
  its key's category, so a draft of a pipeline key stays pipeline. `get_active_prompts` returns
  runtime rows only. `list_prompt_versions` returns every row with its category (the admin reads
  all; the function is dropped and made again because its return type grows by one column).
- Slugs and keys of the new rows: the Feature ID without the dash and the name in snake case
  (`p01_find_episodes` … `g05_simulated_user`, AI_11 section 5.2); the slug is also the prompt key
  and the title is "Name (key)" (AI-PAGE-TITLES). Positions: the 7 runtime rows keep 1 to 7; the
  new rows take 8 to 19 in seed order (P, then G), so no existing position moves. The registry
  table sorts by Feature ID (FR-AIREG-1), not by position.
- `scripts/ai-features/registry-seed.mjs <registry-seed.json>` prints the seed SQL: inserts the 12
  rows when their slug is missing, with the seed's status and no status history row; fills the
  registry fields of the 7 runtime rows only while each is empty (purpose and status untouched).
  The seed's `example_or_notes` goes to the example; `notes` stays empty. Examples that quote book
  or story text are never stored (P-04 to P-07, R-02 to R-06; the state is kept). `--dry-run`
  ends in `ROLLBACK`, `--check` prints a read-only `SELECT`, `--undo` the undo.
- `scripts/ai-features/import-pipeline-prompts.mjs <prompt-table-source/en>` prints one insert per
  key: version 1, active, with its category, only when the key has no row. The files: S1, S2, S3,
  S4h (historical), S4f (fictional), S4e, cards (P-07), S5, S6, S5c, S6c, S7; `--seed` checks
  the seed names the same file. `proposed4/` is refused. `--check` compares the active text with
  the file by md5, so no prompt text is printed. Same `--dry-run` and `--undo`.

## Consequences
- The app is unchanged for users: it reads runtime keys only, as before.
- A later admin slice can show and edit every field and the history without another migration.
- The import runs once per key; later versions of a pipeline prompt are made in the prompt editor.

## Undo
Order: the prompt import, the seed, then the migration. The first two print their undo
(`node scripts/ai-features/import-pipeline-prompts.mjs --undo`,
`node scripts/ai-features/registry-seed.mjs --undo`). The migration's undo puts back every
function as `20261115000000`, `20261125000000` and `20261130000000` made it:

```sql
begin;
drop function public.list_prompt_versions();
create function public.list_prompt_versions()
returns table (
  key text,
  version integer,
  active boolean,
  body text,
  params jsonb,
  note text,
  created_at timestamptz,
  activated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may read the prompts' using errcode = '42501';
  end if;
  return query
  select p.key, p.version, p.active, p.body, p.params, p.note, p.created_at, p.activated_at
  from public.prompts p
  order by p.key, p.version desc;
end;
$$;
revoke all on function public.list_prompt_versions() from public, anon, authenticated;
grant execute on function public.list_prompt_versions() to authenticated;
create or replace function public.get_active_prompts(reader_token text)
returns table (key text, version integer, body text, params jsonb, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.key, p.version, p.body, p.params, p.note
  from public.prompts p
  where p.active
    and exists (
      select 1
      from private.prompt_reader r
      where r.token_sha256 = encode(sha256(convert_to(reader_token, 'UTF8')), 'hex')
    );
$$;
drop trigger prompts_keep_category on public.prompts;
drop function private.keep_prompt_category();
alter table public.prompts drop column category;
create or replace function public.save_ai_feature_sections(
  target_feature text,
  new_purpose jsonb,
  new_pass_questions jsonb,
  new_approach jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may change an AI feature' using errcode = '42501';
  end if;
  update public.ai_features
  set purpose = new_purpose,
    pass_questions = new_pass_questions,
    approach = new_approach,
    sections_updated_at = now(),
    sections_updated_by = auth.uid()
  where slug = target_feature;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;
end;
$$;
drop function public.set_ai_feature_category(text, text);
drop function public.set_ai_feature_example(text, text, text);
drop function public.save_ai_feature_fields(text, text, text, text, text, text, text);
drop function private.record_ai_feature_field(text, text, jsonb, jsonb);
drop table public.ai_feature_example_history;
drop table public.ai_feature_field_history;
alter table public.ai_features
  drop column feature_id,
  drop column category,
  drop column where_used,
  drop column requirement,
  drop column output_format,
  drop column design_rationale,
  drop column room_to_improve,
  drop column notes,
  drop column example_text,
  drop column example_state,
  drop column example_set_by,
  drop column example_set_at,
  drop column fields_updated_at,
  drop column fields_updated_by;
commit;
```

With the Supabase CLI, then `supabase migration repair --status reverted 20261202000000`. Before
the merge this was run on a local Postgres build (PGlite) after the earlier migrations, the seed of
#436 and an edited row: migration, seed and import, then every undo, gave back the same functions,
columns, constraints, triggers, rights, policies and rows as before.
