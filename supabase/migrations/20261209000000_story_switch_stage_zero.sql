-- A story's switch-over also replaces its stage 0 slices, steps and scene (#526,
-- docs/decisions/0041). Run after 20261208000000_companion_preview.sql. Nothing here changes a
-- story: the import and the switch-over stay SQL that scripts/content/import-drafts.mjs and
-- scripts/content/switch-story.mjs print, which the owner runs in the SQL editor.
--
-- 1. story_inputs.stage_zero_next: the export's new { slices, steps, scene } of a story that is
--    not switched over yet, written by the draft import (--keep-published). It waits there; phones
--    never read it (get_story_content lists its columns and does not name it), so they keep the
--    stage 0 that matches the cards they play. The switch-over copies the export's values into
--    stage_zero and sets this column to null; its undo puts it back.
-- 2. private.story_switches keeps, as exact text, the stage_zero and provenance a switch-over
--    replaced and the stage_zero it wrote, and the waiting value it cleared, so the undo puts the
--    same text back (an md5 check of the story inputs matches again). Null on a switch-over
--    recorded before this migration (its undo leaves stage_zero alone, as it did then).
--    The switch-over also marks the story's provenance outsideRepository and switchedOver: the
--    repository's content export (scripts/content/export.mjs) then never writes its new stage 0
--    to docs/demo, and the content import (scripts/content/import.mjs) never overwrites it.
-- 3. get_story_stage_zero_next(reader_key): the waiting values by story, for the server's reader
--    key only (as get_story_content). The admin's story page shows what the new stage 0 of a
--    story not switched over yet finds, as warnings; Publish checks the live stage 0.

alter table public.story_inputs
  add column stage_zero_next jsonb
    check (stage_zero_next is null or jsonb_typeof(stage_zero_next) = 'object');

alter table private.story_switches
  add column stage_zero_before text,
  add column stage_zero_after text,
  add column provenance_before text,
  add column stage_zero_next_before jsonb
    check (stage_zero_next_before is null or jsonb_typeof(stage_zero_next_before) = 'object');

create function public.get_story_stage_zero_next(reader_key text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select json_object_agg(i.story_id, i.stage_zero_next order by i.story_id)
      from public.story_inputs i where i.stage_zero_next is not null),
    '{}'::json
  )
  where exists (
    select 1
    from private.content_reader r
    where r.token_sha256 = encode(sha256(convert_to(reader_key, 'UTF8')), 'hex')
  );
$$;

revoke all on function public.get_story_stage_zero_next(text) from public;
grant execute on function public.get_story_stage_zero_next(text) to anon, authenticated;
