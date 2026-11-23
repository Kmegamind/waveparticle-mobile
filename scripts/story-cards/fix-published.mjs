// The data fix of #377: publishes the seed text of every story card whose published text differs
// from src/content/<companion>/story-decks.json. Version 1 of every card was loaded as published
// without the card checks (#293); #375 fixed the failing cards in the seed file only, and the
// import (import.mjs) leaves cards that already have rows alone. It prints SQL and connects to
// nothing: paste it into the Supabase SQL editor, or pipe it to psql.
//
//   node scripts/story-cards/fix-published.mjs --by you@example.com > story-cards-fix.sql  (the fix)
//   node scripts/story-cards/fix-published.mjs --by you@example.com --dry-run > story-cards-dry-run.sql
//   node scripts/story-cards/fix-published.mjs --check > story-cards-check.sql            (read only)
//   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f story-cards-fix.sql
//
// For each card of the seed, in one transaction:
// - its published text is already the seed text: nothing changes (so a second run changes nothing);
// - it has only version 1, published, with other text: the seed text is added as version 2 and
//   published through private.set_published_story_card, the function behind the admin's Publish,
//   which writes the Publish history row;
// - it has more than one version (it was edited in the admin after the import), no published
//   version, or no row: it is left alone and reported, never overwritten.
// `--by` names the admin account the fix publishes as: Publish history shows that account, as if it
// had pressed Publish. The account must have the admin role, or nothing changes.
// The report is printed after the commit. `--dry-run` runs the same SQL and prints the same report,
// then stops with "Dry run: nothing was changed." and undoes everything. `--check` prints a query that only reads: what the fix
// would do to each card now, and afterwards whether every card carries the seed text.

import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  quote,
  readCompanionKeyCode,
  readStoryDecks,
  readStoryIds,
  storyCardRows,
} from "./import.mjs";

const DEFAULT_COMPANION = "oppenheimer";

/** The seed's cards as SQL rows `('<key>', '<text>')`, one per line. */
function seedValues(rows) {
  return rows.cards.map((card) => `  (${quote(card.key)}, ${quote(card.body)})`).join(",\n");
}

/** An email address as the sign-in stores it; nothing else goes into the SQL. */
const EMAIL = /^[^\s@'$\\]+@[^\s@'$\\]+\.[^\s@'$\\]+$/;

/**
 * The fix: one transaction that publishes the seed text of each card whose published text
 * differs, as the admin account `by`, then the report.
 * @param {{ cards: { key: string, body: string }[] }} rows
 * With `dryRun`, the same work runs, the report is shown, and the run stops and undoes everything:
 * a rehearsal on the real database that changes nothing.
 * @param {{ by: string, companionId?: string, dryRun?: boolean }} options
 */
export function fixPublishedSql(rows, { by, companionId = DEFAULT_COMPANION, dryRun = false }) {
  if (typeof by !== "string" || !EMAIL.test(by)) {
    throw new Error("--by needs the email address of an admin account");
  }
  return `-- Story card fix from src/content/${companionId}/story-decks.json (scripts/story-cards/fix-published.mjs, #377).
-- Publishes the seed text of every card whose published text differs from it, through the admin's
-- Publish function, with a Publish history row. Cards edited in the admin are reported, not changed.
begin;
set local standard_conforming_strings = on;

do $guard$
begin
  if to_regprocedure('private.set_published_story_card(text, integer, text)') is null then
    raise exception 'Run supabase/migrations/20261123000000_story_card_editing.sql first: private.set_published_story_card is missing.';
  end if;
end
$guard$;

-- Publish as the admin account ${by}, so Publish history names it (auth.uid() reads this setting).
do $who$
declare
  admin_id uuid;
begin
  select u.id into admin_id
  from auth.users u
  join public.content_roles r on r.user_id = u.id and r.role = 'admin'
  where lower(u.email) = lower(${quote(by)});
  if admin_id is null then
    raise exception 'No admin account with the email %. Give it the admin role first (docs/deploy.md, Admin roles).', ${quote(by)};
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id::text)::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
end
$who$;

drop table if exists pg_temp.story_card_seed;
create temporary table story_card_seed (key text primary key, body text not null);
drop table if exists pg_temp.story_card_fix_report;
create temporary table story_card_fix_report (
  key text primary key,
  outcome text not null,
  detail text not null
);

insert into story_card_seed (key, body) values
${seedValues(rows)};

do $fix$
declare
  seed record;
  live public.story_cards%rowtype;
  version_count integer;
  newest integer;
  next_version integer;
begin
  for seed in select s.key, s.body from story_card_seed s order by s.key loop
    -- Locks the card's rows, as the admin's Publish does.
    perform 1 from public.story_cards c where c.key = seed.key for update;
    select count(*), max(c.version) into version_count, newest
    from public.story_cards c
    where c.key = seed.key;
    if version_count = 0 then
      insert into story_card_fix_report (key, outcome, detail)
      values (seed.key, 'skipped: not in the database', 'Run scripts/story-cards/import.mjs first.');
      continue;
    end if;
    select * into live from public.story_cards c where c.key = seed.key and c.published;
    if not found then
      insert into story_card_fix_report (key, outcome, detail)
      values (seed.key, 'skipped: no published version', format('%s versions, none published', version_count));
      continue;
    end if;
    if live.body = seed.body then
      continue;
    end if;
    if version_count > 1 or live.version <> 1 then
      insert into story_card_fix_report (key, outcome, detail)
      values (seed.key, 'skipped: edited in the admin', format('published v%s of %s versions', live.version, version_count));
      continue;
    end if;
    next_version := newest + 1;
    insert into public.story_cards (
      key, version, story_id, kind, part, slice, position, body, created_by
    )
    values (
      live.key, next_version, live.story_id, live.kind, live.part, live.slice, live.position,
      seed.body, auth.uid()
    );
    perform private.set_published_story_card(seed.key, next_version, 'publish');
    insert into story_card_fix_report (key, outcome, detail)
    values (seed.key, 'published: the seed text', format('v%s', next_version));
  end loop;
end
$fix$;

${dryRun ? DRY_RUN_END : FIX_END}`;
}

const FIX_END = `commit;

select key, outcome, detail from story_card_fix_report
order by outcome, key;
`;

// The dry run reads the report inside the transaction, then stops with an error whose message is
// the report, so the SQL editor shows it too, and every change is undone.
const DRY_RUN_END = `select key, outcome, detail from story_card_fix_report
order by outcome, key;

do $dry$
declare
  summary text;
begin
  select coalesce(string_agg(r.key || ': ' || r.outcome || ' (' || r.detail || ')', E'\\n' order by r.outcome, r.key), 'no card to publish and none skipped')
  into summary
  from story_card_fix_report r;
  raise exception 'Dry run: nothing was changed. %', E'\\n' || summary;
end
$dry$;

rollback;
`;

/**
 * A query that only reads: for each card of the seed, what the fix does (before it runs) or
 * whether it is done (after it ran).
 * @param {{ cards: { key: string, body: string }[] }} rows
 * @param {string} [companionId]
 */
export function fixPublishedCheckSql(rows, { companionId = DEFAULT_COMPANION } = {}) {
  return `-- Story card check against src/content/${companionId}/story-decks.json (scripts/story-cards/fix-published.mjs --check, #377).
-- Reads only. Each card: "done" when its published text is the seed text; "to publish" when the fix
-- would publish the seed text; "skipped" when the fix leaves it alone.
set standard_conforming_strings = on;
with seed(key, body) as (
  values
${seedValues(rows)}
),
versions as (
  select c.key, count(*) as version_count, max(c.version) as newest
  from public.story_cards c
  join seed s on s.key = c.key
  group by c.key
)
select
  s.key,
  case
    when v.key is null then 'skipped: not in the database'
    when p.key is null then 'skipped: no published version'
    when p.body = s.body then 'done: the seed text is published'
    when v.version_count > 1 or p.version <> 1 then 'skipped: edited in the admin'
    else 'to publish: the seed text as v' || (v.newest + 1)
  end as outcome,
  p.body as published_now
from seed s
left join versions v on v.key = s.key
left join public.story_cards p on p.key = s.key and p.published
order by outcome, s.key;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const dryRun = args.includes("--dry-run");
  const byAt = args.indexOf("--by");
  const by = byAt >= 0 ? args[byAt + 1] : undefined;
  const rest = args.filter(
    (arg, index) =>
      arg !== "--check" && arg !== "--dry-run" && index !== byAt && index !== byAt + 1,
  );
  const companionId = rest[0] ?? DEFAULT_COMPANION;
  const usage =
    "Usage: node scripts/story-cards/fix-published.mjs --by <admin email> [--dry-run] [companion-id]\n" +
    "       node scripts/story-cards/fix-published.mjs --check [companion-id]";
  if (rest.length > 1 || !/^[a-z][a-z0-9-]*$/.test(companionId) || (!check && !by)) {
    console.error(usage);
    process.exit(1);
  }
  const contentDirectory = new URL("../../src/content/", import.meta.url);
  const rows = storyCardRows(
    readStoryDecks(new URL(`${companionId}/story-decks.json`, contentDirectory)),
    readStoryIds(new URL(`${companionId}/stories.json`, contentDirectory)),
    readCompanionKeyCode(companionId),
  );
  process.stdout.write(
    check
      ? fixPublishedCheckSql(rows, { companionId })
      : fixPublishedSql(rows, { by, companionId, dryRun }),
  );
}
