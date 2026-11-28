-- The rest chat stops at round 10 (#518, REST-ROUND-10, docs/decisions/0042). Run after
-- 20261208000000_companion_preview.sql (and after 20261209000000 if that number exists). It can be
-- run again on a database that already has it: the table is created only when missing and the
-- functions are replaced with the same ones.
--
-- In one Pause, his reply to the person's tenth message says that his own work is going to fail,
-- and after it he stops replying. The count of a signed-in account is kept here, so a reload (or
-- another device) cannot start it again within the same Pause:
--
-- 1. private.rest_rounds: one row per Pause of an account session, keyed by the session and the
--    Pause's own id (a random UUID the phone makes when the Pause starts; a new Pause gets a new
--    id, so the count starts again at every Pause). `rounds` is the number of his replies already
--    shown in that Pause, 0 to 10. No message text is stored. Closed to the API: only the two
--    functions below read and write it. A row goes when its session goes (account deletion).
-- 2. public.rest_round(target_session, target_pause): the count of a Pause of the caller's own
--    session, 0 when there is none yet. Another account's session reads as 0 and reveals nothing.
-- 3. public.record_rest_round(target_session, target_pause, shown_round): notes that the reply of
--    `shown_round` was shown. Only the next round is counted (`shown_round` = count + 1), so a repeated or
--    out-of-order write changes nothing; it returns the count after the write. A failed reply is
--    never recorded, so its retry keeps the round. Refused for a session of another account.
--
-- Dry run (before applying, in the SQL editor; expected: one row, t, f, f, f):
--   select
--     exists (select 1 from pg_namespace where nspname = 'private') as private_schema_exists,
--     to_regclass('private.rest_rounds') is not null as table_exists,
--     to_regprocedure('public.rest_round(uuid, uuid)') is not null as read_exists,
--     to_regprocedure('public.record_rest_round(uuid, uuid, integer)') is not null as write_exists;
--
-- Check (after applying; expected: t, t, t, then 0):
--   select to_regclass('private.rest_rounds') is not null;
--   select to_regprocedure('public.rest_round(uuid, uuid)') is not null;
--   select to_regprocedure('public.record_rest_round(uuid, uuid, integer)') is not null;
--   select count(*) from private.rest_rounds;
--
-- Undo (in the SQL editor; the phones then fail every rest reply with Retry until the app's
-- deploy of #518 is rolled back too):
--   drop function if exists public.record_rest_round(uuid, uuid, integer);
--   drop function if exists public.rest_round(uuid, uuid);
--   drop table if exists private.rest_rounds;

create table if not exists private.rest_rounds (
  session_id uuid not null references public.sessions (id) on delete cascade,
  pause_key uuid not null,
  rounds integer not null default 0 check (rounds between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (session_id, pause_key)
);

revoke all on private.rest_rounds from public, anon, authenticated;

create or replace function public.rest_round(target_session uuid, target_pause uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select r.rounds
      from private.rest_rounds r
      join public.sessions s on s.id = r.session_id
      where r.session_id = target_session
        and r.pause_key = target_pause
        and s.user_id = auth.uid()
    ),
    0
  );
$$;

revoke all on function public.rest_round(uuid, uuid) from public;
grant execute on function public.rest_round(uuid, uuid) to authenticated;

create or replace function public.record_rest_round(
  target_session uuid,
  target_pause uuid,
  shown_round integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  counted integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sessions s where s.id = target_session and s.user_id = auth.uid()
  ) then
    raise exception 'not a session of this account' using errcode = '42501';
  end if;
  if shown_round is null or shown_round < 1 or shown_round > 10 then
    raise exception 'a rest round is 1 to 10' using errcode = '22023';
  end if;
  insert into private.rest_rounds (session_id, pause_key, rounds)
  values (target_session, target_pause, 0)
  on conflict (session_id, pause_key) do nothing;
  select r.rounds into counted
  from private.rest_rounds r
  where r.session_id = target_session and r.pause_key = target_pause
  for update;
  if shown_round = counted + 1 then
    update private.rest_rounds r
    set rounds = shown_round, updated_at = now()
    where r.session_id = target_session and r.pause_key = target_pause;
    return shown_round;
  end if;
  return counted;
end;
$$;

revoke all on function public.record_rest_round(uuid, uuid, integer) from public;
grant execute on function public.record_rest_round(uuid, uuid, integer) to authenticated;
