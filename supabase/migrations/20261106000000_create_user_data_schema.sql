create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  keep_clock_running boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  text text not null,
  shape text check (shape in ('specific', 'vague', 'big', 'unknown')),
  split_finer boolean,
  total_minutes integer check (total_minutes is null or total_minutes > 0),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'on_hold', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null,
  description text,
  minutes integer not null check (minutes > 0),
  unique (goal_id, position)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  step_count integer not null check (step_count > 0),
  state text not null default 'open'
    check (state in ('open', 'on_hold', 'completed', 'restarted')),
  seed text not null,
  started_at timestamptz,
  last_active_at timestamptz,
  completed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.steps enable row level security;
alter table public.sessions enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles are writable by their owner"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles are editable by their owner"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "profiles are removable by their owner"
  on public.profiles for delete
  using (auth.uid() = user_id);

create policy "goals are readable by their owner"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "goals are writable by their owner"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "goals are editable by their owner"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "goals are removable by their owner"
  on public.goals for delete
  using (auth.uid() = user_id);

create policy "steps are readable by the goal owner"
  on public.steps for select
  using (
    exists (
      select 1
      from public.goals
      where goals.id = steps.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "steps are writable by the goal owner"
  on public.steps for insert
  with check (
    exists (
      select 1
      from public.goals
      where goals.id = steps.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "steps are editable by the goal owner"
  on public.steps for update
  using (
    exists (
      select 1
      from public.goals
      where goals.id = steps.goal_id
        and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.goals
      where goals.id = steps.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "steps are removable by the goal owner"
  on public.steps for delete
  using (
    exists (
      select 1
      from public.goals
      where goals.id = steps.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "sessions are readable by their owner"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "sessions are writable by their owner"
  on public.sessions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.goals
      where goals.id = sessions.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "sessions are editable by their owner"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.goals
      where goals.id = sessions.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "sessions are removable by their owner"
  on public.sessions for delete
  using (auth.uid() = user_id);
