-- Publish history (#289, docs/decisions/0018). Every publish and every roll back writes one row
-- here, inside the same transaction as the change itself: who (auth.uid()), when, which kind of
-- item and which key, which version, and whether it was a publish or a roll back.
--
-- The table is shared by every kind of content. Today only app text ('app_text') writes to it;
-- characters, prompts and story cards widen the kind check in their own migrations.
--
-- Only content editors (public.is_content_editor(), 20261116000000_content_roles.sql) read it.
-- Nobody inserts, edits or deletes rows through the API: rows are written only inside
-- private.set_published_app_text below. No key with full database rights is needed anywhere.

create table public.publish_history (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('app_text')),
  item_key text not null,
  version integer not null check (version >= 1),
  action text not null check (action in ('publish', 'roll_back')),
  -- The signed-in editor. Deleting the account keeps the row, without the account.
  acted_by uuid references auth.users (id) on delete set null,
  acted_at timestamptz not null default now()
);

create index publish_history_acted_at
  on public.publish_history (acted_at desc);

alter table public.publish_history enable row level security;
revoke all on public.publish_history from public, anon, authenticated;
revoke insert, update, delete, truncate on public.publish_history from public, anon, authenticated;
grant select on public.publish_history to authenticated;

create policy publish_history_read on public.publish_history
  for select
  to authenticated
  using ((select public.is_content_editor()));

-- Replaces the #288 function (20261117000000_app_text.sql) with two changes:
-- 1. it writes the history row, after the version became the published one, in the same
--    transaction (a failure anywhere undoes both);
-- 2. roll back accepts any version that was published before and is not published now, not only
--    an earlier one, so a history row of a version that was rolled back past can be restored.
create or replace function private.set_published_app_text(
  text_key text,
  text_version integer,
  publish_action text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_version integer;
  target_published boolean;
  target_published_at timestamptz;
begin
  if publish_action not in ('publish', 'roll_back') then
    raise exception 'unknown publish action %', publish_action;
  end if;

  -- Locks the key's rows, so two publishes of one key run one after the other.
  perform 1 from public.app_text where key = text_key for update;

  select published, published_at into target_published, target_published_at
  from public.app_text
  where key = text_key and version = text_version;
  if not found then
    raise exception 'no app text % version %', text_key, text_version using errcode = 'P0002';
  end if;
  if target_published then
    raise exception 'app text % version % is already published', text_key, text_version;
  end if;

  select version into current_version
  from public.app_text
  where key = text_key and published;

  if publish_action = 'roll_back'
    and (current_version is null or target_published_at is null)
  then
    raise exception 'roll back needs a version of % that was published before', text_key;
  end if;

  update public.app_text set published = false
  where key = text_key and published;
  update public.app_text
  set published = true, published_at = now(), published_by = auth.uid()
  where key = text_key and version = text_version;

  insert into public.publish_history (kind, item_key, version, action, acted_by)
  values ('app_text', text_key, text_version, publish_action, auth.uid());
end;
$$;

revoke all on function private.set_published_app_text(text, integer, text) from public, anon, authenticated;

-- ADM-12: the newest rows first, with the editor's email and whether the row's version is the one
-- published now. Editors only: the email comes from auth.users, which no API role can read, and
-- is never returned to an account without a content role.
create function public.list_publish_history(row_limit integer default 100)
returns table (
  id bigint,
  kind text,
  item_key text,
  version integer,
  action text,
  acted_by uuid,
  acted_by_email text,
  acted_at timestamptz,
  is_current boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_content_editor() then
    raise exception 'only a content editor may read the publish history' using errcode = '42501';
  end if;
  return query
  select
    h.id,
    h.kind,
    h.item_key,
    h.version,
    h.action,
    h.acted_by,
    u.email::text,
    h.acted_at,
    case h.kind
      when 'app_text' then exists (
        select 1 from public.app_text t
        where t.key = h.item_key and t.version = h.version and t.published
      )
      else false
    end
  from public.publish_history h
  left join auth.users u on u.id = h.acted_by
  order by h.acted_at desc, h.id desc
  limit least(greatest(coalesce(row_limit, 100), 1), 500);
end;
$$;

revoke all on function public.list_publish_history(integer) from public, anon, authenticated;
grant execute on function public.list_publish_history(integer) to authenticated;
