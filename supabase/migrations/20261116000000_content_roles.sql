-- Content roles (#287, docs/decisions/0016). An account with a row here may open the content admin
-- at /admin: 'admin' or 'writer'. An account without a row gets the normal 404 there.
--
-- Nobody reads or changes this table through the API: row level security is on and there is no
-- policy. The app and the row level security policies of later content tables ask through
-- content_role() and is_content_editor(), which answer only for the signed-in account (auth.uid()).
-- A role is granted with one SQL command in the SQL editor (docs/deploy.md); there is no invite
-- screen and no key with full database rights in the app.

create table public.content_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'writer')),
  granted_at timestamptz not null default now()
);

alter table public.content_roles enable row level security;
revoke all on public.content_roles from anon, authenticated;

-- The signed-in account's role ('admin' or 'writer'), or null without one or without a session.
create function public.content_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role
  from public.content_roles r
  where r.user_id = auth.uid();
$$;

revoke all on function public.content_role() from public;
grant execute on function public.content_role() to anon, authenticated;

-- True when the signed-in account is an admin or a writer. For later policies:
--   create policy ... using ((select public.is_content_editor()));
-- (the select runs it once per query). anon may call both functions: a policy that also applies to
-- anon requests needs the execute right, and without a session the answer is null or false.
create function public.is_content_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.content_role() is not null;
$$;

revoke all on function public.is_content_editor() from public;
grant execute on function public.is_content_editor() to anon, authenticated;
