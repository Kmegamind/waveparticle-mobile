-- The safety classifier's same-day alarm (#117, US-SAF-4 AC3; owner decision of 2026-11-22,
-- SAFETY-ALARM). One row per day (UTC) counts the times the classifier failed or timed out, and
-- records when that day's one alarm was sent, so every server instance shares "at most one alarm
-- a day". No text a person wrote, and no hash of it, is stored here.
--
-- The table lives in the private schema, which the API cannot reach. The server counts through
-- record_safety_classifier_failure, which answers only to the server's prompt reader token
-- (PROMPTS_READ_TOKEN, private.prompt_reader, 20261115000000_prompts.sql): no new secret.

create table private.safety_alarm_days (
  day date primary key,
  failures integer not null default 0 check (failures >= 0),
  alarm_sent_at timestamptz
);

-- Counts one failure for today (UTC). send_alarm is true for the first call of the day only; with
-- an unknown token nothing is counted and no row is returned.
create function public.record_safety_classifier_failure(reader_token text)
returns table (failures integer, send_alarm boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
  counted integer;
  already timestamptz;
begin
  if not exists (
    select 1
    from private.prompt_reader r
    where r.token_sha256 = encode(sha256(convert_to(reader_token, 'UTF8')), 'hex')
  ) then
    return;
  end if;

  insert into private.safety_alarm_days as d (day, failures)
  values (today, 1)
  on conflict (day) do update set failures = d.failures + 1
  returning d.failures, d.alarm_sent_at into counted, already;

  if already is null then
    update private.safety_alarm_days set alarm_sent_at = now() where day = today;
  end if;

  failures := counted;
  send_alarm := already is null;
  return next;
end;
$$;

revoke all on function public.record_safety_classifier_failure(text) from public;
grant execute on function public.record_safety_classifier_failure(text) to anon, authenticated;
