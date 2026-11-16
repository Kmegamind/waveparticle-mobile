-- App text in the database (#288, decisions APP-TEXT and NAMING, docs/decisions/0017). The app's
-- own words (system voice) live here under keys ui.<screen>.<slot>, where <screen> is the
-- docs/FLOW.md screen id. Every save makes a new draft version; at most one version per key is
-- published; roll back publishes an earlier published version again. The app shows the published
-- text, or the default written in the code when there is none (src/content/app-text.json).
--
-- Anyone may read published rows (app text is not secret). Only content editors (admin or writer,
-- public.is_content_editor() from 20261116000000_content_roles.sql) read drafts. Nobody writes
-- through the table: every write goes through the functions below, which check the role. No key
-- with full database rights is needed anywhere.

create table public.app_text (
  key text not null check (key ~ '^ui\.[A-Z][A-Z0-9-]*\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  version integer not null check (version >= 1),
  -- Never blank: at least one character that is not a space, tab or new line.
  body text not null check (body ~ '\S') check (char_length(body) <= 1000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- The last time this version became the published one. It stays set when a newer version
  -- replaces it, so a roll back can tell an earlier published version from a draft never published.
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  -- The FLOW.md screen id, for the admin list.
  screen text generated always as (split_part(key, '.', 2)) stored,
  primary key (key, version)
);

-- One published version per key at most.
create unique index app_text_one_published_per_key
  on public.app_text (key) where published;

alter table public.app_text enable row level security;
revoke all on public.app_text from anon, authenticated;
-- Every column but who saved or published a version: account ids are not public.
grant select (key, version, body, published, published_at, created_at, screen)
  on public.app_text to anon, authenticated;

create policy app_text_read on public.app_text
  for select
  to anon, authenticated
  using (published or (select public.is_content_editor()));

-- Saves a text as a new draft version of its key and returns the version number.
create function public.save_app_text_draft(text_key text, text_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may save app text' using errcode = '42501';
  end if;
  -- Serialises saves of one key, so two saves never pick the same number.
  perform pg_advisory_xact_lock(hashtext('app_text:' || text_key));
  select coalesce(max(version), 0) + 1 into next_version
  from public.app_text
  where key = text_key;
  insert into public.app_text (key, version, body, created_by)
  values (text_key, next_version, text_body, auth.uid());
  return next_version;
end;
$$;

revoke all on function public.save_app_text_draft(text, text) from public, anon, authenticated;
grant execute on function public.save_app_text_draft(text, text) to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The one place a version becomes the published one, for Publish and Roll back alike. #289 (the
-- publish history) adds its history insert here, in the same transaction: it knows the key, the
-- version, the action ('publish' or 'roll_back'), auth.uid() and now().
create function private.set_published_app_text(
  text_key text,
  text_version integer,
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

  -- Locks the key's rows, so two publishes of one key run one after the other.
  perform 1 from public.app_text where key = text_key for update;

  select published, published_at into target_published, target_published_at
  from public.app_text
  where key = text_key and version = text_version;
  if not found then
    raise exception 'no app text % version %', text_key, text_version using errcode = 'P0002';
  end if;
  if target_published then
    raise exception 'app text % version % is already published', text_key, text_version;
  end if;

  select version into current_version
  from public.app_text
  where key = text_key and published;

  if publish_action = 'roll_back'
    and (current_version is null or text_version >= current_version or target_published_at is null)
  then
    raise exception 'roll back needs an earlier published version of %', text_key;
  end if;

  update public.app_text set published = false
  where key = text_key and published;
  update public.app_text
  set published = true, published_at = now(), published_by = auth.uid()
  where key = text_key and version = text_version;
end;
$$;

revoke all on function private.set_published_app_text(text, integer, text) from public, anon, authenticated;

-- Publish: makes a version (normally the newest draft) the one the app shows.
create function public.publish_app_text(text_key text, text_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may publish app text' using errcode = '42501';
  end if;
  perform private.set_published_app_text(text_key, text_version, 'publish');
end;
$$;

revoke all on function public.publish_app_text(text, integer) from public, anon, authenticated;
grant execute on function public.publish_app_text(text, integer) to authenticated;

-- Roll back: publishes an earlier published version again.
create function public.roll_back_app_text(text_key text, text_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may roll back app text' using errcode = '42501';
  end if;
  perform private.set_published_app_text(text_key, text_version, 'roll_back');
end;
$$;

revoke all on function public.roll_back_app_text(text, integer) from public, anon, authenticated;
grant execute on function public.roll_back_app_text(text, integer) to authenticated;

-- The seed (scripts/app-text/import.mjs, run by the owner in the SQL editor): loads a key's code
-- default as version 1, published, only when the key has no rows yet. Running it again, or after a
-- writer published an edit, changes nothing.
create function public.import_app_text(text_key text, text_body text)
returns integer
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.app_text where key = text_key) then
    return 0;
  end if;
  insert into public.app_text (key, version, body, published, published_at)
  values (text_key, 1, text_body, true, now());
  return 1;
end;
$$;

revoke all on function public.import_app_text(text, text) from public, anon, authenticated;
