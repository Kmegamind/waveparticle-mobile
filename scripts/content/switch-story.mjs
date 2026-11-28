// Switches ONE story of a Companion over to his regenerated cards, after they were imported as
// drafts next to the published ones (scripts/content/import-drafts.mjs --keep-published, #516;
// docs/api/story-draft-import.md, docs/decisions/0039). It reads the same export folder, which
// stays outside the repository, PRINTS SQL to stdout, connects to nothing and never calls a model.
// The owner runs the SQL in the SQL editor, one story at a time, when she decides to.
//
//   node scripts/content/switch-story.mjs <export folder> <story> --by <admin email>             # the switch-over
//   node scripts/content/switch-story.mjs <export folder> <story> --by <admin email> --dry-run   # then ROLLBACK
//   node scripts/content/switch-story.mjs <export folder> <story> --check                        # read only
//   node scripts/content/switch-story.mjs <export folder> <story> --by <admin email> --undo [--dry-run]
//
// The switch-over, in one transaction:
//   - publishes the newest version of every card of the story's new set (the imported draft, or
//     a later edit saved in the admin) that is not published yet;
//   - retires the story's published cards whose keys the new set does not have (published false;
//     published_at stays, so a session already pinned to them keeps reading them);
//   - sets the part titles to the new set's (3 to 5 parts);
//   - writes a Publish history row for each card published ('publish') and retired ('retire') and
//     one 'story_switch' row for the story, all with the account named by --by;
//   - #526: replaces slices, steps and scene in the story's stage_zero with the export's stage 0
//     (app/stage0/<story>.stage0.json; every other value stays, so the display places that
//     content_fields holds are untouched), and clears the copy waiting in stage_zero_next;
//   - records what was published, the part titles and the stage 0 values before and after in
//     private.story_switches (migrations 20261207000000 and 20261209000000).
// Nothing is printed when the story has no stage 0 file in the export. It stops, changing
// nothing, when the account is unknown, the story is not his, the story is already switched over,
// or a card of the new set has no version with the file's text (the draft import has not run).
// The undo puts back exactly the cards, part titles and stage 0 values of before, with history
// rows ('roll_back' for each card published again, 'retire' for each new card that had no earlier
// version), and stops when any card of the story, or its slices, steps or scene, changed after
// the switch-over. The cards are named by key and md5 only; the part titles and the stage 0 are
// the only text in the SQL.
// The card checks of the admin's Publish do not run here: they are TypeScript, and the SQL editor
// cannot run them. `npm run check:export-cards` and the admin story page show each card's problems
// first; whether a story with failing cards is switched anyway is the owner's decision (#516).
// A card whose newest version is an editor's draft (saved in the admin) is published as the editor
// left it: the draft import never stacks the file's text on top of it (#522 review).
// Every dry run (switch and undo) stops with its report as an error that starts "Dry run: nothing
// was changed.", because the SQL editor shows only the last result.

import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  currentStage,
  exportTables,
  quote,
  readCardExport,
  stageZeroTable,
} from "./import-drafts.mjs";

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const EMAIL = /^[^\s'@]+@[^\s'@]+\.[^\s'@]+$/;

/** The rows of one story of the export, or an error naming it. */
function storyRows(rows, storyId) {
  if (!SAFE_ID.test(storyId) || !rows.stories.some((story) => story.id === storyId)) {
    throw new Error(`story ${storyId} is not in the export`);
  }
  return {
    companion: rows.companion,
    stories: [{ id: storyId }],
    parts: rows.parts.filter((part) => part.story_id === storyId),
    cards: rows.cards.filter((card) => card.story_id === storyId),
    stageZeros: (rows.stageZeros ?? []).filter((entry) => entry.story_id === storyId),
  };
}

/** #526: the switch-over replaces the story's slices, steps and scene; the file must hold them. */
function requireStage(story, storyId) {
  if (story.stageZeros.length === 0) {
    throw new Error(
      `story ${storyId} has no stage 0 file in the export (app/stage0/${storyId}.stage0.json): the switch-over replaces its slices, steps and scene from it (#526); nothing was printed`,
    );
  }
}

function actorSql(by) {
  if (typeof by !== "string" || !EMAIL.test(by)) throw new Error("--by needs an email address");
  return [
    "  select u.id into actor from auth.users u",
    "    join public.content_roles cr on cr.user_id = u.id and cr.role = 'admin'",
    `    where lower(u.email) = lower(${quote(by)});`,
    "  if actor is null then",
    "    raise exception 'no admin account with the email given to --by (give it the admin role first); nothing was changed';",
    "  end if;",
  ];
}

/**
 * Counts of what this transaction wrote for the story. The dry run stops with them as an error
 * that starts "Dry run: nothing was changed.", so the SQL editor shows them, and nothing is kept.
 */
function summarySql(storyId, code) {
  const own = `item_key like 'crd.${code}.${storyId}.%'`;
  return [
    "do $report$",
    "declare",
    "  report text;",
    "begin",
    "  select string_agg(what || ': ' || count, E'\\n' order by at) into report from (",
    `  select 1 as at, 'cards published' as what, (select count(*) from public.publish_history where acted_at = now() and kind = 'story_card' and action = 'publish' and ${own})::int as count`,
    `  union all select 2, 'cards published again (undo)', (select count(*) from public.publish_history where acted_at = now() and kind = 'story_card' and action = 'roll_back' and ${own})::int`,
    `  union all select 3, 'cards retired', (select count(*) from public.publish_history where acted_at = now() and kind = 'story_card' and action = 'retire' and ${own})::int`,
    `  union all select 4, 'cards published now', (select count(*) from public.story_cards where story_id = '${storyId}' and published)::int`,
    `  union all select 5, 'part titles now', (select count(*) from public.story_parts where story_id = '${storyId}')::int`,
    "  union all select 6, 'publish history rows', (select count(*) from public.publish_history where acted_at = now())::int",
    "  union all select 7, 'versions kept for a pinned session', coalesce(nullif(current_setting('wp.story_switch_kept', true), ''), '0')::int",
    `  union all select 8, 'stage 0 replaced (slices, steps, scene)', (select count(*) from public.story_inputs where story_id = '${storyId}' and updated_at = now())::int`,
    "  ) summary;",
    "  raise exception 'Dry run: nothing was changed.%', E'\\n' || report;",
    "end",
    "$report$;",
    "rollback;",
  ];
}

const publishedNow = (story) =>
  `coalesce((select jsonb_object_agg(key, version) from public.story_cards where story_id = ${story} and published), '{}'::jsonb)`;
const partsNow = (story) =>
  `coalesce((select jsonb_agg(jsonb_build_object('part', part, 'title', title) order by part) from public.story_parts where story_id = ${story}), '[]'::jsonb)`;
const history = (kind, key, version, action) =>
  `insert into public.publish_history (kind, item_key, version, action, acted_by) values ('${kind}', ${key}, ${version}, '${action}', actor);`;

/**
 * The switch-over of one story, in one transaction.
 * @param {ReturnType<typeof readCardExport>} rows
 * @param {string} storyId
 * @param {{ by: string, dryRun?: boolean }} options
 */
export function switchSql(rows, storyId, { by, dryRun = false }) {
  const story = storyRows(rows, storyId);
  requireStage(story, storyId);
  const c = rows.companion;
  return [
    `-- Switch-over of story ${storyId} of ${c.id} to the regenerated cards (scripts/content/switch-story.mjs, #516): ${story.cards.length} cards in the new set, ${story.parts.length} part titles, and its stage 0 slices, steps and scene (#526). Run it after the draft import (import-drafts.mjs --keep-published).`,
    "-- Holds the part titles and the stage 0: run it in the SQL editor only; never save it in the repository.",
    ...(dryRun ? ["-- DRY RUN: stops with its report; nothing is kept."] : []),
    "begin;",
    "set local standard_conforming_strings = on;",
    ...exportTables(story, { bodies: false }),
    ...stageZeroTable(story),
    "do $switch$",
    "declare",
    `  target_story constant text := '${storyId}';`,
    "  actor uuid;",
    "  r record;",
    "  switch_number integer;",
    "  before_cards jsonb;",
    "  before_parts jsonb;",
    "  earlier jsonb := '{}'::jsonb;",
    "  new_stage jsonb;",
    "  before_stage jsonb;",
    "  before_next jsonb;",
    "begin",
    ...actorSql(by),
    `  if not exists (select 1 from public.stories where id = target_story and companion_id = '${c.id}') then`,
    "    raise exception 'story % is not one of this Companion''s stories; nothing was changed', target_story;",
    "  end if;",
    "  perform 1 from public.story_cards where story_id = target_story for update;",
    "  if exists (select 1 from private.story_switches where story_id = target_story and undone_at is null) then",
    "    raise exception 'story % is already switched over: undo that first; nothing was changed', target_story;",
    "  end if;",
    "  -- Each card of the new set has the file's text in some version, or an editor's draft on top.",
    "  select i.key into r from import_cards i",
    "    where not exists (select 1 from public.story_cards k where k.key = i.key and md5(k.body) = i.digest)",
    "      and not exists (select 1 from public.story_cards n where n.key = i.key",
    "        and n.version = (select max(m.version) from public.story_cards m where m.key = i.key)",
    "        and n.created_by is not null and not n.published and n.published_at is null)",
    "    order by i.key limit 1;",
    "  if found then",
    "    raise exception 'card % has no version with the text of the file: run the draft import first (import-drafts.mjs --keep-published); nothing was changed', r.key;",
    "  end if;",
    "  select x.stage into new_stage from import_stage x where x.story_id = target_story;",
    `  select ${currentStage("i.stage_zero")}, i.stage_zero_next into before_stage, before_next`,
    "    from public.story_inputs i where i.story_id = target_story for update;",
    "  if not found then",
    "    raise exception 'story % has no story inputs row; nothing was changed', target_story;",
    "  end if;",
    `  before_cards := ${publishedNow("target_story")};`,
    `  before_parts := ${partsNow("target_story")};`,
    "  -- Every card of the new set: its newest version becomes the published one.",
    "  for r in select i.key, (select max(k.version) from public.story_cards k where k.key = i.key) as version",
    "      from import_cards i order by i.key loop",
    "    if not exists (select 1 from public.story_cards k where k.key = r.key and k.version = r.version and k.published) then",
    "      -- A version published before (and rolled back past) keeps its earlier time for the undo.",
    "      select earlier || coalesce((select jsonb_build_object(r.key, k.published_at) from public.story_cards k",
    "          where k.key = r.key and k.version = r.version and k.published_at is not null), '{}'::jsonb)",
    "        into earlier;",
    "      update public.story_cards set published = false where key = r.key and published;",
    "      update public.story_cards set published = true, published_at = now(), published_by = actor",
    "        where key = r.key and version = r.version;",
    `      ${history("story_card", "r.key", "r.version", "publish")}`,
    "    end if;",
    "  end loop;",
    "  -- The old keys the new set does not have: retired.",
    "  for r in select k.key, k.version from public.story_cards k",
    "      where k.story_id = target_story and k.published",
    "        and not exists (select 1 from import_cards i where i.key = k.key)",
    "      order by k.key loop",
    "    update public.story_cards set published = false where key = r.key and version = r.version;",
    `    ${history("story_card", "r.key", "r.version", "retire")}`,
    "  end loop;",
    "  -- The part titles of the new set, and no other part.",
    "  delete from public.story_parts p",
    "    where p.story_id = target_story and not exists (select 1 from import_parts x where x.part = p.part);",
    "  insert into public.story_parts (story_id, part, title)",
    "    select target_story, x.part, x.title from import_parts x",
    "    on conflict (story_id, part) do update set title = excluded.title;",
    "  -- #526: the export's slices, steps and scene; every other value of stage_zero (the display",
    "  -- places, people, voice, ...) stays. The new stage 0 stops waiting in stage_zero_next.",
    "  update public.story_inputs",
    "    set stage_zero = ((stage_zero::jsonb - 'slices' - 'steps' - 'scene') || new_stage)::json,",
    "        stage_zero_next = null, updated_at = now()",
    "    where story_id = target_story;",
    "  insert into private.story_switches (story_id, switched_by, cards_before, cards_after, parts_before, parts_after, earlier_published_at,",
    "      stage_zero_before, stage_zero_after, stage_zero_next_before)",
    `    values (target_story, actor, before_cards, ${publishedNow("target_story")}, before_parts, ${partsNow("target_story")}, earlier,`,
    "      before_stage, new_stage, before_next);",
    "  select count(*) into switch_number from private.story_switches where story_id = target_story;",
    `  ${history("story_switch", "target_story", "switch_number", "publish")}`,
    "end",
    "$switch$;",
    ...(dryRun ? summarySql(storyId, c.key_code) : ["commit;"]),
    "",
  ].join("\n");
}

/**
 * The undo of the story's switch-over that is not undone yet, in one transaction.
 * @param {ReturnType<typeof readCardExport>} rows
 * @param {string} storyId
 * @param {{ by: string, dryRun?: boolean }} options
 */
export function switchUndoSql(rows, storyId, { by, dryRun = false }) {
  storyRows(rows, storyId);
  const c = rows.companion;
  return [
    `-- Undo of the switch-over of story ${storyId} of ${c.id} (scripts/content/switch-story.mjs --undo, #516): the cards published and the part titles of before come back.`,
    ...(dryRun ? ["-- DRY RUN: stops with its report; nothing is kept."] : []),
    "begin;",
    "do $undo$",
    "declare",
    `  target_story constant text := '${storyId}';`,
    "  actor uuid;",
    "  w private.story_switches%rowtype;",
    "  r record;",
    "  was integer;",
    "  became integer;",
    "  switch_number integer;",
    "  kept integer := 0;",
    "begin",
    ...actorSql(by),
    "  select * into w from private.story_switches where story_id = target_story and undone_at is null for update;",
    "  if not found then",
    "    raise exception 'story % has no switch-over to undo; nothing was changed', target_story;",
    "  end if;",
    "  perform 1 from public.story_cards where story_id = target_story for update;",
    `  if ${publishedNow("target_story")} <> w.cards_after then`,
    "    raise exception 'a card of story % was published, rolled back or retired after the switch-over: the undo changes nothing (roll those cards back in the admin first)', target_story;",
    "  end if;",
    "  -- #526: a switch-over recorded before stage 0 was switched (no stage_zero_after) leaves it alone.",
    "  if w.stage_zero_after is not null then",
    "    perform 1 from public.story_inputs where story_id = target_story for update;",
    `    if (select ${currentStage("i.stage_zero")} from public.story_inputs i where i.story_id = target_story) is distinct from w.stage_zero_after then`,
    "      raise exception 'the stage 0 slices, steps or scene of story % changed after the switch-over: the undo changes nothing', target_story;",
    "    end if;",
    "    update public.story_inputs",
    "      set stage_zero = ((stage_zero::jsonb - 'slices' - 'steps' - 'scene') || coalesce(w.stage_zero_before, '{}'::jsonb))::json,",
    "          stage_zero_next = w.stage_zero_next_before, updated_at = now()",
    "      where story_id = target_story;",
    "  end if;",
    "  for r in select key from (select jsonb_object_keys(w.cards_before) as key",
    "      union select jsonb_object_keys(w.cards_after)) k order by key loop",
    "    was := (w.cards_before ->> r.key)::integer;",
    "    became := (w.cards_after ->> r.key)::integer;",
    "    continue when was is not distinct from became;",
    "    -- The version the switch-over published (#522 review):",
    "    --  - published before the switch-over: its earlier publish time comes back;",
    "    --  - pinned by a phone session: it keeps its publish time, so that session keeps its cards",
    "    --    (get_story_cards reads a pinned version only while published_at is set);",
    "    --  - otherwise a draft again, so the draft import's undo can remove it.",
    "    if became is not null then",
    "      if w.earlier_published_at ? r.key then",
    "        update public.story_cards set published = false,",
    "            published_at = (w.earlier_published_at ->> r.key)::timestamptz",
    "          where key = r.key and version = became;",
    "      elsif exists (select 1 from public.sessions s",
    "          where s.story_id = target_story and (s.card_versions ->> r.key)::integer = became) then",
    "        update public.story_cards set published = false where key = r.key and version = became;",
    "        kept := kept + 1;",
    "      else",
    "        update public.story_cards set published = false, published_at = null, published_by = null",
    "          where key = r.key and version = became;",
    "      end if;",
    "    end if;",
    "    -- The earlier version comes back with its own publish time.",
    "    if was is not null then",
    "      update public.story_cards set published = true where key = r.key and version = was;",
    `      ${history("story_card", "r.key", "was", "roll_back")}`,
    "    else",
    `      ${history("story_card", "r.key", "became", "retire")}`,
    "    end if;",
    "  end loop;",
    "  delete from public.story_parts where story_id = target_story;",
    "  insert into public.story_parts (story_id, part, title)",
    "    select target_story, (p ->> 'part')::integer, p ->> 'title' from jsonb_array_elements(w.parts_before) p;",
    "  update private.story_switches set undone_at = now(), undone_by = actor where id = w.id;",
    "  select count(*) into switch_number from private.story_switches where story_id = target_story and id <= w.id;",
    `  ${history("story_switch", "target_story", "switch_number", "roll_back")}`,
    "  perform set_config('wp.story_switch_kept', kept::text, true);",
    "end",
    "$undo$;",
    ...(dryRun ? summarySql(storyId, c.key_code) : ["commit;"]),
    "",
  ].join("\n");
}

/**
 * A read-only SELECT: every card of the new set published, no other card of the story published,
 * the part titles as in the file, and a switch-over on record. Every row should say ok.
 * @param {ReturnType<typeof readCardExport>} rows
 * @param {string} storyId
 */
export function switchCheckSql(rows, storyId) {
  const story = storyRows(rows, storyId);
  const stage = story.stageZeros[0]?.stage;
  const keys = story.cards.map((card) => `  ('${card.key}')`);
  const parts = story.parts.map((part) => `  (${part.part}, ${quote(part.title)})`);
  return [
    `-- Read only: the switch-over of story ${storyId} of ${rows.companion.id} (#516). Every row should say ok.`,
    "with expected (key) as (values",
    keys.join(",\n"),
    "), new_parts (part, title) as (values",
    parts.join(",\n"),
    "), live as (",
    `  select key from public.story_cards where story_id = '${storyId}' and published`,
    "), stored_parts as (",
    `  select part, title from public.story_parts where story_id = '${storyId}'`,
    ")",
    "select item, result from (",
    "  select x.key as item, case when exists (select 1 from live l where l.key = x.key) then 'ok' else 'not published' end as result",
    "    from expected x",
    "  union all select l.key, 'published, but not in the new set' from live l",
    "    where not exists (select 1 from expected x where x.key = l.key)",
    "  union all select 'part ' || coalesce(x.part, p.part),",
    "    case when p.part is null then 'missing' when x.part is null then 'not in the new set'",
    "      when p.title <> x.title then 'differs from the file' else 'ok' end",
    "    from new_parts x full join stored_parts p on p.part = x.part",
    "  union all select 'switch-over', case when exists (select 1 from private.story_switches",
    `      where story_id = '${storyId}' and undone_at is null) then 'ok' else 'not switched over' end`,
    ...(stage
      ? [
          "  union all select 'stage 0', case",
          `      when ${currentStage("i.stage_zero")} <> ${quote(JSON.stringify(stage))}::jsonb then 'differs from the file'`,
          "      when i.stage_zero_next is not null then 'still waiting in stage_zero_next'",
          "      else 'ok' end",
          `    from public.story_inputs i where i.story_id = '${storyId}'`,
        ]
      : []),
    ") checked",
    "order by 1;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const byAt = args.indexOf("--by");
  const by = byAt === -1 ? undefined : args[byAt + 1];
  const flags = args.filter((arg) => arg.startsWith("--") && arg !== "--by");
  const positional = args.filter(
    (arg, at) => !arg.startsWith("--") && (byAt === -1 || at !== byAt + 1),
  );
  const known = ["--dry-run", "--check", "--undo"];
  const check = flags.includes("--check");
  const usable =
    positional.length === 2 &&
    flags.every((flag) => known.includes(flag)) &&
    new Set(flags).size === flags.length &&
    (check ? flags.length === 1 && by === undefined : typeof by === "string");
  if (!usable) {
    console.error(
      "Usage: node scripts/content/switch-story.mjs <export folder> <story> (--by <admin email> [--dry-run] [--undo] | --check)",
    );
    process.exit(2);
  }
  try {
    const [folder, storyId] = positional;
    const rows = readCardExport(folder);
    const dryRun = flags.includes("--dry-run");
    process.stdout.write(
      check
        ? switchCheckSql(rows, storyId)
        : flags.includes("--undo")
          ? switchUndoSql(rows, storyId, { by, dryRun })
          : switchSql(rows, storyId, { by, dryRun }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
