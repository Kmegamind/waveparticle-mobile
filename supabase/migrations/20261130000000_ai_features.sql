-- One admin page per AI feature (#436, part of #430; decisions AI-PAGES, AI-PAGE-STORE,
-- AI-PAGE-RUNS, AI-PAGE-STATUS and AI-PAGE-TITLES; docs/ai/AI_11_feature-pages.md;
-- docs/decisions/0032). Three tables:
--
-- 1. public.ai_features: one row per AI feature (7 today), keyed by a feature slug, with the page
--    title ("Goal split (plan_split)"), the prompt keys it uses in public.prompts, and the page
--    sections (a) purpose, (b) pass questions and (c) current approach, and (d) its status. A
--    section is a list of items {"text", "source", "draft"}: the text, where it came from (file
--    and line, or null) and whether it is still a "draft - owner to edit". An empty list is a
--    section with no source: the page shows "Not written yet". The prompt text itself is never
--    copied here: section (e) is read live from public.prompts. retry_hints is not a feature row.
-- 2. public.ai_feature_status_history: every status change, who, when, from, to and a note.
-- 3. public.ai_feature_test_runs: the imported test runs of section (f) (the #42 offline runs),
--    with whether the run used the fake model (the stub) or the real one.
--
-- Content editors (public.is_content_editor(), 20261116000000_content_roles.sql) read all three.
-- Nobody inserts, edits or deletes rows through the API: the sections are saved by content
-- editors through public.save_ai_feature_sections, and the status is changed by the admin role
-- only, through public.set_ai_feature_status, which writes the history row in the same
-- transaction. Test runs are added in the SQL editor with the SQL that
-- scripts/ai-features/import-runs.mjs prints. No key with full database rights is needed anywhere.
--
-- The tables start empty: the seven rows come from scripts/ai-features/seed.mjs (the drafts of
-- docs/ai/AI_11_feature-pages.md, every status "exploring"). Running this file twice is refused by
-- the create statements.

create schema if not exists private;

-- A page section: a JSON list of items, each an object with exactly "text" (a non-empty string),
-- "source" (a string or null) and "draft" (true or false). Used by the check constraints below.
create function private.ai_feature_items_valid(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    return false;
  end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;
    if exists (
      select 1 from jsonb_object_keys(item) as k(name)
      where k.name not in ('text', 'source', 'draft')
    ) then
      return false;
    end if;
    if jsonb_typeof(item -> 'text') is distinct from 'string'
      or char_length(btrim(item ->> 'text')) = 0
      or char_length(item ->> 'text') > 2000
    then
      return false;
    end if;
    if not (item ? 'source')
      or jsonb_typeof(item -> 'source') not in ('string', 'null')
      or char_length(coalesce(item ->> 'source', '')) > 300
    then
      return false;
    end if;
    if jsonb_typeof(item -> 'draft') is distinct from 'boolean' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.ai_feature_items_valid(jsonb) from public, anon, authenticated;

-- A list of one or more prompt keys, each named as in public.prompts, none twice.
create function private.ai_feature_keys_valid(keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select keys is not null
    and cardinality(keys) >= 1
    and not exists (
      select 1 from unnest(keys) as k(name)
      where k.name is null or k.name !~ '^[a-z][a-z0-9_]*$'
    )
    and cardinality(keys) = (select count(distinct k.name) from unnest(keys) as k(name));
$$;

revoke all on function private.ai_feature_keys_valid(text[]) from public, anon, authenticated;

create table public.ai_features (
  slug text primary key check (slug ~ '^[a-z][a-z0-9_]*$'),
  -- The order of the pages (AI_11 section 3).
  position integer not null unique check (position >= 1),
  -- The page title: the feature's name and its prompt keys in brackets (AI-PAGE-TITLES).
  title text not null check (char_length(title) between 1 and 120),
  prompt_keys text[] not null check (private.ai_feature_keys_valid(prompt_keys)),
  purpose jsonb not null default '[]'::jsonb check (private.ai_feature_items_valid(purpose)),
  pass_questions jsonb not null default '[]'::jsonb
    check (private.ai_feature_items_valid(pass_questions)),
  approach jsonb not null default '[]'::jsonb check (private.ai_feature_items_valid(approach)),
  -- The story pipeline's four statuses; every feature starts as exploring (AI-PAGE-STATUS).
  status text not null default 'exploring'
    check (status in ('not_started', 'exploring', 'passed', 'frozen')),
  created_at timestamptz not null default now(),
  -- The last save of (a) to (c), and who made it. Deleting the account keeps the row.
  sections_updated_at timestamptz,
  sections_updated_by uuid references auth.users (id) on delete set null
);

alter table public.ai_features enable row level security;
revoke all on public.ai_features from public, anon, authenticated;
grant select on public.ai_features to authenticated;

create policy ai_features_read on public.ai_features
  for select
  to authenticated
  using ((select public.is_content_editor()));

create table public.ai_feature_status_history (
  id bigint generated always as identity primary key,
  feature_slug text not null references public.ai_features (slug) on delete cascade,
  from_status text not null check (from_status in ('not_started', 'exploring', 'passed', 'frozen')),
  to_status text not null check (to_status in ('not_started', 'exploring', 'passed', 'frozen')),
  note text check (note is null or char_length(note) between 1 and 500),
  -- The admin who changed it. Deleting the account keeps the row, without the account.
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  check (from_status <> to_status)
);

create index ai_feature_status_history_feature
  on public.ai_feature_status_history (feature_slug, changed_at desc);

alter table public.ai_feature_status_history enable row level security;
revoke all on public.ai_feature_status_history from public, anon, authenticated;
grant select on public.ai_feature_status_history to authenticated;

create policy ai_feature_status_history_read on public.ai_feature_status_history
  for select
  to authenticated
  using ((select public.is_content_editor()));

create table public.ai_feature_test_runs (
  id bigint generated always as identity primary key,
  feature_slug text not null references public.ai_features (slug) on delete cascade,
  prompt_key text not null check (prompt_key ~ '^[a-z][a-z0-9_]*$'),
  -- fake_model: the stub (the page marks it); real: the real model (#413).
  kind text not null check (kind in ('fake_model', 'real')),
  run_at timestamptz not null,
  -- The prompt version the run used, from the run's own record (null when it does not say).
  prompt_version integer check (prompt_version is null or prompt_version >= 1),
  -- Targets of the run's suite: PASS, FAIL, and how many there were in all (the others are
  -- pending scoring, no data or not judged because the run did not finish).
  pass_count integer not null check (pass_count >= 0),
  fail_count integer not null check (fail_count >= 0),
  target_count integer not null check (target_count >= pass_count + fail_count),
  summary text not null check (char_length(summary) between 1 and 2000),
  -- Where the report is: the run folder's report.md on the machine that ran it.
  report_path text not null check (char_length(report_path) between 1 and 500),
  imported_at timestamptz not null default now(),
  -- One row per feature, prompt key, kind and run: importing the same run again updates it.
  unique (feature_slug, prompt_key, kind, run_at)
);

create index ai_feature_test_runs_feature
  on public.ai_feature_test_runs (feature_slug, run_at desc);

alter table public.ai_feature_test_runs enable row level security;
revoke all on public.ai_feature_test_runs from public, anon, authenticated;
grant select on public.ai_feature_test_runs to authenticated;

create policy ai_feature_test_runs_read on public.ai_feature_test_runs
  for select
  to authenticated
  using ((select public.is_content_editor()));

-- Saves sections (a) to (c) of one feature. Content editors (admin or writer). The status is not
-- touched: only set_ai_feature_status changes it.
create function public.save_ai_feature_sections(
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

revoke all on function public.save_ai_feature_sections(text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_ai_feature_sections(text, jsonb, jsonb, jsonb)
  to authenticated;

-- Changes the status of one feature and writes the history row, in one transaction. Admin only
-- (AI-PAGE-STATUS): a writer, an account without a role and an anonymous caller are refused.
create function public.set_ai_feature_status(
  target_feature text,
  new_status text,
  change_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text;
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may change the status of an AI feature' using errcode = '42501';
  end if;
  if new_status is null or new_status not in ('not_started', 'exploring', 'passed', 'frozen') then
    raise exception 'unknown status %', new_status using errcode = '22023';
  end if;

  -- Locks the row, so two changes of one feature run one after the other.
  select status into old_status
  from public.ai_features
  where slug = target_feature
  for update;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;
  if old_status = new_status then
    raise exception 'AI feature % is already %', target_feature, new_status;
  end if;

  update public.ai_features set status = new_status where slug = target_feature;

  insert into public.ai_feature_status_history (feature_slug, from_status, to_status, note, changed_by)
  values (target_feature, old_status, new_status, nullif(btrim(change_note), ''), auth.uid());
end;
$$;

revoke all on function public.set_ai_feature_status(text, text, text) from public, anon, authenticated;
grant execute on function public.set_ai_feature_status(text, text, text) to authenticated;
