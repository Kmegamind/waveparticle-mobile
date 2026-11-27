-- Switching a story over to its regenerated cards (#516, docs/decisions/0039). Run after
-- 20261206000000_ai_comparisons.sql. Nothing here changes a card: the switch-over and its undo are
-- SQL that scripts/content/switch-story.mjs prints for one story, which the owner runs in the SQL
-- editor when she decides to. This migration only gives them a place to record what they do.
--
-- 1. The Publish history takes two more rows:
--    - action 'retire': a published card version that stopped being published because the new
--      set of cards has no such key (its published_at stays, so a session pinned to it can still
--      read it, as get_story_cards allows);
--    - kind 'story_switch': one row per switch-over (action 'publish') and per undo
--      (action 'roll_back') of a story; item_key is the story id and version counts the
--      switch-overs of that story. It stands for the part titles, which have no versions.
-- 2. private.story_switches keeps, per switch-over, the published card versions and the part
--    titles before and after, so the undo can put exactly the earlier ones back. Closed to the API.

alter table public.publish_history
  drop constraint publish_history_action_check,
  add constraint publish_history_action_check check (action in ('publish', 'roll_back', 'retire'));

alter table public.publish_history
  drop constraint publish_history_kind_check,
  add constraint publish_history_kind_check check (
    kind in ('app_text', 'story_card', 'companion_field', 'story_field', 'prompt', 'hotline', 'story_switch')
  );

create table private.story_switches (
  id bigint generated always as identity primary key,
  story_id text not null references public.stories (id) on delete cascade,
  switched_at timestamptz not null default now(),
  switched_by uuid references auth.users (id) on delete set null,
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  -- Card key -> the version published (before and right after the switch-over).
  cards_before jsonb not null check (jsonb_typeof(cards_before) = 'object'),
  cards_after jsonb not null check (jsonb_typeof(cards_after) = 'object'),
  -- [{ "part": n, "title": "..." }] in part order.
  parts_before jsonb not null check (jsonb_typeof(parts_before) = 'array'),
  parts_after jsonb not null check (jsonb_typeof(parts_after) = 'array'),
  -- Card key -> the earlier publish time of a version the switch-over published again (one that
  -- was published before and rolled back past), so the undo restores it (#522 review).
  earlier_published_at jsonb not null default '{}'::jsonb
    check (jsonb_typeof(earlier_published_at) = 'object')
);

-- At most one switch-over of a story that is not undone.
create unique index story_switches_one_open
  on private.story_switches (story_id) where undone_at is null;

revoke all on private.story_switches from public, anon, authenticated;
