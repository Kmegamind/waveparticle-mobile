-- Each Companion's mode and key code (#302). Run after 20261119000000_story_content.sql; the
-- content import (scripts/content/import.mjs) writes both columns from src/content/companions.json,
-- so run this migration before the next import.
--
--   mode      historical or fictional (FICTION-RULES): whether a story must stay with the source
--             or may invent within the Companion's world. Nothing reads it yet; the prompt library
--             (content admin phase 3) will.
--   key_code  the Companion's short code in keys (NAMING: opp, mor, dra), for example the story
--             card key crd.opp.<story>.bg. Not the display short name ("Oppenheimer").
--
-- export_story_content returns both, so the export writes them back to companions.json.
-- get_story_content is unchanged: the app does not use either column yet.

alter table public.companions
  add column mode text check (mode in ('historical', 'fictional')),
  add column key_code text check (key_code ~ '^[a-z]{2,8}$');

update public.companions set mode = 'historical', key_code = 'opp' where id = 'oppenheimer';
update public.companions set mode = 'fictional', key_code = 'mor' where id = 'moriarty';

-- A Companion other than these two must be given both before this line can pass.
alter table public.companions
  alter column mode set not null,
  alter column key_code set not null,
  add constraint companions_key_code_unique unique (key_code);

create or replace function public.export_story_content(reader_key text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'companions', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'position', c.position, 'name', c.name, 'short_name', c.short_name,
        'tags', c.tags, 'line', c.line, 'portrait', c.portrait, 'enter_href', c.enter_href,
        'mode', c.mode, 'key_code', c.key_code
      ) order by c.position)
      from public.companions c
    ), '[]'::json),
    'stories', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'companion_id', s.companion_id, 'sequence', s.sequence, 'title', s.title,
        'period', s.period, 'goal_short', s.goal_short, 'who', s.who, 'opening', s.opening
      ) order by c.position, s.sequence)
      from public.stories s
      join public.companions c on c.id = s.companion_id
    ), '[]'::json),
    'story_inputs', coalesce((
      select json_agg(json_build_object(
        'story_id', i.story_id, 'date', i.date, 'goal', i.goal, 'facts', i.facts,
        'forbidden_terms', i.forbidden_terms, 'key_moments', i.key_moments,
        'provenance', i.provenance, 'stage_zero', i.stage_zero
      ) order by i.story_id)
      from public.story_inputs i
    ), '[]'::json)
  )
  where exists (
    select 1
    from private.content_reader r
    where r.token_sha256 = encode(sha256(convert_to(reader_key, 'UTF8')), 'hex')
  );
$$;

revoke all on function public.export_story_content(text) from public;
grant execute on function public.export_story_content(text) to anon, authenticated;
