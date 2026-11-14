-- Delete my data (#103, #8 AC3): the signed-in user deletes their account and everything in it.
-- Runs as the function owner so it can remove the auth.users row, but only ever for auth.uid():
-- a caller cannot name another account. Rows are deleted explicitly, child tables first, before
-- the auth user, so nothing depends on cascades alone.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  delete from public.session_lines
  where session_id in (select id from public.sessions where user_id = uid);

  delete from public.session_steps
  where session_id in (select id from public.sessions where user_id = uid);

  delete from public.sessions where user_id = uid;

  delete from public.steps
  where goal_id in (select id from public.goals where user_id = uid);

  delete from public.goals where user_id = uid;

  delete from public.profiles where user_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
