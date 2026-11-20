-- A prompt version made active outside the admin counts as published before (#317, after the
-- review of #311). Run after 20261125000000_prompt_editing.sql.
--
-- The admin's Publish and Roll back set prompts.activated_at, but the import (import_prompt) and
-- the Supabase table editor make a version active without it. Such a version later showed as
-- "Draft" in the admin's versions list, and roll_back_prompt refused it ("roll back needs a
-- version that was active before").
--
-- 1. A trigger fills activated_at when a version becomes active and activated_at is empty. It
--    never changes a value already set.
-- 2. The version active now, if its activated_at is empty, gets the time of its latest "publish"
--    row in Publish history, or else its created time.
--
-- Publish history is only read: no row is added or changed, and its kind list stays as it is.

create function private.fill_prompt_activated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active and new.activated_at is null then
    new.activated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.fill_prompt_activated_at() from public, anon, authenticated;

create trigger prompts_fill_activated_at
  before insert or update of active on public.prompts
  for each row execute function private.fill_prompt_activated_at();

update public.prompts p
set activated_at = coalesce(
  (
    select max(h.acted_at)
    from public.publish_history h
    where h.kind = 'prompt'
      and h.item_key = p.key
      and h.version = p.version
      and h.action = 'publish'
  ),
  p.created_at
)
where p.active and p.activated_at is null;
