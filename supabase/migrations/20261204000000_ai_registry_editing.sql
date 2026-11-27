-- The AI feature registry, slice 3: editing (#475; docs/PRD.md section 4.14, FR-AIREG-7,
-- AI-PAGE-EDIT, AI-EXAMPLE-CONFIRM; docs/decisions/0035). Run after
-- 20261202000000_ai_registry.sql (and 20261203000000_ai_runs.sql, which it does not touch).
--
-- 20261202000000_ai_registry.sql already saves the registry text fields
-- (public.save_ai_feature_fields), the example (public.set_ai_feature_example) and the category
-- (public.set_ai_feature_category, admin only), each with its history. Two things the editors need
-- are missing, and this file adds them:
--
-- 1. The Name. PRD section 4.14 lets an admin or a writer edit it, but no function writes
--    public.ai_features.title and the field history does not accept the field "title". The title is
--    the name followed by the prompt keys in brackets (AI-PAGE-TITLES), so the editor sends the
--    name only and the function keeps the last bracket part as it is. A name may hold brackets,
--    also at its end ("Plan (historical)"); only on a title with no keys group is a name that ends
--    in brackets refused (the page would read that end as the keys).
--    public.save_ai_feature_registry_fields saves the name and the six text fields in one
--    transaction, with one history row for each field that changed, and refuses the save when
--    someone else saved the fields after the editor loaded them (fields_updated_at), so a newer
--    save is never overwritten. Content editors (admin or writer). The category, the status and
--    the example are not touched.
-- 2. Who made a change. public.list_ai_feature_people (20261201000000) returns the email of the
--    accounts in a feature's status history and its last (a) to (c) editor only. It now also
--    returns the accounts in the field history and the example history, the last registry field
--    editor and whoever set the example, so the editors show an email, not an account id. Same
--    signature, same rights (content editors; 42501 otherwise).
--
-- Running this file a second time stops at the first statement (the constraint it drops is gone; its
-- replacement has another name) and changes nothing.

-- 1. The name and its history.

alter table public.ai_feature_field_history
  drop constraint ai_feature_field_history_field_check;

alter table public.ai_feature_field_history
  add constraint ai_feature_field_history_field_names check (
    field in (
      'title', 'category', 'where_used', 'requirement', 'output_format', 'design_rationale',
      'room_to_improve', 'notes', 'purpose', 'pass_questions', 'approach'
    )
  );

-- Saves the name and the registry text fields of one feature in one transaction. Answers the new
-- fields_updated_at, which the editor sends back with its next save.
create function public.save_ai_feature_registry_fields(
  target_feature text,
  loaded_at timestamptz,
  new_name text,
  new_where_used text,
  new_requirement text,
  new_output_format text,
  new_design_rationale text,
  new_room_to_improve text,
  new_notes text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.ai_features%rowtype;
  keys text;
  next_title text;
  saved_at timestamptz;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may change an AI feature' using errcode = '42501';
  end if;
  if new_name is null then
    raise exception 'a registry field is text, never null' using errcode = '22004';
  end if;
  if btrim(new_name) = '' then
    raise exception 'a feature needs a name' using errcode = '22023';
  end if;

  -- Locks the row, so two saves of one feature run one after the other.
  select * into old from public.ai_features where slug = target_feature for update;
  if not found then
    raise exception 'no AI feature %', target_feature using errcode = 'P0002';
  end if;
  if old.fields_updated_at is distinct from loaded_at then
    raise exception 'AI feature % was saved after it was loaded', target_feature
      using errcode = '40001';
  end if;

  -- The bracket part of the title (" (plan_split)"), kept as it is (AI-PAGE-TITLES).
  keys := coalesce(substring(old.title from '\s*\([^)]*\)\s*$'), '');
  -- A name may hold brackets, also at its end ("Plan (historical)"): the prompt keys follow it, and
  -- the page takes only the last bracket group as the keys. Without a keys group in the title, a
  -- name ending in brackets would lose that end on the page, so it is refused.
  if keys = '' and btrim(new_name) ~ '\([^)]*\)$' then
    raise exception 'a name ends in brackets but the title has no prompt keys after it'
      using errcode = '22023';
  end if;
  next_title := btrim(new_name) || keys;
  if next_title is distinct from old.title then
    update public.ai_features set title = next_title where slug = target_feature;
    perform private.record_ai_feature_field(target_feature, 'title',
      to_jsonb(old.title), to_jsonb(next_title));
  end if;

  -- The six text fields, their history rows and fields_updated_at / _by (20261202000000).
  perform public.save_ai_feature_fields(target_feature, new_where_used, new_requirement,
    new_output_format, new_design_rationale, new_room_to_improve, new_notes);

  select fields_updated_at into saved_at from public.ai_features where slug = target_feature;
  return saved_at;
end;
$$;

revoke all on function public.save_ai_feature_registry_fields(
  text, timestamptz, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.save_ai_feature_registry_fields(
  text, timestamptz, text, text, text, text, text, text, text
) to authenticated;

-- 2. Who made each change: as in 20261201000000_ai_feature_people.sql, plus the registry's
-- history tables and columns (20261202000000_ai_registry.sql). Same signature and rights.
create or replace function public.list_ai_feature_people(target_feature text)
returns table (
  user_id uuid,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may read who changed an AI feature' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text
  from auth.users u
  where u.id in (
    select h.changed_by
    from public.ai_feature_status_history h
    where h.feature_slug = target_feature and h.changed_by is not null
    union
    select h.changed_by
    from public.ai_feature_field_history h
    where h.feature_slug = target_feature and h.changed_by is not null
    union
    select h.set_by
    from public.ai_feature_example_history h
    where h.feature_slug = target_feature and h.set_by is not null
    union
    select f.sections_updated_by
    from public.ai_features f
    where f.slug = target_feature and f.sections_updated_by is not null
    union
    select f.fields_updated_by
    from public.ai_features f
    where f.slug = target_feature and f.fields_updated_by is not null
    union
    select f.example_set_by
    from public.ai_features f
    where f.slug = target_feature and f.example_set_by is not null
  );
end;
$$;
