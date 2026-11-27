-- The prompt lab's run log (#476; docs/PRD.md section 4.15, FR-AILAB-1 to FR-AILAB-3 and
-- FR-AILAB-8; decisions AI-RUN-PERMISSION, AI-RUN-LIVE, AI-LAB-STUB; docs/decisions/0034). Run
-- after 20261202000000_ai_registry.sql.
--
-- 1. public.ai_runs: one row per Run. Who ran it and when, the registry feature (its slug, the
--    key of public.ai_features), the prompt (its key and version, published or draft, or the
--    pasted text), the sample (a nullable id: the sample library comes in #479), the model, the
--    filled prompt sent to the model (input), the answer (output), the input and output tokens,
--    the cost in US dollars, whether the model was the test stub, and the status: running (the
--    row is written BEFORE the model call), then ok, or error with a reason. A row that stays
--    running is a call that may have been billed but whose end was never recorded (the function
--    was stopped, or the finish failed); it still counts in the spend. There is no spending cap
--    (AI-RUN-PERMISSION): the row is the record, nothing refuses a run.
-- 2. public.ai_run_steps: the steps of a multi-step run (FR-AILAB-8; for example three drafts, a
--    critique and a rewrite). A one-call run has no step rows; a multi-step run has one row per
--    step and its run row carries the totals. A child table, not a jsonb list, so each step's
--    tokens and cost can be summed and compared in SQL, and each step is checked by the same
--    constraints as a run (docs/decisions/0034).
-- 3. Who writes and reads: no API role inserts, updates or deletes either table. The server's Run
--    route starts a run through public.start_ai_run and ends it through public.finish_ai_run.
--    Both need a signed-in content editor (admin or writer, AI-RUN-PERMISSION) AND the server's
--    prompt reader token (PROMPTS_READ_TOKEN, private.prompt_reader, 20261115000000_prompts.sql),
--    which only the server holds: a writer's browser cannot write or forge a run row. No new
--    secret. Only the account that started a run can finish it, and only once. Content editors
--    read every row of both tables; accounts without a role and anon read nothing.
-- 4. public.ai_run_spend(from_time, to_time): the spend between two times, by account, for the
--    Runs page (#477; FR-AILAB-3, "today's total spend and the total by user"). Content editors
--    only.
--
-- feature_slug has no "on delete cascade": a registry row with runs cannot be deleted, so the run
-- log (the only guard on spending) is kept. The registry seed's undo (registry-seed.mjs --undo)
-- and the undo of 20261130000000_ai_features.sql fail once a row has runs; this file's undo must
-- run first, and it deletes the spend history.
--
-- The model key is never stored here: the route sends it to the provider only (FR-AILAB-2).
-- Undo (export public.ai_runs and public.ai_run_steps first if they hold real runs):
--   drop function public.ai_run_spend(timestamptz, timestamptz);
--   drop function public.finish_ai_run(text, uuid, jsonb);
--   drop function public.start_ai_run(text, jsonb);
--   drop function private.ai_run_writer_ok(text);
--   drop table public.ai_run_steps;
--   drop table public.ai_runs;
-- Running this file a second time stops with an error (the table exists) and changes nothing.

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  -- Who pressed Run (null once the account is deleted; the row and its cost stay).
  run_by uuid references auth.users (id) on delete set null,
  run_at timestamptz not null default now(),
  -- When the run ended (ok or error); null while it is running.
  finished_at timestamptz,
  feature_slug text not null references public.ai_features (slug),
  prompt_key text not null check (prompt_key ~ '^[a-z][a-z0-9_]*$'),
  -- published: the active version; draft: a stored version that is not active; pasted: a text
  -- typed into the Run panel, stored in pasted_text, with no version.
  prompt_source text not null check (prompt_source in ('published', 'draft', 'pasted')),
  prompt_version integer check (prompt_version >= 1),
  pasted_text text check (char_length(pasted_text) <= 20000),
  -- The sample library (#479) adds the foreign key; until then a run has no sample.
  sample_id text check (char_length(sample_id) between 1 and 200),
  model text not null check (char_length(model) between 1 and 200),
  -- The filled prompt as sent to the model (the first step's for a multi-step run).
  input text not null check (char_length(input) <= 200000),
  -- The answer (the last step's for a multi-step run); null when the model gave none.
  output text check (char_length(output) <= 200000),
  -- As the provider reported them; null when it reported none.
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  -- In US dollars, from the tokens and the price the owner set for the model (AI_RUN_PRICES);
  -- null when no price is set or the provider reported no tokens ("price not set").
  cost numeric(14, 8) check (cost >= 0),
  -- True when the model was the test stub (AI-LAB-STUB): every test and e2e run.
  stub boolean not null,
  status text not null check (status in ('running', 'ok', 'error')),
  error_reason text check (char_length(error_reason) between 1 and 200),
  constraint ai_runs_version_matches_source check (
    (prompt_source = 'pasted' and prompt_version is null and pasted_text is not null)
    or (prompt_source <> 'pasted' and prompt_version is not null and pasted_text is null)
  ),
  constraint ai_runs_error_has_reason check ((status = 'error') = (error_reason is not null)),
  constraint ai_runs_finished_when_ended check ((status = 'running') = (finished_at is null))
);

comment on column public.ai_runs.cost is
  'US dollars (USD), from the reported tokens and AI_RUN_PRICES; null when no price is set or no tokens were reported.';

create index ai_runs_run_at on public.ai_runs (run_at desc);
create index ai_runs_feature on public.ai_runs (feature_slug, run_at desc);

alter table public.ai_runs enable row level security;
revoke all on public.ai_runs from public, anon, authenticated;
grant select on public.ai_runs to authenticated;

create policy ai_runs_read on public.ai_runs
  for select to authenticated
  using ((select public.is_content_editor()));

create table public.ai_run_steps (
  run_id uuid not null references public.ai_runs (id) on delete cascade,
  -- 1-based order of the step in the run.
  position integer not null check (position between 1 and 50),
  -- What the step is ("draft 1", "critique", "rewrite").
  label text not null check (char_length(label) between 1 and 120),
  prompt_key text check (prompt_key ~ '^[a-z][a-z0-9_]*$'),
  prompt_version integer check (prompt_version >= 1),
  input text not null check (char_length(input) <= 200000),
  output text check (char_length(output) <= 200000),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  -- US dollars, as public.ai_runs.cost.
  cost numeric(14, 8) check (cost >= 0),
  status text not null check (status in ('ok', 'error')),
  error_reason text check (char_length(error_reason) between 1 and 200),
  primary key (run_id, position),
  constraint ai_run_steps_error_has_reason check ((status = 'error') = (error_reason is not null))
);

alter table public.ai_run_steps enable row level security;
revoke all on public.ai_run_steps from public, anon, authenticated;
grant select on public.ai_run_steps to authenticated;

create policy ai_run_steps_read on public.ai_run_steps
  for select to authenticated
  using ((select public.is_content_editor()));

-- The gate of both writers: the server's token and a signed-in content editor; 42501 otherwise.
create function private.ai_run_writer_ok(server_token text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from private.prompt_reader r
    where r.token_sha256 = encode(sha256(convert_to(coalesce(server_token, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'runs are recorded by the server only' using errcode = '42501';
  end if;
  if auth.uid() is null or not public.is_content_editor() then
    raise exception 'only a content editor may run a prompt' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.ai_run_writer_ok(text) from public, anon, authenticated;

-- Starts a run for the signed-in content editor BEFORE the model call, with the status running,
-- and returns its id. Who and when are set here (auth.uid(), now()), never taken from the caller;
-- the result columns (output, tokens, cost, status, error_reason) are not taken from the caller
-- either. Errors: 42501 (gate), 22023 (not an object), a check violation, 23503 (unknown feature).
create function public.start_ai_run(server_token text, run jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform private.ai_run_writer_ok(server_token);
  if jsonb_typeof(run) is distinct from 'object' then
    raise exception 'the run must be an object' using errcode = '22023';
  end if;

  insert into public.ai_runs (
    run_by, feature_slug, prompt_key, prompt_source, prompt_version, pasted_text, sample_id,
    model, input, stub, status
  )
  values (
    auth.uid(),
    run ->> 'feature_slug',
    run ->> 'prompt_key',
    run ->> 'prompt_source',
    (run ->> 'prompt_version')::integer,
    run ->> 'pasted_text',
    run ->> 'sample_id',
    run ->> 'model',
    run ->> 'input',
    (run ->> 'stub')::boolean,
    'running'
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.start_ai_run(text, jsonb) from public, anon, authenticated;
grant execute on function public.start_ai_run(text, jsonb) to authenticated;

-- Ends a running run of the signed-in content editor: its answer, tokens, cost, status (ok or
-- error, with the reason) and steps, and finished_at = now(). Errors: 42501 (gate), 22023 (not an
-- object, or a status other than ok or error), P0002 when there is no running run with this id
-- started by this account (an ended run is never changed), a check violation.
create function public.finish_ai_run(server_token text, run_id uuid, result jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  step jsonb;
begin
  perform private.ai_run_writer_ok(server_token);
  if jsonb_typeof(result) is distinct from 'object' then
    raise exception 'the result must be an object' using errcode = '22023';
  end if;
  if (result ->> 'status') is distinct from 'ok' and (result ->> 'status') is distinct from 'error' then
    raise exception 'a run ends as ok or error' using errcode = '22023';
  end if;

  update public.ai_runs r
  set output = result ->> 'output',
      input_tokens = (result ->> 'input_tokens')::integer,
      output_tokens = (result ->> 'output_tokens')::integer,
      cost = (result ->> 'cost')::numeric,
      status = result ->> 'status',
      error_reason = result ->> 'error_reason',
      finished_at = now()
  where r.id = run_id and r.run_by = auth.uid() and r.status = 'running';
  if not found then
    raise exception 'no running run with this id for this account' using errcode = 'P0002';
  end if;

  if jsonb_typeof(result -> 'steps') = 'array' then
    for step in select value from jsonb_array_elements(result -> 'steps')
    loop
      insert into public.ai_run_steps (
        run_id, position, label, prompt_key, prompt_version, input, output, input_tokens,
        output_tokens, cost, status, error_reason
      )
      values (
        run_id,
        (step ->> 'position')::integer,
        step ->> 'label',
        step ->> 'prompt_key',
        (step ->> 'prompt_version')::integer,
        step ->> 'input',
        step ->> 'output',
        (step ->> 'input_tokens')::integer,
        (step ->> 'output_tokens')::integer,
        (step ->> 'cost')::numeric,
        step ->> 'status',
        step ->> 'error_reason'
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.finish_ai_run(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finish_ai_run(text, uuid, jsonb) to authenticated;

-- The spend of the runs with from_time <= run_at < to_time, one row per account (the account's
-- email, null once deleted): how many runs, how many had no cost (no price set, no tokens
-- reported, or still running), how many are still running (started, never finished: a call that
-- may have been billed), and the sum of the known costs in US dollars. Content editors only
-- (42501 otherwise).
create function public.ai_run_spend(from_time timestamptz, to_time timestamptz)
returns table (
  user_id uuid,
  email text,
  runs bigint,
  unpriced_runs bigint,
  running_runs bigint,
  cost numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may read the spend' using errcode = '42501';
  end if;
  return query
  select r.run_by, u.email::text, count(*), count(*) filter (where r.cost is null),
    count(*) filter (where r.status = 'running'), coalesce(sum(r.cost), 0)
  from public.ai_runs r
  left join auth.users u on u.id = r.run_by
  where r.run_at >= from_time and r.run_at < to_time
  group by r.run_by, u.email
  order by coalesce(sum(r.cost), 0) desc, u.email;
end;
$$;

revoke all on function public.ai_run_spend(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_run_spend(timestamptz, timestamptz) to authenticated;
