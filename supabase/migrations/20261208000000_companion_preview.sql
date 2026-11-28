-- A Companion who is not public yet, playable by admins and writers only (#521). Run after
-- 20261207000000_story_switch.sql.
--
-- A Companion is public when companions.enter_href is set. One who has stories but no enter_href
-- is a preview: the app lets only an account with a content role (public.is_content_editor(),
-- 20261116000000_content_roles.sql) enter him, start a session with him, read his cards or make a
-- model call for his stories. That rule lives in the server (src/lib/content/companion-access.ts);
-- this migration adds the same rule to what an account can do with its own key through the API:
--
-- 1. sessions: an account writes its own sessions through the API (the owner policies of
--    20261106000000). A signed-in account may now only write a session whose story belongs to the
--    session's Companion and whose Companion is public, unless it is an admin or writer. Checked
--    when a session is inserted and when its companion_id or story_id changes; an update that
--    leaves both as they are (every progress write) is not checked again. Requests without a
--    signed-in account (the SQL editor, the scripts) are not checked.
-- 2. stories: the display rows of a Companion who is not public are readable by admins and writers
--    only (they were readable by every signed-in account). The phones never read this table; the
--    server reads the content through get_story_content with its reader key.
--
-- Making a Companion public stays one change: set his enter_href.
--
-- Undo (in the SQL editor):
--   drop trigger if exists sessions_companion_playable on public.sessions;
--   drop function if exists private.session_companion_playable();
--   drop policy if exists stories_read_public_or_editor on public.stories;
--   create policy stories_read_signed_in on public.stories for select to authenticated using (true);

create function private.session_companion_playable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No signed-in account: the SQL editor or a script, not a request with a user's key.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.companion_id is not distinct from old.companion_id
    and new.story_id is not distinct from old.story_id then
    return new;
  end if;
  if not exists (
    select 1
    from public.stories s
    join public.companions c on c.id = s.companion_id
    where s.id = new.story_id
      and s.companion_id = new.companion_id
      and (
        (c.enter_href is not null and btrim(c.enter_href) <> '')
        or public.is_content_editor()
      )
  ) then
    raise exception 'this Companion cannot be played by this account'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function private.session_companion_playable() from public;

create trigger sessions_companion_playable
  before insert or update of companion_id, story_id on public.sessions
  for each row
  execute function private.session_companion_playable();

drop policy stories_read_signed_in on public.stories;

create policy stories_read_public_or_editor
  on public.stories for select to authenticated
  using (
    exists (
      select 1
      from public.companions c
      where c.id = stories.companion_id
        and c.enter_href is not null
        and btrim(c.enter_href) <> ''
    )
    or (select public.is_content_editor())
  );
