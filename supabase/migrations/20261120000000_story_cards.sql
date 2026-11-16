-- Pre-written story cards in the database (#293, decisions SHARED-STORY, CARDS-PER-PART,
-- CARD-LENGTH, NAMING; docs/decisions/0020). Each story has one background card and cards for each
-- of its parts, with the part titles. Every card is versioned like app text: at most one version
-- per key is published. Keys follow NAMING: crd.<story>.<part>.<slot> and crd.<story>.bg, where
-- <story> is <short>.<slug> (crd.opp.site-search.p3.c2).
--
-- Read-only in this issue. Only content editors (admin or writer, public.is_content_editor()) read
-- these tables through the API; no other account and no anonymous request reads a row. Nothing is
-- written through the API: scripts/story-cards/import.mjs prints the SQL that loads the seed, for
-- the SQL editor. Editing, publishing and the publish history come later (Phase 4). The phone
-- screens do not read these tables yet. Run after 20261119000000_story_content.sql.

create table public.story_parts (
  story_id text not null references public.stories (id) on delete cascade,
  part integer not null check (part between 1 and 5),
  title text not null check (title ~ '\S'),
  created_at timestamptz not null default now(),
  primary key (story_id, part)
);

create table public.story_cards (
  key text not null
    check (key ~ '^crd\.[a-z]+\.[a-z0-9][a-z0-9-]*\.(bg|p[1-5]\.c[1-9][0-9]*)$'),
  version integer not null check (version >= 1),
  story_id text not null references public.stories (id) on delete cascade,
  kind text not null check (kind in ('background', 'part')),
  part integer check (part between 1 and 5),
  -- The story slice the card belongs to (s1, s2 ...); a background card has none.
  slice text check (slice ~ '^s[1-9][0-9]*$'),
  -- The card's order within its part (1 for the background card).
  position integer not null check (position >= 1),
  body text not null check (body ~ '\S') check (char_length(body) <= 2000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (
    (kind = 'background' and part is null and slice is null and key ~ '\.bg$')
    or (kind = 'part' and part is not null and slice is not null and key ~ '\.p[1-5]\.c[0-9]+$')
  ),
  primary key (key, version)
);

-- One published version per card at most.
create unique index story_cards_one_published_per_key
  on public.story_cards (key) where published;

create index story_cards_story on public.story_cards (story_id);

alter table public.story_parts enable row level security;
alter table public.story_cards enable row level security;
revoke all on public.story_parts from anon, authenticated;
revoke all on public.story_cards from anon, authenticated;
grant select on public.story_parts to authenticated;
grant select on public.story_cards to authenticated;

-- Drafts and published cards alike: editors only. Published card text is not secret, but the
-- browser has no need for it before a story starts, so no other account reads it.
create policy story_parts_read on public.story_parts
  for select
  to authenticated
  using ((select public.is_content_editor()));

create policy story_cards_read on public.story_cards
  for select
  to authenticated
  using ((select public.is_content_editor()));
