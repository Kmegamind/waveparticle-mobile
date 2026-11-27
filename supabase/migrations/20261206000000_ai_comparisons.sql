-- The comparison lab's saved answers (#478; docs/PRD.md section 4.15, FR-AILAB-4 and FR-AILAB-5;
-- decisions AI-LAB-SAMPLES, AI-REGISTRY-FIELDS; docs/decisions/0038).
-- Run after 20261205000000_ai_samples.sql.
--
-- 1. public.ai_comparisons: one row per saved comparison. The lab runs the same sample through
--    two sides (two prompt versions, or two models); each side is an ordinary run of
--    public.ai_runs (20261203000000_ai_runs.sql), written by the Run route. This row ties the two
--    runs together with the person's yes or no answer to each of the feature's pass questions for
--    each side, whether the sides were hidden (blind) while answering, and the pass questions as
--    they read when the answers were given (the feature's list can change later). A run belongs
--    to at most one comparison.
-- 2. public.save_ai_comparison(comparison jsonb): the only writer. A signed-in content editor
--    (admin or writer, AI-RUN-PERMISSION) saves the answers for two runs that are their own, both
--    ended ok, of the same feature and the same sample (or both without one). Who and when are set
--    here; the questions are copied from public.ai_features.pass_questions, never taken from the
--    caller; there must be one answer (true for yes, false for no) per question for each side.
--    No server token is needed: the answers are the person's own judgement of their own runs, and
--    a run row itself can still only be written by the server.
-- 3. Content editors read every row; accounts without a role and anon read nothing. No API role
--    inserts, updates or deletes the table.
--
-- run_a and run_b have no "on delete cascade": the run log's undo (20261203000000) fails while a
-- comparison names a run, so this file's undo must run first.
-- Undo (export public.ai_comparisons first if it holds real answers):
--   drop function public.save_ai_comparison(jsonb);
--   drop table public.ai_comparisons;
-- Running this file a second time stops with an error (the table exists) and changes nothing.

create table public.ai_comparisons (
  id uuid primary key default gen_random_uuid(),
  -- Who saved the answers (null once the account is deleted; the row stays).
  saved_by uuid references auth.users (id) on delete set null,
  saved_at timestamptz not null default now(),
  feature_slug text not null references public.ai_features (slug),
  -- The sample both runs used; null when both ran the prompt as written.
  sample_id text check (char_length(sample_id) between 1 and 200),
  run_a uuid not null unique references public.ai_runs (id),
  run_b uuid not null unique references public.ai_runs (id),
  -- True when the names of the sides stayed hidden until every question was answered.
  blind boolean not null,
  -- The pass questions' texts when the answers were given, in order.
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  -- One boolean per question (true: yes, false: no), in the order of questions.
  answers_a jsonb not null check (jsonb_typeof(answers_a) = 'array'),
  answers_b jsonb not null check (jsonb_typeof(answers_b) = 'array'),
  constraint ai_comparisons_two_runs check (run_a <> run_b),
  constraint ai_comparisons_one_answer_each check (
    jsonb_array_length(questions) between 1 and 50
    and jsonb_array_length(answers_a) = jsonb_array_length(questions)
    and jsonb_array_length(answers_b) = jsonb_array_length(questions)
  )
);

create index ai_comparisons_feature on public.ai_comparisons (feature_slug, saved_at desc);

alter table public.ai_comparisons enable row level security;
revoke all on public.ai_comparisons from public, anon, authenticated;
grant select on public.ai_comparisons to authenticated;

create policy ai_comparisons_read on public.ai_comparisons
  for select to authenticated
  using ((select public.is_content_editor()));

-- Saves the answers of one comparison and returns its id. Errors: 42501 (not a signed-in content
-- editor), 22023 (not an object; a run of another account, not ended ok, of another feature or
-- sample, the same run twice; a feature without pass questions; an answer that is not true or
-- false, or the wrong number of answers), P0002 (a run that does not exist), 23505 (a run that
-- already belongs to a comparison).
create function public.save_ai_comparison(comparison jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.ai_runs;
  b public.ai_runs;
  question_list jsonb;
  question_count integer;
  new_id uuid;
begin
  if auth.uid() is null or not public.is_content_editor() then
    raise exception 'only a content editor may save a comparison' using errcode = '42501';
  end if;
  if jsonb_typeof(comparison) is distinct from 'object'
    or jsonb_typeof(comparison -> 'run_a') is distinct from 'string'
    or jsonb_typeof(comparison -> 'run_b') is distinct from 'string'
    or jsonb_typeof(comparison -> 'blind') is distinct from 'boolean'
    or jsonb_typeof(comparison -> 'answers_a') is distinct from 'array'
    or jsonb_typeof(comparison -> 'answers_b') is distinct from 'array'
  then
    raise exception 'the comparison must be an object with two runs, blind and two answer lists'
      using errcode = '22023';
  end if;

  select * into a from public.ai_runs r where r.id = (comparison ->> 'run_a')::uuid;
  if not found then
    raise exception 'run a does not exist' using errcode = 'P0002';
  end if;
  select * into b from public.ai_runs r where r.id = (comparison ->> 'run_b')::uuid;
  if not found then
    raise exception 'run b does not exist' using errcode = 'P0002';
  end if;
  if a.id = b.id
    or a.run_by is distinct from auth.uid()
    or b.run_by is distinct from auth.uid()
    or a.status is distinct from 'ok'
    or b.status is distinct from 'ok'
    or a.feature_slug <> b.feature_slug
    or not (a.sample_id is not distinct from b.sample_id)
  then
    raise exception 'the two runs must be your own, ended ok, of one feature and one sample'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.ai_comparisons c
    where c.run_a in (a.id, b.id) or c.run_b in (a.id, b.id)
  ) then
    raise exception 'a run already belongs to a comparison' using errcode = '23505';
  end if;

  select coalesce(jsonb_agg(item ->> 'text' order by ord), '[]'::jsonb)
  into question_list
  from public.ai_features f,
    jsonb_array_elements(f.pass_questions) with ordinality as q(item, ord)
  where f.slug = a.feature_slug;
  question_count := jsonb_array_length(question_list);
  if question_count = 0 then
    raise exception 'this feature has no pass questions' using errcode = '22023';
  end if;
  if jsonb_array_length(comparison -> 'answers_a') <> question_count
    or jsonb_array_length(comparison -> 'answers_b') <> question_count
    or exists (
      select 1 from jsonb_array_elements(comparison -> 'answers_a') as x(v)
      where jsonb_typeof(x.v) <> 'boolean'
    )
    or exists (
      select 1 from jsonb_array_elements(comparison -> 'answers_b') as y(v)
      where jsonb_typeof(y.v) <> 'boolean'
    )
  then
    raise exception 'one yes or no answer per pass question for each side' using errcode = '22023';
  end if;

  insert into public.ai_comparisons (
    saved_by, feature_slug, sample_id, run_a, run_b, blind, questions, answers_a, answers_b
  )
  values (
    auth.uid(),
    a.feature_slug,
    a.sample_id,
    a.id,
    b.id,
    (comparison ->> 'blind')::boolean,
    question_list,
    comparison -> 'answers_a',
    comparison -> 'answers_b'
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.save_ai_comparison(jsonb) from public, anon, authenticated;
grant execute on function public.save_ai_comparison(jsonb) to authenticated;
