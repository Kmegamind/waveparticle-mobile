-- The focus page shows the published pre-made story cards (#300, decisions SHARED-STORY,
-- CARDS-PER-PART, CARDS-SPREAD, FAIL-PREMADE; docs/decisions/0021). Run after
-- 20261120000000_story_cards.sql.
--
-- 1. A session records which version of each card it uses (card key -> version), the first time
--    its cards are read. Later reads ask for exactly those versions, so an edit published while
--    the session is in progress does not change it. Written through the user's own client (the
--    existing owner update policy on sessions).
-- 2. get_story_cards: the server's read of one story's cards, with the same reader key as
--    get_story_content (private.content_reader, #284). The card tables stay closed to the browser:
--    only content editors may select them, and this function answers only to the server's key.

alter table public.sessions
  add column card_versions jsonb
  check (card_versions is null or jsonb_typeof(card_versions) = 'object');

-- Published cards when versions is null; otherwise exactly the listed versions (key -> version).
-- A wrong key returns null.
create function public.get_story_cards(reader_key text, story text, versions jsonb default null)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'cards', coalesce((
      select json_agg(json_build_object(
        'key', c.key, 'version', c.version, 'kind', c.kind, 'part', c.part,
        'position', c.position, 'body', c.body
      ) order by c.kind, c.part nulls first, c.position)
      from public.story_cards c
      where c.story_id = story
        and (
          (versions is null and c.published)
          -- A session's owner can write its card_versions, so a pinned read returns only versions
          -- that were published at some point (published_at stays set), never a draft.
          or (versions is not null and c.published_at is not null and (versions ->> c.key)::integer = c.version)
        )
    ), '[]'::json)
  )
  where exists (
    select 1
    from private.content_reader r
    where r.token_sha256 = encode(sha256(convert_to(reader_key, 'UTF8')), 'hex')
  );
$$;

revoke all on function public.get_story_cards(text, text, jsonb) from public;
grant execute on function public.get_story_cards(text, text, jsonb) to anon, authenticated;
