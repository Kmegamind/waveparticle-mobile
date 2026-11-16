-- Story content in the database (#284). The Companions and their stories, which the app used to
-- bundle from src/content and docs/demo. The seed is those files: scripts/content/import.mjs
-- prints the SQL that loads them, and scripts/content/export.mjs writes the tables back.
--
-- Two kinds of field:
--   display  companions and stories: the text the screens show, under the names they use
--            (title, goal_short, who, opening, period). Signed-in users may read these.
--   inputs   story_inputs: the model-only inputs (facts, forbidden terms, key moments and the
--            stage 0 inputs) and the writers' fields (date, provenance). Nobody reads this table
--            through the API: row level security is on and there is no policy.
--
-- The server reads both through get_story_content, which answers only to the server's reader key
-- (CONTENT_READ_KEY, a server-only setting). Only the SHA-256 of that key is stored, in a schema
-- the API cannot reach. No key with full database rights is needed anywhere.
--
-- Dates stay with the writers (DATES-ADMIN-ONLY): get_story_content never returns them, so they
-- cannot reach a prompt. Only export_story_content, for the export script, returns every column.
-- JSON columns are json, not jsonb, so they keep the files' key order.

create table public.companions (
  id text primary key check (id ~ '^[a-z][a-z0-9-]*$'),
  position integer not null check (position >= 1),
  name text not null,
  short_name text not null,
  tags text not null default '',
  line text not null default '',
  portrait text not null,
  -- Where Enter goes; null while the Companion has no stories.
  enter_href text,
  updated_at timestamptz not null default now(),
  -- Checked at the end of a transaction, so the import can reorder Companions.
  unique (position) deferrable initially immediate
);

create table public.stories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  companion_id text not null references public.companions (id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  title text not null,
  -- The Life Path period this story belongs to (PERIODS: names, never dates).
  period text not null,
  -- The goal sentence ("My goal" and the Life Path row line).
  goal_short text not null,
  -- The "Who I am" line.
  who text not null,
  -- The goal dialogue's first line: where he is, then the one question.
  opening text not null,
  updated_at timestamptz not null default now(),
  -- Checked at the end of a transaction, so the import can reorder stories.
  unique (companion_id, sequence) deferrable initially immediate
);

create table public.story_inputs (
  story_id text primary key references public.stories (id) on delete cascade,
  -- For writers only (ordering and fact checks); never returned to the app.
  date text not null default '',
  goal text not null default '',
  facts json not null,
  forbidden_terms json not null,
  -- Key moments: the must-use lines (KEY-UNCONFIRMED: stored unconfirmed until reviewed).
  key_moments json not null,
  provenance json not null default '{}'::json,
  -- The rest of the stage 0 inputs (place, later words, people, slices, steps, ...). The places
  -- of the display texts and the date are null here; each is kept once, above.
  stage_zero json not null,
  updated_at timestamptz not null default now()
);

alter table public.companions enable row level security;
alter table public.stories enable row level security;
alter table public.story_inputs enable row level security;

revoke all on public.companions from anon, authenticated;
revoke all on public.stories from anon, authenticated;
revoke all on public.story_inputs from anon, authenticated;

-- Display fields: readable by signed-in users, written only in the SQL editor or by the import.
create policy companions_read_signed_in
  on public.companions for select to authenticated using (true);
create policy stories_read_signed_in
  on public.stories for select to authenticated using (true);
grant select on public.companions to authenticated;
grant select on public.stories to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The SHA-256 (hex) of each reader key the server may use. Add one with
-- node scripts/content/token.mjs, which prints the key for the server and this row.
create table private.content_reader (
  token_sha256 text primary key check (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- Everything the app needs, for the server only: without a known reader key it returns null.
-- Companions in display order; stories in companion and story order, each with its inputs.
create function public.get_story_content(reader_key text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'companions', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'position', c.position, 'name', c.name, 'short_name', c.short_name,
        'tags', c.tags, 'line', c.line, 'portrait', c.portrait, 'enter_href', c.enter_href
      ) order by c.position)
      from public.companions c
    ), '[]'::json),
    'stories', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'companion_id', s.companion_id, 'sequence', s.sequence, 'title', s.title,
        'period', s.period, 'goal_short', s.goal_short, 'who', s.who, 'opening', s.opening,
        'inputs', case when i.story_id is null then null else json_build_object(
          'goal', i.goal, 'facts', i.facts, 'forbidden_terms', i.forbidden_terms,
          'key_moments', i.key_moments, 'stage_zero', i.stage_zero
        ) end
      ) order by c.position, s.sequence)
      from public.stories s
      join public.companions c on c.id = s.companion_id
      left join public.story_inputs i on i.story_id = s.id
    ), '[]'::json)
  )
  where exists (
    select 1
    from private.content_reader r
    where r.token_sha256 = encode(sha256(convert_to(reader_key, 'UTF8')), 'hex')
  );
$$;

revoke all on function public.get_story_content(text) from public;
grant execute on function public.get_story_content(text) to anon, authenticated;

-- Every row of the three tables, for scripts/content/export.mjs only (same reader key).
create function public.export_story_content(reader_key text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'companions', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'position', c.position, 'name', c.name, 'short_name', c.short_name,
        'tags', c.tags, 'line', c.line, 'portrait', c.portrait, 'enter_href', c.enter_href
      ) order by c.position)
      from public.companions c
    ), '[]'::json),
    'stories', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'companion_id', s.companion_id, 'sequence', s.sequence, 'title', s.title,
        'period', s.period, 'goal_short', s.goal_short, 'who', s.who, 'opening', s.opening
      ) order by c.position, s.sequence)
      from public.stories s
      join public.companions c on c.id = s.companion_id
    ), '[]'::json),
    'story_inputs', coalesce((
      select json_agg(json_build_object(
        'story_id', i.story_id, 'date', i.date, 'goal', i.goal, 'facts', i.facts,
        'forbidden_terms', i.forbidden_terms, 'key_moments', i.key_moments,
        'provenance', i.provenance, 'stage_zero', i.stage_zero
      ) order by i.story_id)
      from public.story_inputs i
    ), '[]'::json)
  )
  where exists (
    select 1
    from private.content_reader r
    where r.token_sha256 = encode(sha256(convert_to(reader_key, 'UTF8')), 'hex')
  );
$$;

revoke all on function public.export_story_content(text) from public;
grant execute on function public.export_story_content(text) to anon, authenticated;
