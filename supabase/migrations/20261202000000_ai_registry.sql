-- The AI feature registry, slice 1: the database (#473; spec #466 / #469: docs/PRD.md section 4.14,
-- FR-AIREG-1 to FR-AIREG-7; decisions AI-REGISTRY, AI-REGISTRY-FIELDS, AI-REGISTRY-STORE,
-- AI-PROMPT-CATEGORY, AI-REQUIREMENT-FIELD, AI-SEED-STATUS, AI-EXAMPLE-CONFIRM, AI-PAGE-EDIT;
-- docs/ai/AI_11_feature-pages.md section 5; docs/decisions/0033). Run after
-- 20261130000000_ai_features.sql and 20261201000000_ai_feature_people.sql.
--
-- There is no second registry table (AI-REGISTRY-STORE). This file:
--
-- 1. Extends public.ai_features with the registry fields: feature_id ("P-01", "G-03", "R-07"),
--    category (pipeline, gate or runtime), where it appears, requirement, output format and rules,
--    design rationale, room to improve, notes, and the example (its text, its state none,
--    candidate or confirmed, who set it and when). An empty text is a field with no source: the
--    page shows "Not written yet" (FR-AIREG-4). The rows already there (the 7 runtime features)
--    keep their slug, position, title, prompt keys, sections (a) to (c), status and status
--    history: they only get their feature_id (R-01 to R-07, by slug) and the category runtime;
--    every new text field starts empty and the example starts as none.
-- 2. Adds public.ai_feature_field_history (FR-AIREG-7: every change to a field, who, when, the
--    field, the old and the new value) and public.ai_feature_example_history (every example set,
--    who and when, so a replaced confirmed example stays in history, AI-EXAMPLE-CONFIRM). The
--    status keeps its own history (public.ai_feature_status_history, unchanged).
-- 3. Who writes what, checked in the database (AI-PAGE-EDIT, extended 2026-11-26): content editors
--    (admin or writer) save the fields through public.save_ai_feature_fields and the example
--    through public.set_ai_feature_example; only the admin role changes the category, through
--    public.set_ai_feature_category (and the status, through the unchanged
--    public.set_ai_feature_status). public.save_ai_feature_sections now also writes a field
--    history row for each of (a) to (c) it changes. Each function writes its history rows in its
--    own transaction. No API role inserts, updates or deletes a table directly; content editors
--    read the two new tables, accounts without a role and anonymous callers read nothing.
-- 4. Adds public.prompts.category (runtime, pipeline or gate; every existing row is runtime). A
--    new version of a key keeps the key's category (a trigger), so a draft of a pipeline prompt
--    never becomes runtime. public.get_active_prompts, the app's only prompt read, returns runtime
--    rows only (AI-PROMPT-CATEGORY, FR-AIREG-5); public.list_prompt_versions, the admin's read,
--    still returns every row and now says each row's category.
--
-- The 12 pipeline and quality gate rows are not inserted here: scripts/ai-features/registry-seed.mjs
-- prints that SQL from the owner's registry-seed.json, and
-- scripts/ai-features/import-pipeline-prompts.mjs prints their prompt rows. Running this file a
-- second time stops at the first statement (the column exists) and changes nothing.

-- 1. The registry fields of public.ai_features.

alter table public.ai_features
  add column feature_id text unique check (feature_id ~ '^[PGR]-[0-9]{2}$'),
  add column category text not null default 'runtime'
    check (category in ('pipeline', 'gate', 'runtime')),
  add column where_used text not null default '' check (char_length(where_used) <= 300),
  add column requirement text not null default '' check (char_length(requirement) <= 4000),
  add column output_format text not null default '' check (char_length(output_format) <= 4000),
  add column design_rationale text not null default ''
    check (char_length(design_rationale) <= 4000),
  add column room_to_improve text not null default ''
    check (char_length(room_to_improve) <= 4000),
  add column notes text not null default '' check (char_length(notes) <= 4000),
  add column example_text text not null default '' check (char_length(example_text) <= 8000),
  add column example_state text not null default 'none'
    check (example_state in ('none', 'candidate', 'confirmed')),
  -- Who set the example and when; null for a seeded example. Deleting the account keeps the row.
  add column example_set_by uuid references auth.users (id) on delete set null,
  add column example_set_at timestamptz,
  -- The last save of the fields above, and who made it.
  add column fields_updated_at timestamptz,
  add column fields_updated_by uuid references auth.users (id) on delete set null;

-- The rows already there are the 7 runtime features (AI_11 section 5.2, R-01 to R-07 in order).
update public.ai_features
set feature_id = case slug
  when 'plan_split' then 'R-01'
  when 'step_cards' then 'R-02'
  when 'pause_message' then 'R-03'
  when 'rest_reply' then 'R-04'
  when 'return_popup' then 'R-05'
  when 'closing_line' then 'R-06'
  when 'safety_classifier' then 'R-07'
end;

do $$
begin
  if exists (select 1 from public.ai_features where feature_id is null) then
    raise exception 'an AI feature row has a slug that is not one of the 7 runtime features';
  end if;
end;
$$;

alter table public.ai_features
  alter column feature_id set not null,
  -- A new row names its category; only the existing rows took the default.
  alter column category drop default;

-- 2. The field history and the example history.

create table public.ai_feature_field_history (
  id bigint generated always as identity primary key,
  feature_slug text not null references public.ai_features (slug) on delete cascade,
  field text not null check (
    field in (
      'category', 'where_used', 'requirement', 'output_format', 'design_rationale',
      'room_to_improve', 'notes', 'purpose', 'pass_questions', 'approach'
    )
  ),
  -- The value before and after, as JSON: a string for a text field, the list for (a) to (c).
  old_value jsonb not null,
  new_value jsonb not null,
  -- Who changed it. Deleting the account keeps the row, without the account.
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index ai_feature_field_history_feature
  on public.ai_feature_field_history (feature_slug, changed_at desc);

alter table public.ai_feature_field_history enable row level security;
revoke all on public.ai_feature_field_history from public, anon, authenticated;
grant select on public.ai_feature_field_history to authenticated;

create policy ai_feature_field_history_read on public.ai_feature_field_history
  for select
  to authenticated
  using ((select public.is_content_editor()));

create table public.ai_feature_example_history (
  id bigint generated always as identity primary key,
  feature_slug text not null references public.ai_features (slug) on delete cascade,
  -- The example as it was set: the newest row is the current one, the older rows were replaced.
  example_text text not null check (char_length(example_text) <= 8000),
  example_state text not null check (example_state in ('none', 'candidate', 'confirmed')),
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now()
);

create index ai_feature_example_history_feature
  on public.ai_feature_example_history (feature_slug, set_at desc);

alter table public.ai_feature_example_history enable row level security;
revoke all on public.ai_feature_example_history from public, anon, authenticated;
grant select on public.ai_feature_example_history to authenticated;

create policy ai_feature_example_history_read on public.ai_feature_example_history
  for select
  to authenticated
  using ((select public.is_content_editor()));

-- 3. The write functions.

-- One field history row when a value changed. Called only by the functions below.
create function private.record_ai_feature_field(
  target_feature text,
  field_name text,
  old_value jsonb,
  new_value jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if old_value is distinct from new_value then
    insert into public.ai_feature_field_history (feature_slug, field, old_value, new_value, changed_by)
    values (target_feature, field_name, old_value, new_value, auth.uid());
  end if;
end;
$$;

revoke all on function private.record_ai_feature_field(text, text, jsonb, jsonb)
  from public, anon, authenticated;

-- Saves the registry text fields of one feature, with a history row for each field that changed.
-- Content editors (admin or writer). The category, the status and the example are not touched.
create function public.save_ai_feature_fields(
  target_feature text,
  new_where_used text,
  new_requirement text,
  new_output_format text,
  new_design_rationale text,
  new_room_to_improve text,
  new_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.ai_features%rowtype;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may change an AI feature' using errcode = '42501';
  end if;
  if new_where_used is null or new_requirement is null or new_output_format is null
    or new_design_rationale is null or new_room_to_improve is null or new_notes is null
  then
    raise exception 'a registry field is text, never null' using errcode = '22004';
  end if;

  -- Locks the row, so two saves of one feature run one after the other.
  select * into old from public.ai_features where slug = target_feature for update;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;

  update public.ai_features
  set where_used = new_where_used,
    requirement = new_requirement,
    output_format = new_output_format,
    design_rationale = new_design_rationale,
    room_to_improve = new_room_to_improve,
    notes = new_notes,
    fields_updated_at = now(),
    fields_updated_by = auth.uid()
  where slug = target_feature;

  perform private.record_ai_feature_field(target_feature, 'where_used',
    to_jsonb(old.where_used), to_jsonb(new_where_used));
  perform private.record_ai_feature_field(target_feature, 'requirement',
    to_jsonb(old.requirement), to_jsonb(new_requirement));
  perform private.record_ai_feature_field(target_feature, 'output_format',
    to_jsonb(old.output_format), to_jsonb(new_output_format));
  perform private.record_ai_feature_field(target_feature, 'design_rationale',
    to_jsonb(old.design_rationale), to_jsonb(new_design_rationale));
  perform private.record_ai_feature_field(target_feature, 'room_to_improve',
    to_jsonb(old.room_to_improve), to_jsonb(new_room_to_improve));
  perform private.record_ai_feature_field(target_feature, 'notes',
    to_jsonb(old.notes), to_jsonb(new_notes));
end;
$$;

revoke all on function public.save_ai_feature_fields(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_ai_feature_fields(text, text, text, text, text, text, text)
  to authenticated;

-- Sets the example of one feature (its text and its state) and keeps it in the example history.
-- Any content editor may mark an example candidate or confirmed (AI-EXAMPLE-CONFIRM).
create function public.set_ai_feature_example(
  target_feature text,
  new_text text,
  new_state text
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
  if new_state is null or new_state not in ('none', 'candidate', 'confirmed') then
    raise exception 'unknown example state %', new_state using errcode = '22023';
  end if;
  if new_text is null then
    raise exception 'an example is text, never null' using errcode = '22004';
  end if;

  perform 1 from public.ai_features where slug = target_feature for update;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;

  update public.ai_features
  set example_text = new_text,
    example_state = new_state,
    example_set_by = auth.uid(),
    example_set_at = now()
  where slug = target_feature;

  insert into public.ai_feature_example_history (feature_slug, example_text, example_state, set_by)
  values (target_feature, new_text, new_state, auth.uid());
end;
$$;

revoke all on function public.set_ai_feature_example(text, text, text)
  from public, anon, authenticated;
grant execute on function public.set_ai_feature_example(text, text, text) to authenticated;

-- Changes the category of one feature, with a field history row. Admin only (PRD section 4.14,
-- Roles): a writer, an account without a role and an anonymous caller are refused.
create function public.set_ai_feature_category(target_feature text, new_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_category text;
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may change the category of an AI feature'
      using errcode = '42501';
  end if;
  if new_category is null or new_category not in ('pipeline', 'gate', 'runtime') then
    raise exception 'unknown category %', new_category using errcode = '22023';
  end if;

  select category into old_category
  from public.ai_features
  where slug = target_feature
  for update;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;
  if old_category = new_category then
    raise exception 'AI feature % is already %', target_feature, new_category;
  end if;

  update public.ai_features set category = new_category where slug = target_feature;
  perform private.record_ai_feature_field(target_feature, 'category',
    to_jsonb(old_category), to_jsonb(new_category));
end;
$$;

revoke all on function public.set_ai_feature_category(text, text) from public, anon, authenticated;
grant execute on function public.set_ai_feature_category(text, text) to authenticated;

-- As in 20261130000000_ai_features.sql, plus a field history row for each section that changed
-- (FR-AIREG-7). Same signature, same checks, same rights.
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
declare
  old public.ai_features%rowtype;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may change an AI feature' using errcode = '42501';
  end if;
  select * into old from public.ai_features where slug = target_feature for update;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;
  update public.ai_features
  set purpose = new_purpose,
    pass_questions = new_pass_questions,
    approach = new_approach,
    sections_updated_at = now(),
    sections_updated_by = auth.uid()
  where slug = target_feature;
  perform private.record_ai_feature_field(target_feature, 'purpose', old.purpose, new_purpose);
  perform private.record_ai_feature_field(target_feature, 'pass_questions',
    old.pass_questions, new_pass_questions);
  perform private.record_ai_feature_field(target_feature, 'approach', old.approach, new_approach);
end;
$$;

-- 4. The category of each prompt key.

alter table public.prompts
  add column category text not null default 'runtime'
    check (category in ('runtime', 'pipeline', 'gate'));

-- A new version of a key that already has rows keeps that key's category, whatever the insert
-- says: a draft saved in the admin (save_prompt_draft) and a version made by import_prompt name no
-- category. The first row of a new key keeps the category it was inserted with.
create function private.keep_prompt_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  key_category text;
begin
  select p.category into key_category
  from public.prompts p
  where p.key = new.key
  limit 1;
  if key_category is not null then
    new.category := key_category;
  end if;
  return new;
end;
$$;

revoke all on function private.keep_prompt_category() from public, anon, authenticated;

create trigger prompts_keep_category
  before insert on public.prompts
  for each row execute function private.keep_prompt_category();

-- As in 20261115000000_prompts.sql, for runtime keys only: the app never reads a pipeline or
-- quality gate prompt (AI-PROMPT-CATEGORY). Same signature and rights.
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
    and p.category = 'runtime'
    and exists (
      select 1
      from private.prompt_reader r
      where r.token_sha256 = encode(sha256(convert_to(reader_token, 'UTF8')), 'hex')
    );
$$;

-- As in 20261125000000_prompt_editing.sql, with each row's category at the end. The admin reads
-- every key, whatever its category. A new column changes the return type, so the function is
-- dropped and made again, with the same rights.
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
  activated_at timestamptz,
  category text
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
  select p.key, p.version, p.active, p.body, p.params, p.note, p.created_at, p.activated_at,
    p.category
  from public.prompts p
  order by p.key, p.version desc;
end;
$$;

revoke all on function public.list_prompt_versions() from public, anon, authenticated;
grant execute on function public.list_prompt_versions() to authenticated;
