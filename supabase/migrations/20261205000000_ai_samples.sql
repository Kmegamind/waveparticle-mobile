-- The prompt lab's sample library and the source excerpts (#479; docs/PRD.md section 4.15,
-- decisions AI-LAB-SAMPLES, AI-SOURCE-EXCERPTS, AI-SAMPLES-LOCAL; docs/decisions/0036). Run after
-- 20261203000000_ai_runs.sql.
--
-- 1. public.ai_source_excerpts: only the passage a story actually uses, never a whole book, with
--    its source named on the row (source_label, required). The text is capped at 50,000
--    characters so a whole book cannot be stored by mistake.
-- 2. public.ai_samples: one sample, the set of inputs that fills a prompt's {{variables}}: the
--    Companion's persona, its source excerpt (a reference to the row above), the background, the
--    facts, the world record, the standing task, and the finished plan when a later step needs
--    it. position is the library's order.
-- 3. public.ai_runs.sample_id (20261203000000_ai_runs.sql) now references public.ai_samples. No
--    "on delete cascade": a sample that a run used cannot be deleted, so the run log keeps it.
--
-- Who reads and writes: only content editors (admin or writer, public.is_content_editor()) read
-- either table. Accounts without a role (the app's users) and anon read nothing. No API role
-- inserts, updates or deletes: the rows come from the owner's import
-- (scripts/ai-samples/import-samples.mjs prints the SQL; AI-SAMPLES-LOCAL), run in the SQL editor.
-- No book text is in this file or anywhere in the repository.
--
-- Undo (the import's rows go with the tables; runs keep their sample_id text):
--   drop index public.ai_runs_sample;
--   alter table public.ai_runs drop constraint ai_runs_sample_fk;
--   drop table public.ai_samples;
--   drop table public.ai_source_excerpts;
-- Running this file a second time stops with an error (the table exists) and changes nothing.

create table public.ai_source_excerpts (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 200),
  -- The source named: book or biography, with the chapter or pages the passage comes from.
  source_label text not null check (char_length(btrim(source_label)) between 1 and 300),
  -- The passage itself, only the part the story uses.
  body text not null check (char_length(btrim(body)) >= 1 and char_length(body) <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_source_excerpts enable row level security;
revoke all on public.ai_source_excerpts from public, anon, authenticated;
grant select on public.ai_source_excerpts to authenticated;

create policy ai_source_excerpts_read on public.ai_source_excerpts
  for select to authenticated
  using ((select public.is_content_editor()));

create table public.ai_samples (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 200),
  -- The library's order (1 first; samples with the same position are listed by id).
  position integer not null check (position >= 1),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  -- The Companion's name as the sample gives it; null when the sample has none.
  companion text check (char_length(btrim(companion)) between 1 and 200),
  mode text check (mode in ('historical', 'fictional')),
  persona text not null default '' check (char_length(persona) <= 20000),
  source_excerpt_id text references public.ai_source_excerpts (id),
  background text not null default '' check (char_length(background) <= 20000),
  -- A list of short fact sentences.
  facts jsonb not null default '[]'::jsonb check (jsonb_typeof(facts) = 'array'),
  world_record text not null default '' check (char_length(world_record) <= 20000),
  standing_task text not null default '' check (char_length(standing_task) <= 20000),
  -- The finished plan ({ goal, aims: [{ title, note }] }); null when the sample has none.
  plan jsonb check (plan is null or jsonb_typeof(plan) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_samples enable row level security;
revoke all on public.ai_samples from public, anon, authenticated;
grant select on public.ai_samples to authenticated;

create policy ai_samples_read on public.ai_samples
  for select to authenticated
  using ((select public.is_content_editor()));

alter table public.ai_runs
  add constraint ai_runs_sample_fk foreign key (sample_id) references public.ai_samples (id);

create index ai_runs_sample on public.ai_runs (sample_id) where sample_id is not null;
