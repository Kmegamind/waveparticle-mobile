-- Companion and story fields edited in the admin (#309, ADM-03 to ADM-05, docs/decisions/0024).
-- Run after 20261123000000_story_card_editing.sql.
--
-- 1. Two new display fields: a Companion's "Who I am" (companions.who) and a story's Life Path
--    description (stories.path). Only the admin shows them for now.
-- 2. public.content_fields keeps every version of every edited field, as app_text does (#288):
--      chr.<code>.name | tags | who | period.<n>          a Companion (n: its n-th Life Path period)
--      <code>.<story>.title | period | goal | who | opening | path    a story
--    <code> is the Companion's key_code (NAMING). A save adds a draft and changes nothing the app
--    reads. Publish copies the text into the column that get_story_content (#284) already reads,
--    so get_story_content is unchanged and a draft never reaches a phone.
-- 3. Save: admin or writer. Publish and roll back: the admin role only. Each publish and roll back
--    writes a publish_history row (kind companion_field or story_field) in the same transaction.
-- 4. The app checks every text (blank, length, a year, date or age, the opening's question, the
--    period rules) on save and again before publish. The database checks the role and the period
--    rules again: a story stays in its own period or moves to a neighbouring one, never out of a
--    period it is alone in, and no two periods share a name.
-- No key with full database rights is needed: every function runs for auth.uid().

alter table public.companions
  add column who text not null default '';
alter table public.stories
  add column path text not null default '';

create table public.content_fields (
  key text not null check (
    key ~ '^(chr\.[a-z]{2,8}\.(name|tags|who|period\.[1-9][0-9]{0,2})|[a-z]{2,8}\.[a-z0-9][a-z0-9-]*\.(title|period|goal|who|opening|path))$'
  ),
  version integer not null check (version >= 1),
  companion_id text not null references public.companions (id) on delete cascade,
  -- Null for a Companion's own fields.
  story_id text references public.stories (id) on delete cascade,
  field text not null
    check (field in ('name', 'tags', 'who', 'period', 'title', 'goal', 'opening', 'path')),
  body text not null check (body ~ '\S') check (char_length(body) <= 1000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- The last time this version became the published one; it stays set afterwards, so a roll back
  -- can tell an earlier published version from a draft never published (as app_text).
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  primary key (key, version)
);

create unique index content_fields_one_published_per_key
  on public.content_fields (key) where published;

alter table public.content_fields enable row level security;
revoke all on public.content_fields from public, anon, authenticated;
-- Every column but who saved or published a version.
grant select (key, version, companion_id, story_id, field, body, published, created_at, published_at)
  on public.content_fields to authenticated;

create policy content_fields_read on public.content_fields
  for select
  to authenticated
  using ((select public.is_content_editor()));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- A Companion's stories in order with their Life Path period number: each run of neighbouring
-- stories with one period name is one period.
create function private.story_periods(companion text)
returns table (story_id text, sequence integer, period text, period_number integer)
language sql
stable
set search_path = ''
as $$
  select o.id, o.sequence, o.period,
    (sum(case when o.previous is distinct from o.period then 1 else 0 end)
      over (order by o.sequence))::integer
  from (
    select s.id, s.sequence, s.period, lag(s.period) over (order by s.sequence) as previous
    from public.stories s
    where s.companion_id = companion
  ) o
  order by o.sequence;
$$;

revoke all on function private.story_periods(text) from public, anon, authenticated;

-- What a key names, and the text the app shows for it now. Raises P0002 for an unknown key.
create function private.resolve_content_field(
  field_key text,
  out companion text,
  out story text,
  out field_name text,
  out period_number integer,
  out current_body text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := regexp_match(field_key, '^chr\.([a-z]{2,8})\.(name|tags|who|period)(\.([1-9][0-9]{0,2}))?$');
  if parts is not null then
    if (parts[2] = 'period') <> (parts[4] is not null) then
      raise exception 'no content field %', field_key using errcode = 'P0002';
    end if;
    select c.id into companion from public.companions c where c.key_code = parts[1];
    if companion is null then
      raise exception 'no content field %', field_key using errcode = 'P0002';
    end if;
    field_name := parts[2];
    if field_name = 'period' then
      period_number := parts[4]::integer;
      select p.period into current_body
      from private.story_periods(companion) p
      where p.period_number = resolve_content_field.period_number
      limit 1;
      if current_body is null then
        raise exception 'no content field %', field_key using errcode = 'P0002';
      end if;
    else
      select case field_name when 'name' then c.name when 'tags' then c.tags else c.who end
      into current_body
      from public.companions c
      where c.id = companion;
    end if;
    return;
  end if;

  parts := regexp_match(field_key, '^([a-z]{2,8})\.([a-z0-9][a-z0-9-]*)\.(title|period|goal|who|opening|path)$');
  if parts is null then
    raise exception 'no content field %', field_key using errcode = 'P0002';
  end if;
  field_name := parts[3];
  select s.companion_id, s.id,
    case field_name
      when 'title' then s.title
      when 'period' then s.period
      when 'goal' then s.goal_short
      when 'who' then s.who
      when 'opening' then s.opening
      else s.path
    end
  into companion, story, current_body
  from public.stories s
  join public.companions c on c.id = s.companion_id
  where c.key_code = parts[1] and s.id = parts[2];
  if story is null then
    raise exception 'no content field %', field_key using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.resolve_content_field(text) from public, anon, authenticated;

-- Saves a text as a new draft version of its field and returns the version number. The first
-- save of a field keeps the text the app shows now as version 1, published, so a roll back can
-- always return to it (not when that text is blank, as the two new fields are at first).
create function public.save_content_field_draft(field_key text, field_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  next_version integer;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may save a field' using errcode = '42501';
  end if;
  -- Serialises saves of one key, so two saves never pick the same number.
  perform pg_advisory_xact_lock(hashtext('content_field:' || field_key));
  select * into target from private.resolve_content_field(field_key);
  if not exists (select 1 from public.content_fields where key = field_key)
    and target.current_body ~ '\S'
  then
    insert into public.content_fields (
      key, version, companion_id, story_id, field, body, published, published_at, created_by
    )
    values (field_key, 1, target.companion, target.story, target.field_name, target.current_body, true, now(), null);
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.content_fields
  where key = field_key;
  insert into public.content_fields (key, version, companion_id, story_id, field, body, created_by)
  values (field_key, next_version, target.companion, target.story, target.field_name, field_body, auth.uid());
  return next_version;
end;
$$;

revoke all on function public.save_content_field_draft(text, text) from public, anon, authenticated;
grant execute on function public.save_content_field_draft(text, text) to authenticated;

-- The period rules, checked again at publish (the app checks them on save): null when the text
-- may be published, otherwise the reason.
create function private.content_field_problem(
  companion text,
  story text,
  field_name text,
  period_number integer,
  field_body text
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if field_name <> 'period' then
    return null;
  end if;
  if story is not null then
    -- Its own period; or, when its period has more than one story, the period of the story just
    -- before or after it (a story in the middle of its period has its own period on both sides).
    select field_body = p.period
      or (p.size > 1 and (field_body = p.previous_period or field_body = p.next_period))
    into allowed
    from (
      select x.story_id, x.period,
        count(*) over (partition by x.period_number) as size,
        lag(x.period) over (order by x.sequence) as previous_period,
        lead(x.period) over (order by x.sequence) as next_period
      from private.story_periods(companion) x
    ) p
    where p.story_id = story;
    if allowed is not true then
      return 'a story stays in its own period or moves to a neighbouring one';
    end if;
    return null;
  end if;
  if exists (
    select 1 from private.story_periods(companion) p
    where p.period_number <> content_field_problem.period_number and p.period = field_body
  ) then
    return 'another period already has this name';
  end if;
  return null;
end;
$$;

revoke all on function private.content_field_problem(text, text, text, integer, text) from public, anon, authenticated;

-- Writes a published text into the column the app reads.
create function private.apply_content_field(
  companion text,
  story text,
  field_name text,
  period_number integer,
  field_body text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if story is null then
    if field_name = 'name' then
      update public.companions set name = field_body, updated_at = now() where id = companion;
    elsif field_name = 'tags' then
      update public.companions set tags = field_body, updated_at = now() where id = companion;
    elsif field_name = 'who' then
      update public.companions set who = field_body, updated_at = now() where id = companion;
    elsif field_name = 'period' then
      -- A period name renames every story of that period.
      update public.stories set period = field_body, updated_at = now()
      where id in (
        select p.story_id from private.story_periods(companion) p
        where p.period_number = apply_content_field.period_number
      );
    end if;
    return;
  end if;
  if field_name = 'title' then
    update public.stories set title = field_body, updated_at = now() where id = story;
  elsif field_name = 'period' then
    update public.stories set period = field_body, updated_at = now() where id = story;
  elsif field_name = 'goal' then
    update public.stories set goal_short = field_body, updated_at = now() where id = story;
  elsif field_name = 'who' then
    update public.stories set who = field_body, updated_at = now() where id = story;
  elsif field_name = 'opening' then
    update public.stories set opening = field_body, updated_at = now() where id = story;
  elsif field_name = 'path' then
    update public.stories set path = field_body, updated_at = now() where id = story;
  end if;
end;
$$;

revoke all on function private.apply_content_field(text, text, text, integer, text) from public, anon, authenticated;

-- The one place a field version becomes the published one, for Publish and Roll back alike: the
-- same checks as app text, the period rules, the column write and the history row, in one
-- transaction.
create function private.set_published_content_field(
  field_key text,
  field_version integer,
  publish_action text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  target record;
  current_version integer;
  target_row public.content_fields%rowtype;
  problem text;
begin
  if publish_action not in ('publish', 'roll_back') then
    raise exception 'unknown publish action %', publish_action;
  end if;
  select * into target from private.resolve_content_field(field_key);

  -- Locks the key's rows and the Companion's stories, so two publishes that change periods run
  -- one after the other.
  perform 1 from public.content_fields where key = field_key for update;
  perform 1 from public.stories where companion_id = target.companion for update;

  select * into target_row
  from public.content_fields
  where key = field_key and version = field_version;
  if not found then
    raise exception 'no field % version %', field_key, field_version using errcode = 'P0002';
  end if;
  if target_row.published then
    raise exception 'field % version % is already published', field_key, field_version;
  end if;

  select version into current_version
  from public.content_fields
  where key = field_key and published;
  if publish_action = 'roll_back'
    and (current_version is null or target_row.published_at is null)
  then
    raise exception 'roll back needs a version of % that was published before', field_key;
  end if;

  problem := private.content_field_problem(
    target.companion, target.story, target.field_name, target.period_number, target_row.body
  );
  if problem is not null then
    raise exception 'field % version %: %', field_key, field_version, problem using errcode = '23514';
  end if;

  update public.content_fields set published = false
  where key = field_key and published;
  update public.content_fields
  set published = true, published_at = now(), published_by = auth.uid()
  where key = field_key and version = field_version;

  perform private.apply_content_field(
    target.companion, target.story, target.field_name, target.period_number, target_row.body
  );

  insert into public.publish_history (kind, item_key, version, action, acted_by)
  values (
    case when target.story is null then 'companion_field' else 'story_field' end,
    field_key, field_version, publish_action, auth.uid()
  );
end;
$$;

revoke all on function private.set_published_content_field(text, integer, text) from public, anon, authenticated;

-- Publish: makes a version (normally the newest draft) the one the app shows. Admin role only.
create function public.publish_content_field(field_key text, field_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may publish a field' using errcode = '42501';
  end if;
  perform private.set_published_content_field(field_key, field_version, 'publish');
end;
$$;

revoke all on function public.publish_content_field(text, integer) from public, anon, authenticated;
grant execute on function public.publish_content_field(text, integer) to authenticated;

-- Roll back: publishes a version that was published before again. Admin role only.
create function public.roll_back_content_field(field_key text, field_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may roll back a field' using errcode = '42501';
  end if;
  perform private.set_published_content_field(field_key, field_version, 'roll_back');
end;
$$;

revoke all on function public.roll_back_content_field(text, integer) from public, anon, authenticated;
grant execute on function public.roll_back_content_field(text, integer) to authenticated;

-- The history takes the two new kinds.
alter table public.publish_history
  drop constraint publish_history_kind_check,
  add constraint publish_history_kind_check check (kind in ('app_text', 'story_card', 'companion_field', 'story_field'));

-- ADM-12: as in 20261123000000, plus whether a field row's version is published now.
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
