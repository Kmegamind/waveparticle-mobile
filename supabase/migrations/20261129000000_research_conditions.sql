-- The internal research flag of US-MAP-11 (#114, decision M4, docs/decisions/0031). An account with
-- a row here is in a study condition: 'no_story' turns the Companion and the Story off on the focus
-- page (a plain timer). There is no switch for it in the app.
--
-- Nobody reads or changes this table through the API: row level security is on and there is no
-- policy. The app asks through research_condition(), which answers only for the signed-in account
-- (auth.uid()). The team assigns and removes a condition with one SQL command in the SQL editor
-- (docs/deploy.md, Research flag). Deleting the account removes the row.
--
-- A session keeps its Companion and story. sessions.story_off_at is when the Story was turned off
-- for it (null: the Story was on for the whole session). A Step done before that time was done with
-- the Story on, a Step done at or after it with the Story off. Such a session never counts as story
-- progress (no Life Path row, no summary, no Story record).

create table public.research_conditions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  condition text not null check (condition in ('no_story')),
  assigned_at timestamptz not null default now()
);

alter table public.research_conditions enable row level security;
revoke all on public.research_conditions from anon, authenticated;

-- The signed-in account's condition ('no_story'), or null without one or without a session.
create function public.research_condition()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.condition
  from public.research_conditions r
  where r.user_id = auth.uid();
$$;

revoke all on function public.research_condition() from public, anon;
grant execute on function public.research_condition() to authenticated;

alter table public.sessions
  add column story_off_at timestamptz;

-- story_off_at only ever goes from null to a time (#114, review N2): once the Story is off for a
-- session it stays off, so the session can never become story progress afterwards. The owner's
-- update policy on sessions would otherwise let the browser clear or move it.
create function private.keep_story_off_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.story_off_at is not null and new.story_off_at is distinct from old.story_off_at then
    raise exception 'story_off_at cannot be changed once it is set'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sessions_keep_story_off_at
  before update of story_off_at on public.sessions
  for each row
  execute function private.keep_story_off_at();
