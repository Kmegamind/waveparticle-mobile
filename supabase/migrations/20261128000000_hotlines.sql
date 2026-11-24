-- Help lines by region (#118, US-SAF-5; DECISIONS SAFETY-REGION, SAFETY-REGION-STORE, HOTLINES;
-- docs/decisions/0029). Run after 20261125000000_prompt_editing.sql: this file widens the same
-- publish history kind check again and replaces the same list_publish_history, keeping every kind
-- those files added.
--
-- 1. profiles.help_country: the country the user chose under Me (ISO 3166-1 alpha-2), or null.
--    No default: the app never reads a location. Written through the user's own row as the other
--    profile settings; it is in the data export (select *) and goes with the account.
-- 2. public.hotlines: one entry per country, in versions (draft, published, restore), as ADMIN.
--    Signed-in accounts read published rows (the safety page); content editors read every row.
--    Only the admin role saves, publishes and rolls back (writers read only), through the
--    functions below; every publish and roll back writes a publish_history row (kind 'hotline').
-- 3. The starting list: only the United States, "call or text 988" (src/content/hotlines.json),
--    as version 1, published. Running this file twice is refused by the create statements.

alter table public.profiles
  add column help_country text check (help_country ~ '^[A-Z]{2}$');

create table public.hotlines (
  country text not null check (country ~ '^[A-Z]{2}$'),
  version integer not null check (version >= 1),
  -- Optional (interim ruling, review of #403 I-2): an entry with no name shows its contact line.
  service_name text check (service_name is null or char_length(service_name) between 1 and 120),
  primary_kind text not null check (primary_kind in ('phone', 'text', 'web')),
  primary_value text not null,
  secondary_kind text check (secondary_kind in ('phone', 'text', 'web')),
  secondary_value text,
  note text check (note is null or char_length(note) between 1 and 200),
  checked_on date not null,
  checked_by text not null check (char_length(checked_by) between 1 and 120),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- The last time this version became the published one (kept, so a roll back can tell it from
  -- a draft never published).
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  primary key (country, version),
  check ((secondary_kind is null) = (secondary_value is null)),
  -- A phone or text number is digits (an optional +, spaces); a web address is https.
  check (
    case primary_kind
      when 'web' then primary_value ~ '^https://[^\s"<>]+$'
      else primary_value ~ '^\+?[0-9][0-9 ]{1,19}$'
    end
  ),
  check (
    secondary_kind is null
    or case secondary_kind
      when 'web' then secondary_value ~ '^https://[^\s"<>]+$'
      else secondary_value ~ '^\+?[0-9][0-9 ]{1,19}$'
    end
  )
);

-- One published version per country at most.
create unique index hotlines_one_published_per_country
  on public.hotlines (country) where published;

alter table public.hotlines enable row level security;
revoke all on public.hotlines from anon, authenticated;
-- Every column but who saved or published a version: account ids are not shown to users.
grant select (
  country, version, service_name, primary_kind, primary_value, secondary_kind, secondary_value,
  note, checked_on, checked_by, published, created_at, published_at
) on public.hotlines to authenticated;

create policy hotlines_read on public.hotlines
  for select
  to authenticated
  using (published or (select public.is_content_editor()));

-- ADM-15 Save draft: a new version of the country's entry (max + 1), not published. Admin only.
create function public.save_hotline_draft(
  entry_country text,
  entry_service_name text,
  entry_primary_kind text,
  entry_primary_value text,
  entry_secondary_kind text,
  entry_secondary_value text,
  entry_note text,
  entry_checked_on date,
  entry_checked_by text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may change a hotline' using errcode = '42501';
  end if;
  -- Locks the country's rows, so two saves never take the same version.
  perform 1 from public.hotlines where country = entry_country for update;
  select coalesce(max(version), 0) + 1 into next_version
  from public.hotlines where country = entry_country;
  insert into public.hotlines (
    country, version, service_name, primary_kind, primary_value, secondary_kind,
    secondary_value, note, checked_on, checked_by
  ) values (
    entry_country, next_version, nullif(btrim(entry_service_name), ''), entry_primary_kind,
    entry_primary_value, entry_secondary_kind, entry_secondary_value, nullif(btrim(entry_note), ''),
    entry_checked_on, entry_checked_by
  );
  return next_version;
end;
$$;

revoke all on function public.save_hotline_draft(text, text, text, text, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.save_hotline_draft(text, text, text, text, text, text, text, date, text)
  to authenticated;

-- The one place a hotline version becomes the published one, with its history row. The same rules
-- as private.set_published_story_card (20261123000000).
create function private.set_published_hotline(
  entry_country text,
  entry_version integer,
  publish_action text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_version integer;
  target_published boolean;
  target_published_at timestamptz;
begin
  if publish_action not in ('publish', 'roll_back') then
    raise exception 'unknown publish action %', publish_action;
  end if;

  perform 1 from public.hotlines where country = entry_country for update;

  select published, published_at into target_published, target_published_at
  from public.hotlines
  where country = entry_country and version = entry_version;
  if not found then
    raise exception 'no hotline % version %', entry_country, entry_version using errcode = 'P0002';
  end if;
  if target_published then
    raise exception 'hotline % version % is already published', entry_country, entry_version;
  end if;

  select version into current_version
  from public.hotlines
  where country = entry_country and published;

  if publish_action = 'roll_back'
    and (current_version is null or target_published_at is null)
  then
    raise exception 'roll back needs a version of % that was published before', entry_country;
  end if;

  update public.hotlines set published = false
  where country = entry_country and published;
  update public.hotlines
  set published = true, published_at = now(), published_by = auth.uid()
  where country = entry_country and version = entry_version;

  insert into public.publish_history (kind, item_key, version, action, acted_by)
  values ('hotline', entry_country, entry_version, publish_action, auth.uid());
end;
$$;

revoke all on function private.set_published_hotline(text, integer, text) from public, anon, authenticated;

create function public.publish_hotline(entry_country text, entry_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may publish a hotline' using errcode = '42501';
  end if;
  perform private.set_published_hotline(entry_country, entry_version, 'publish');
end;
$$;

revoke all on function public.publish_hotline(text, integer) from public, anon, authenticated;
grant execute on function public.publish_hotline(text, integer) to authenticated;

create function public.roll_back_hotline(entry_country text, entry_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may roll back a hotline' using errcode = '42501';
  end if;
  perform private.set_published_hotline(entry_country, entry_version, 'roll_back');
end;
$$;

revoke all on function public.roll_back_hotline(text, integer) from public, anon, authenticated;
grant execute on function public.roll_back_hotline(text, integer) to authenticated;

-- The history takes hotline rows, and keeps every kind before it (#289, #304, #310, #308).
alter table public.publish_history
  drop constraint publish_history_kind_check,
  add constraint publish_history_kind_check check (
    kind in ('app_text', 'story_card', 'companion_field', 'story_field', 'prompt', 'hotline')
  );

-- ADM-12: as in 20261125000000_prompt_editing.sql, plus whether a hotline row's version is the
-- published one now.
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
      when 'hotline' then exists (
        select 1 from public.hotlines l
        where l.country = h.item_key and l.version = h.version and l.published
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

-- The starting list (src/content/hotlines.json): the United States only, confirmed by the product
-- owner. The import writes no history row, as the other seeds.
insert into public.hotlines (
  country, version, service_name, primary_kind, primary_value, secondary_kind, secondary_value,
  note, checked_on, checked_by, published, published_at
) values (
  'US', 1, null, 'phone', '988', 'text', '988', null, '2026-11-23', 'the product owner', true, now()
);
