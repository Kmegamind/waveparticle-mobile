-- Prompts in the database (#282). Every prompt the model gateway sends lives here, with a key, a
-- version and an active flag; the app reads the active version of each key. The seed is
-- docs/ai/prompts (scripts/prompts/import.mjs turns it into calls of import_prompt below).
--
-- Nobody reads this table through the API: row level security is on and there is no policy. The
-- server reads it through get_active_prompts, which answers only to the server's reader token
-- (PROMPTS_READ_TOKEN, a server-only setting). Only the SHA-256 of that token is stored, in a
-- schema the API cannot reach. No key with full database rights is needed anywhere.

create table public.prompts (
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  version integer not null check (version >= 1),
  active boolean not null default false,
  body text not null,
  params jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (key, version)
);

-- One active version per key at most.
create unique index prompts_one_active_per_key
  on public.prompts (key) where active;

alter table public.prompts enable row level security;
revoke all on public.prompts from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The SHA-256 (hex) of each reader token the server may use. Add one with
-- node scripts/prompts/token.mjs, which prints the token for the server and this row.
create table private.prompt_reader (
  token_sha256 text primary key check (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- The active prompts, for the server only: without a known reader token it returns no rows.
create function public.get_active_prompts(reader_token text)
returns table (key text, version integer, body text, params jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.key, p.version, p.body, p.params
  from public.prompts p
  where p.active
    and exists (
      select 1
      from private.prompt_reader r
      where r.token_sha256 = encode(sha256(convert_to(reader_token, 'UTF8')), 'hex')
    );
$$;

revoke all on function public.get_active_prompts(text) from public;
grant execute on function public.get_active_prompts(text) to anon, authenticated;

-- Makes one version the active one for its key (the owner, in the SQL editor).
create function public.activate_prompt(prompt_key text, prompt_version integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.prompts where key = prompt_key and version = prompt_version
  ) then
    raise exception 'no prompt % version %', prompt_key, prompt_version;
  end if;
  update public.prompts set active = false
    where key = prompt_key and active and version <> prompt_version;
  update public.prompts set active = true
    where key = prompt_key and version = prompt_version;
end;
$$;

revoke all on function public.activate_prompt(text, integer) from public, anon, authenticated;

-- Loads one prompt from the files: a new version when the text or settings changed, then that
-- version (or the unchanged one) becomes active. Running the same import twice changes nothing.
create function public.import_prompt(
  prompt_key text,
  prompt_body text,
  prompt_params jsonb,
  prompt_note text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  chosen integer;
begin
  select version into chosen
  from public.prompts
  where key = prompt_key and body = prompt_body and params = prompt_params
  order by version desc
  limit 1;

  if chosen is null then
    select coalesce(max(version), 0) + 1 into chosen from public.prompts where key = prompt_key;
    insert into public.prompts (key, version, body, params, note)
    values (prompt_key, chosen, prompt_body, prompt_params, coalesce(prompt_note, ''));
  end if;

  perform public.activate_prompt(prompt_key, chosen);
  return chosen;
end;
$$;

revoke all on function public.import_prompt(text, text, jsonb, text) from public, anon, authenticated;
