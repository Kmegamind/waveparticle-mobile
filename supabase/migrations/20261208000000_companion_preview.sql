-- A Companion who is not public yet, playable by admins and writers only (#521). Run after
-- 20261207000000_story_switch.sql. It can be run again on a database that already has it: it
-- replaces the function, the trigger and the policies with the same ones.
--
-- A Companion is public when companions.enter_href holds a non-blank address. One who has stories
-- but no such address is a preview: the app lets only an account with a content role
-- (public.is_content_editor(), 20261116000000_content_roles.sql) enter him, start a session with
-- him, read his cards or make a model call for his stories. That rule lives in the server
-- (src/lib/content/companion-access.ts); this migration adds the same rule to what an account can
-- do with its own key through the API:
--
-- 1. sessions: an account writes its own sessions through the API (the owner policies of
--    20261106000000), and the app writes them only by upsert (INSERT ... ON CONFLICT DO UPDATE,
--    src/lib/progress/supabase-progress.ts). A signed-in account may only write a NEW session, or
--    change an existing session's companion_id or story_id, when the story belongs to that
--    Companion and the Companion is public, unless the account is an admin or writer.
--    A write to a session this account already has, with the same companion_id and story_id as
--    stored (every progress save: state, steps, lines, closing line), is not checked, by update or
--    by upsert. So a session that is no longer playable (a writer whose role was removed, a
--    Companion made private again, the 'unassigned' rows of 20261106120000) can still be saved;
--    the server still refuses to play it. Requests without a signed-in account (the SQL editor,
--    the scripts) are not checked.
-- 2. stories: the display rows of a Companion who is not public are readable by admins and writers
--    only (they were readable by every signed-in account). The phones never read this table; the
--    server reads the content through get_story_content with its reader key.
--
-- Making a Companion public stays one change: set his enter_href.
--
-- Before applying, count the sessions this rule would stop from being moved or created again
-- (expected 0 on prod; existing rows are still saved, see 1):
--   select count(*) from public.sessions s
--   where not exists (
--     select 1 from public.stories st
--     join public.companions c on c.id = st.companion_id
--     where st.id = s.story_id and st.companion_id = s.companion_id
--       and c.enter_href ~ '[^[:space:]]'
--   );
--
-- Undo (in the SQL editor):
--   drop trigger if exists sessions_companion_playable on public.sessions;
--   drop function if exists private.session_companion_playable();
--   drop policy if exists stories_read_public_or_editor on public.stories;
--   create policy stories_read_signed_in on public.stories for select to authenticated using (true);

create or replace function private.session_companion_playable()
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
  -- An update that keeps the Companion and the story (a progress save).
  if tg_op = 'UPDATE'
    and new.companion_id is not distinct from old.companion_id
    and new.story_id is not distinct from old.story_id then
    return new;
  end if;
  -- An upsert's insert of a row this account already has, with the same Companion and story: the
  -- conflict turns it into an update of that row (a progress save). Postgres runs this BEFORE
  -- INSERT trigger for every proposed row of an upsert, before the conflict is known.
  if tg_op = 'INSERT' and exists (
    select 1
    from public.sessions s
    where s.id = new.id
      and s.user_id = auth.uid()
      and s.companion_id is not distinct from new.companion_id
      and s.story_id is not distinct from new.story_id
  ) then
    return new;
  end if;
  if not exists (
    select 1
    from public.stories s
    join public.companions c on c.id = s.companion_id
    where s.id = new.story_id
      and s.companion_id = new.companion_id
      and (
        -- A non-blank address: not only spaces, tabs or line breaks.
        c.enter_href ~ '[^[:space:]]'
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

drop trigger if exists sessions_companion_playable on public.sessions;

create trigger sessions_companion_playable
  before insert or update of companion_id, story_id on public.sessions
  for each row
  execute function private.session_companion_playable();

drop policy if exists stories_read_signed_in on public.stories;
drop policy if exists stories_read_public_or_editor on public.stories;

create policy stories_read_public_or_editor
  on public.stories for select to authenticated
  using (
    exists (
      select 1
      from public.companions c
      where c.id = stories.companion_id
        and c.enter_href ~ '[^[:space:]]'
    )
    or (select public.is_content_editor())
  );
