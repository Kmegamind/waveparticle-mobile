-- Editing and publishing story cards in the admin (#304, decisions ADMIN, SHARED-STORY, LEN-CARD,
-- DATES-ADMIN-ONLY, LEAK-BY-PART; docs/decisions/0023). Run after 20261122000000_companion_mode.sql.
--
-- 1. An admin or writer saves a card's new text as a DRAFT version (published false, no
--    published_at). The published version is untouched, so phones keep reading it, and the pinned
--    read of #300 (get_story_cards, unchanged here) never returns a draft.
-- 2. An admin or writer saves a part title directly: no phone shows part titles, so they have no
--    versions.
-- 3. Only the admin role publishes a card or rolls it back. Both go through
--    private.set_published_story_card, which writes a publish_history row (kind 'story_card') in
--    the same transaction, as app text does (#289).
-- 4. The card checks (length, dates, spoilers by part, banned words) run in the app on every save
--    and again on the server before Publish; the database checks the role.
-- No key with full database rights is needed: every function runs for auth.uid().

alter table public.story_cards
  add column created_by uuid default auth.uid() references auth.users (id) on delete set null,
  add column published_by uuid references auth.users (id) on delete set null;

-- Saves a card's text as a new draft version of its key and returns the version number. The new
-- version copies the story, kind, part, slice and position of the key's newest version.
create function public.save_story_card_draft(card_key text, card_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  newest public.story_cards%rowtype;
  next_version integer;
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may save a story card' using errcode = '42501';
  end if;
  -- Serialises saves of one key, so two saves never pick the same number.
  perform pg_advisory_xact_lock(hashtext('story_card:' || card_key));
  select * into newest
  from public.story_cards
  where key = card_key
  order by version desc
  limit 1;
  if not found then
    raise exception 'no story card %', card_key using errcode = 'P0002';
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.story_cards
  where key = card_key;
  insert into public.story_cards (
    key, version, story_id, kind, part, slice, position, body, created_by
  )
  values (
    card_key, next_version, newest.story_id, newest.kind, newest.part, newest.slice,
    newest.position, card_body, auth.uid()
  );
  return next_version;
end;
$$;

revoke all on function public.save_story_card_draft(text, text) from public, anon, authenticated;
grant execute on function public.save_story_card_draft(text, text) to authenticated;

-- Renames an existing part of a story. Saved directly: part titles have no versions.
create function public.save_story_part_title(story text, part_number integer, part_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may rename a part' using errcode = '42501';
  end if;
  update public.story_parts
  set title = part_title
  where story_id = story and part = part_number;
  if not found then
    raise exception 'no part % of story %', part_number, story using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_story_part_title(text, integer, text) from public, anon, authenticated;
grant execute on function public.save_story_part_title(text, integer, text) to authenticated;

-- The one place a card version becomes the published one, for Publish and Roll back alike, with
-- its history row. The same rules as private.set_published_app_text (20261118000000).
create function private.set_published_story_card(
  card_key text,
  card_version integer,
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
  perform 1 from public.story_cards where key = card_key for update;

  select published, published_at into target_published, target_published_at
  from public.story_cards
  where key = card_key and version = card_version;
  if not found then
    raise exception 'no story card % version %', card_key, card_version using errcode = 'P0002';
  end if;
  if target_published then
    raise exception 'story card % version % is already published', card_key, card_version;
  end if;

  select version into current_version
  from public.story_cards
  where key = card_key and published;

  if publish_action = 'roll_back'
    and (current_version is null or target_published_at is null)
  then
    raise exception 'roll back needs a version of % that was published before', card_key;
  end if;

  update public.story_cards set published = false
  where key = card_key and published;
  update public.story_cards
  set published = true, published_at = now(), published_by = auth.uid()
  where key = card_key and version = card_version;

  insert into public.publish_history (kind, item_key, version, action, acted_by)
  values ('story_card', card_key, card_version, publish_action, auth.uid());
end;
$$;

revoke all on function private.set_published_story_card(text, integer, text) from public, anon, authenticated;

-- Publish: makes a version (normally the newest draft) the one phones read. Admin role only.
create function public.publish_story_card(card_key text, card_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may publish a story card' using errcode = '42501';
  end if;
  perform private.set_published_story_card(card_key, card_version, 'publish');
end;
$$;

revoke all on function public.publish_story_card(text, integer) from public, anon, authenticated;
grant execute on function public.publish_story_card(text, integer) to authenticated;

-- Roll back: publishes a version that was published before again. Admin role only.
create function public.roll_back_story_card(card_key text, card_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.content_role() is distinct from 'admin' then
    raise exception 'only an admin may roll back a story card' using errcode = '42501';
  end if;
  perform private.set_published_story_card(card_key, card_version, 'roll_back');
end;
$$;

revoke all on function public.roll_back_story_card(text, integer) from public, anon, authenticated;
grant execute on function public.roll_back_story_card(text, integer) to authenticated;

-- The history takes story card rows.
alter table public.publish_history
  drop constraint publish_history_kind_check,
  add constraint publish_history_kind_check check (kind in ('app_text', 'story_card'));

-- ADM-12: as in 20261118000000, plus whether a story card row's version is published now.
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
      else false
    end
  from public.publish_history h
  left join auth.users u on u.id = h.acted_by
  order by h.acted_at desc, h.id desc
  limit least(greatest(coalesce(row_limit, 100), 1), 500);
end;
$$;
