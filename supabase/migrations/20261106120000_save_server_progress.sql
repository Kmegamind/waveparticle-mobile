-- Story progress for a Companion is the set of completed sessions grouped by
-- companion_id and story_id. state = 'restarted' is not completion.
-- A Plan is the Goal's steps. This migration adds no plan table and no
-- progress table. Pause messages and return pop-ups are session_lines rows.

alter table public.sessions
  add column companion_id text,
  add column story_id text,
  add column background_card text,
  add column background_card_source text,
  add column merged_key_moments jsonb,
  add column closing_line text;

update public.sessions
set companion_id = 'unassigned'
where companion_id is null;

update public.sessions
set story_id = 'unassigned'
where story_id is null;

alter table public.sessions
  alter column companion_id set not null,
  alter column story_id set not null,
  add constraint sessions_background_card_source_known
    check (
      background_card_source is null
      or background_card_source in ('authored', 'generated')
    );

create unique index sessions_one_open_per_goal
  on public.sessions (goal_id)
  where state = 'open';

create table public.session_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  position integer not null check (position >= 0),
  opened_at timestamptz,
  done_at timestamptz,
  unique (session_id, position)
);

create table public.session_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_step_id uuid references public.session_steps (id) on delete cascade,
  seq integer not null check (seq >= 0),
  kind text not null check (
    kind in ('background', 'story_card', 'pause_message', 'return_popup', 'closing')
  ),
  card_id text,
  source text not null check (source in ('authored', 'generated')),
  text text not null,
  pause_number integer,
  shown_at timestamptz not null default now(),
  check (
    (kind = 'pause_message' and pause_number is not null)
    or (kind <> 'pause_message' and pause_number is null)
  )
);

alter table public.session_steps enable row level security;
alter table public.session_lines enable row level security;

create policy "session steps are readable by the session owner"
  on public.session_steps for select
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = session_steps.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "session steps are writable by the session owner"
  on public.session_steps for insert
  with check (
    exists (
      select 1
      from public.sessions
      join public.steps on steps.id = session_steps.step_id
      where sessions.id = session_steps.session_id
        and sessions.user_id = auth.uid()
        and steps.goal_id = sessions.goal_id
    )
  );

create policy "session steps are editable by the session owner"
  on public.session_steps for update
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = session_steps.session_id
        and sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions
      join public.steps on steps.id = session_steps.step_id
      where sessions.id = session_steps.session_id
        and sessions.user_id = auth.uid()
        and steps.goal_id = sessions.goal_id
    )
  );

create policy "session steps are removable by the session owner"
  on public.session_steps for delete
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = session_steps.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "session lines are readable by the session owner"
  on public.session_lines for select
  using (
    exists (
      select 1
      from public.sessions
      where sessions.id = session_lines.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "session lines are writable by the session owner"
  on public.session_lines for insert
  with check (
    exists (
      select 1
      from public.sessions
      where sessions.id = session_lines.session_id
        and sessions.user_id = auth.uid()
    )
    and (
      session_lines.session_step_id is null
      or exists (
        select 1
        from public.session_steps
        where session_steps.id = session_lines.session_step_id
          and session_steps.session_id = session_lines.session_id
      )
    )
  );
