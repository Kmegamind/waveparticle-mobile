-- Editing prompts in the admin (#308, ADM-08, decision ADMIN; docs/decisions/0025). Run after
-- 20261124000000_content_fields.sql (#310), which ran after 20261123000000_story_card_editing.sql:
-- this file widens the same history kind check again and replaces the same list_publish_history,
-- keeping every kind those files added.
--
-- 1. An admin or writer saves a prompt's text, settings and note as a DRAFT: a new version of the
--    key (max + 1, never reused) that is not active. The active version is untouched, and
--    get_active_prompts (20261115000000_prompts.sql, unchanged) returns active rows only, so the
--    gateway never reads a draft.
-- 2. Only the admin role publishes a version or rolls back to one. Both go through
--    private.set_active_prompt, which makes the version the one active version with the existing
--    public.activate_prompt and writes a publish_history row (kind 'prompt') in the same
--    transaction, as app text (#289) and story cards (#304) do.
-- 3. The gateway's own row check (an unknown {{name}}, a missing or unusable setting) runs in the
--    app on every save and again on the server before Publish and Roll back; the database checks
--    the role. No key with full database rights is needed: every function runs for auth.uid().
--
-- The table stays closed to the API (row level security on, no policy). The import
-- (import_prompt) and the server read keep working as before; an import writes no history row.

alter table public.prompts
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null,
  add column activated_at timestamptz,
  add column activated_by uuid references auth.users (id) on delete set null;

-- The version active now was made active by the import; from now on it counts as published before,
-- so a later roll back can return to it.
update public.prompts set activated_at = created_at where active;

-- ADM-08: every version of every prompt, for content editors only.
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

-- Saves a new draft version of an existing prompt and returns its version number.
create function public.save_prompt_draft(
  prompt_key text,
  prompt_body text,
  prompt_params jsonb,
  prompt_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may save a prompt' using errcode = '42501';
  end if;
  if jsonb_typeof(prompt_params) is distinct from 'object' then
    raise exception 'the settings of a prompt must be a JSON object' using errcode = '22023';
  end if;
  -- Serialises saves of one key, so two saves never pick the same number.
  perform pg_advisory_xact_lock(hashtext('prompt:' || prompt_key));
  if not exists (select 1 from public.prompts where key = prompt_key) then
    raise exception 'no prompt %', prompt_key using errcode = 'P0002';
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.prompts
  where key = prompt_key;
  insert into public.prompts (key, version, body, params, note, created_by)
  values (prompt_key, next_version, prompt_body, prompt_params, coalesce(prompt_note, ''), auth.uid());
  return next_version;
end;
$$;

revoke all on function public.save_prompt_draft(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_prompt_draft(text, text, jsonb, text) to authenticated;

-- The one place a prompt version becomes the active one, for Publish and Roll back alike, with its
-- history row. The same rules as private.set_published_story_card (20261123000000).
create function private.set_active_prompt(
  prompt_key text,
  prompt_version integer,
  publish_action text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_version integer;
  target_active boolean;
  target_activated_at timestamptz;
begin
  if publish_action not in ('publish', 'roll_back') then
    raise exception 'unknown publish action %', publish_action;
  end if;

  -- Locks the key's rows, so two publishes of one key run one after the other.
  perform 1 from public.prompts where key = prompt_key for update;

  select active, activated_at into target_active, target_activated_at
  from public.prompts
  where key = prompt_key and version = prompt_version;
  if not found then
    raise exception 'no prompt % version %', prompt_key, prompt_version using errcode = 'P0002';
  end if;
  if target_active then
    raise exception 'prompt % version % is already active', prompt_key, prompt_version;
  end if;

  select version into current_version
  from public.prompts
  where key = prompt_key and active;

  if publish_action = 'roll_back'
    and (current_version is null or target_activated_at is null)
  then
    raise exception 'roll back needs a version of % that was active before', prompt_key;
  end if;

  perform public.activate_prompt(prompt_key, prompt_version);
  update public.prompts
  set activated_at = now(), activated_by = auth.uid()
  where key = prompt_key and version = prompt_version;

  insert into public.publish_history (kind, item_key, version, action, acted_by)
  values ('prompt', prompt_key, prompt_version, publish_action, auth.uid());
end;
$$;

revoke all on function private.set_active_prompt(text, integer, text) from public, anon, authenticated;

-- Publish: makes a version (normally the newest draft) the active one. Admin role only.
create function public.publish_prompt(prompt_key text, prompt_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may publish a prompt' using errcode = '42501';
  end if;
  perform private.set_active_prompt(prompt_key, prompt_version, 'publish');
end;
$$;

revoke all on function public.publish_prompt(text, integer) from public, anon, authenticated;
grant execute on function public.publish_prompt(text, integer) to authenticated;

-- Roll back: makes a version that was active before the active one again. Admin role only.
create function public.roll_back_prompt(prompt_key text, prompt_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may roll back a prompt' using errcode = '42501';
  end if;
  perform private.set_active_prompt(prompt_key, prompt_version, 'roll_back');
end;
$$;

revoke all on function public.roll_back_prompt(text, integer) from public, anon, authenticated;
grant execute on function public.roll_back_prompt(text, integer) to authenticated;

-- The history takes prompt rows, and keeps every kind before it (#289, #304, #310).
alter table public.publish_history
  drop constraint publish_history_kind_check,
  add constraint publish_history_kind_check check (
    kind in ('app_text', 'story_card', 'companion_field', 'story_field', 'prompt')
  );

-- ADM-12: as in 20261124000000_content_fields.sql, plus whether a prompt row's version is the
-- active one now.
create or replace function public.list_publish_history(row_limit integer default 100)
returns table (
  id bigint,
  kind text,
  item_key text,
  version integer,
  action text,
  acted_by uuid,
  acted_by_email text,
  acted_at timestamptz,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may read the publish history' using errcode = '42501';
  end if;
  return query
  select
    h.id,
    h.kind,
    h.item_key,
    h.version,
    h.action,
    h.acted_by,
    u.email::text,
    h.acted_at,
    case h.kind
      when 'app_text' then exists (
        select 1 from public.app_text t
        where t.key = h.item_key and t.version = h.version and t.published
      )
      when 'story_card' then exists (
        select 1 from public.story_cards c
        where c.key = h.item_key and c.version = h.version and c.published
      )
      when 'companion_field' then exists (
        select 1 from public.content_fields f
        where f.key = h.item_key and f.version = h.version and f.published
      )
      when 'story_field' then exists (
        select 1 from public.content_fields f
        where f.key = h.item_key and f.version = h.version and f.published
      )
      when 'prompt' then exists (
        select 1 from public.prompts p
        where p.key = h.item_key and p.version = h.version and p.active
      )
      else false
    end
  from public.publish_history h
  left join auth.users u on u.id = h.acted_by
  order by h.acted_at desc, h.id desc
  limit least(greatest(coalesce(row_limit, 100), 1), 500);
end;
$$;

revoke all on function public.list_publish_history(integer) from public, anon, authenticated;
grant execute on function public.list_publish_history(integer) to authenticated;
