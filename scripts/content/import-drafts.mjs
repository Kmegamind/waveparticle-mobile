// Turns a Companion's story export (the owner's story-pipeline folder `characters/<id>/export/`)
// into SQL that loads his stories, their parts and their cards as DRAFTS (#502;
// docs/api/story-draft-import.md, docs/decisions/0038). The folder stays outside the repository,
// because its texts must never be committed (the repository is public and the cards may be
// written from a book under copyright). This script reads it when it runs and PRINTS SQL to
// stdout. It writes no file, connects to nothing and never calls a model.
//
//   node scripts/content/import-drafts.mjs <export folder>                 # the SQL
//   node scripts/content/import-drafts.mjs <export folder> --dry-run       # then ROLLBACK
//   node scripts/content/import-drafts.mjs <export folder> --check         # read-only, by md5
//   node scripts/content/import-drafts.mjs <export folder> --undo          # the undo SQL
//   node scripts/content/import-drafts.mjs <export folder> --source-check [--base <ref>] [--extra <file>]...
//        compares 40-character windows of the folder's texts with the text this branch adds
//        and prints only file names and counts (#502 AC4)
//
// The export folder holds app/companion.json, app/parts_and_cards.json, app/stories.json,
// app/stage0/<story>.stage0.json and <id>/periods.json. The Companion must already be in
// src/content/companions.json (his short fields are committed there, with enterHref null), and
// his portrait in public/. Nothing is published:
//   - each card is version 1 with published false (the admin publishes card by card, which writes
//     a Publish history row as today);
//   - each story's goal sentence, "Who I am" and opening are version 1 drafts in content_fields;
//     the story row's columns stay empty ("Not written yet") until an admin publishes them;
//   - key moments are stored unconfirmed (KEY-UNCONFIRMED);
//   - the Companion's enter_href is null, so phones cannot open him.
// The title and the period name go straight into the story row (the admin lists the stories by
// them; phones show only Oppenheimer's stories). The plan page's merged titles are not stored.
// A gap the import would have to invent (an empty line, stage 0 file, key line, period, part
// title, background card or part without cards) stops it before any SQL is printed.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPANIONS_FILE = path.join("src", "content", "companions.json");

/** The goal dialogue's question that every opening ends with (content-files.mjs). */
const OPENING_QUESTION = "What are you working on?";
/** Limits as the migrations and the admin (CARD body 2000; FIELD_LIMITS of content-fields). */
export const LIMITS = { card: 2000, who: 600, goal: 400, opening: 600, title: 120, period: 80 };

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A dollar-quoted SQL text that cannot be closed by the text itself (as in
 * scripts/ai-samples/import-samples.mjs): the first place the closing tag occurs in text + tag
 * must be the closing tag.
 */
export function quote(text) {
  if (text.includes("\0")) throw new Error("a text contains a NUL character");
  let tag = "$draft$";
  for (let n = 1; `${text}${tag}`.indexOf(tag) !== text.length; n += 1) tag = `$draft_${n}$`;
  return `${tag}${text}${tag}`;
}

const md5 = (text) => createHash("md5").update(text, "utf8").digest("hex");
const filled = (value) => typeof value === "string" && value.trim() !== "";
const isRow = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function readJson(folder, file, problems) {
  const full = path.join(folder, file);
  if (!existsSync(full)) {
    problems.push(`no ${file}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch {
    problems.push(`${file} is not valid JSON`);
    return undefined;
  }
}

/** Refuses a folder inside the repository: the texts never enter it. */
function outsideRepository(folder) {
  const resolved = path.resolve(folder);
  if (resolved === REPO || resolved.startsWith(`${REPO}${path.sep}`)) {
    throw new Error("the export folder stays outside the repository (#502)");
  }
  return resolved;
}

/**
 * Reads and checks the export folder. Returns the rows to store, or throws with one line per
 * problem; nothing is printed then.
 * @param {string} folder
 * @param {{ repo?: string }} [options]
 */
export function readDraftExport(folder, { repo = REPO } = {}) {
  const base = outsideRepository(folder);
  const problems = [];
  const exported = readJson(base, path.join("app", "companion.json"), problems);
  const decks = readJson(base, path.join("app", "parts_and_cards.json"), problems);
  const records = readJson(base, path.join("app", "stories.json"), problems);
  if (problems.length > 0) throw new Error(refusal(problems));

  // The Companion: his committed short fields win; the export must agree with them.
  const companions = JSON.parse(readFileSync(path.join(repo, COMPANIONS_FILE), "utf8"));
  const index = companions.findIndex((row) => row.id === exported?.id);
  if (index === -1) {
    throw new Error(
      refusal([`no Companion ${exported?.id} in ${COMPANIONS_FILE}: add his short fields first`]),
    );
  }
  const own = companions[index];
  if (!filled(exported.line))
    problems.push("app/companion.json: line is empty (the Companion line)");
  else if (exported.line !== own.line)
    problems.push(`app/companion.json: line differs from ${COMPANIONS_FILE}`);
  if (!filled(own.line)) problems.push(`${COMPANIONS_FILE}: ${own.id} has no line`);
  if (exported.keyCode !== own.keyCode || decks?.key_code !== own.keyCode) {
    problems.push(
      `keyCode ${exported.keyCode} / ${decks?.key_code} does not match ${own.keyCode} in ${COMPANIONS_FILE}`,
    );
  }
  if (exported.mode !== own.mode)
    problems.push(`mode ${exported.mode} does not match ${COMPANIONS_FILE}`);
  if (own.enterHref !== null) {
    problems.push(
      `${COMPANIONS_FILE}: ${own.id} must keep enterHref null until the owner opens him`,
    );
  }
  if (typeof own.portrait !== "string" || !existsSync(path.join(repo, "public", own.portrait))) {
    problems.push(`the portrait ${own.portrait} is not in public/`);
  }
  const code = own.keyCode;
  const companion = {
    id: own.id,
    position: index + 1,
    name: own.name,
    short_name: own.shortName,
    tags: own.tags,
    line: own.line,
    portrait: own.portrait,
    mode: own.mode,
    key_code: code,
  };

  const periods = readJson(base, path.join(own.id, "periods.json"), problems) ?? [];
  const periodOf = new Map();
  for (const period of Array.isArray(periods) ? periods : []) {
    for (const id of period?.storyIds ?? []) periodOf.set(id, period.name);
  }

  const deckList = Array.isArray(decks?.stories) ? decks.stories : [];
  const recordList = Array.isArray(records) ? records : [];
  const deckIds = new Set(deckList.map((deck) => deck?.id));
  const recordIds = new Set(recordList.map((record) => record?.id));
  for (const id of deckIds)
    if (!recordIds.has(id)) problems.push(`${id}: in parts_and_cards.json but not in stories.json`);
  for (const id of recordIds)
    if (!deckIds.has(id)) problems.push(`${id}: in stories.json but not in parts_and_cards.json`);

  const stories = [];
  const inputs = [];
  const parts = [];
  const cards = [];
  const fields = [];
  const sorted = [...recordList].sort((left, right) => left.sequence - right.sequence);
  for (const record of sorted) {
    const id = record?.id;
    const where = String(id);
    if (typeof id !== "string" || !SAFE_ID.test(id)) {
      problems.push(`${where}: the story id is not a slug`);
      continue;
    }
    if (!Number.isInteger(record.sequence) || record.sequence < 1) problems.push(`${id}: sequence`);
    if (!filled(record.title)) problems.push(`${id}: no title`);
    else if (record.title.length > LIMITS.title)
      problems.push(`${id}: the title is longer than ${LIMITS.title} characters`);
    const period = periodOf.get(id);
    if (!filled(period)) problems.push(`${id}: no period in ${own.id}/periods.json`);
    else if (period.length > LIMITS.period)
      problems.push(`${id}: the period name is longer than ${LIMITS.period} characters`);
    const keySlices = Array.isArray(record.keySlices) ? record.keySlices : [];
    if (keySlices.length === 0) problems.push(`${id}: no key moments (keySlices)`);
    for (const slice of keySlices) {
      if (!filled(slice?.keyLine)) problems.push(`${id}: key moment ${slice?.id} has no keyLine`);
    }

    // Stage 0: the three screen lines become drafts; the rest stays with the model inputs.
    const stageFile = path.join("app", "stage0", `${id}.stage0.json`);
    const stage = existsSync(path.join(base, stageFile))
      ? readJson(base, stageFile, problems)
      : undefined;
    let screen = null;
    if (!isRow(stage)) problems.push(`${id}: no stage 0 file (${stageFile})`);
    else {
      const missing = [];
      if (!filled(stage.who)) missing.push('who ("Who I am")');
      if (!filled(stage.story?.goalShort)) missing.push("story.goalShort (the goal sentence)");
      if (!filled(stage.whereNow?.s1)) missing.push("whereNow.s1 (the opening place)");
      if (missing.length > 0) problems.push(`${id}: stage 0 has no ${missing.join(", ")}`);
      else {
        screen = {
          goal: stage.story.goalShort.trim(),
          who: stage.who.trim(),
          opening: `${stage.whereNow.s1.trim()} ${OPENING_QUESTION}`,
        };
        for (const field of ["goal", "who", "opening"]) {
          if (screen[field].length > LIMITS[field]) {
            problems.push(`${id}: ${field} is longer than ${LIMITS[field]} characters`);
          }
        }
      }
    }

    const deck = deckList.find((entry) => entry?.id === id);
    if (deck) readDeck(deck, id, code, parts, cards, problems);

    if (!screen || !filled(period) || !filled(record.title)) continue;
    stories.push({
      id,
      companion_id: own.id,
      sequence: record.sequence,
      title: record.title,
      period,
    });
    // Each display text is kept once (content-files.mjs): null here, the draft in content_fields.
    const stageZero = structuredClone(stage);
    stageZero.who = null;
    stageZero.story.title = null;
    stageZero.story.goalShort = null;
    stageZero.whereNow.s1 = null;
    inputs.push({
      story_id: id,
      date: typeof record.date === "string" ? record.date : "",
      goal: typeof record.goal === "string" ? record.goal : "",
      facts: JSON.stringify(Array.isArray(record.facts) ? record.facts : []),
      forbidden_terms: JSON.stringify(
        Array.isArray(record.forbiddenTerms) ? record.forbiddenTerms : [],
      ),
      key_moments: JSON.stringify(keySlices.map((slice) => ({ ...slice, confirmed: false }))),
      // Marks the story as kept outside the repository: the content export never writes it back.
      provenance: JSON.stringify({
        ...(isRow(record.provenance) ? record.provenance : {}),
        outsideRepository: true,
      }),
      stage_zero: JSON.stringify(stageZero),
    });
    for (const field of ["goal", "who", "opening"]) {
      fields.push({ key: `${code}.${id}.${field}`, story_id: id, field, body: screen[field] });
    }
  }

  // Periods: each name one run of neighbouring stories (the admin's period rules).
  const runs = [];
  for (const story of stories) if (runs.at(-1) !== story.period) runs.push(story.period);
  const twice = runs.find((name, at) => runs.indexOf(name) !== at);
  if (twice) problems.push(`the period "${twice}" is split by another period`);

  if (problems.length > 0) throw new Error(refusal(problems));
  return { companion, stories, inputs, parts, cards, fields };
}

/** One story's part titles and cards; every part 1 to 5 has a title and at least one card. */
function readDeck(deck, id, code, parts, cards, problems) {
  const numbers = new Set();
  for (const part of Array.isArray(deck.parts) ? deck.parts : []) {
    if (!Number.isInteger(part?.part) || part.part < 1 || part.part > 5) {
      problems.push(`${id}: part ${part?.part} is not 1 to 5`);
      continue;
    }
    if (numbers.has(part.part)) problems.push(`${id}: part ${part.part} appears twice`);
    numbers.add(part.part);
    if (!filled(part.title)) problems.push(`${id}: part ${part.part} has no title`);
    else parts.push({ story_id: id, part: part.part, title: part.title });
  }
  if (numbers.size === 0) problems.push(`${id}: no parts`);
  const list = Array.isArray(deck.cards) ? deck.cards : [];
  const backgrounds = list.filter((card) => card?.kind === "background");
  if (backgrounds.length !== 1) {
    problems.push(
      backgrounds.length === 0
        ? `${id}: no background card`
        : `${id}: more than one background card`,
    );
  }
  const keys = new Set();
  for (const card of list) {
    const expected =
      card?.kind === "background"
        ? `crd.${code}.${id}.bg`
        : `crd.${code}.${id}.p${card?.part}.c${card?.position}`;
    if (card?.kind !== "background" && card?.kind !== "part") {
      problems.push(`${id}: card ${card?.key} has kind ${card?.kind}`);
      continue;
    }
    if (card.kind === "part") {
      if (!numbers.has(card.part))
        problems.push(`${id}: card ${card.key} is in part ${card.part}, which has no title`);
      // SLICE-SUBTASK: a slice is one sub-task, the part: s<part>.
      if (card.slice !== `s${card.part}`)
        problems.push(`${id}: card ${card.key}: slice ${card.slice} is not s${card.part}`);
    } else if (card.part !== null || card.slice !== null || card.position !== 1) {
      problems.push(`${id}: the background card has a part, slice or position`);
    }
    if (!Number.isInteger(card.position) || card.position < 1)
      problems.push(`${id}: card ${card.key}: position`);
    if (card.key !== expected) problems.push(`${id}: card key ${card.key} is not ${expected}`);
    if (keys.has(card.key)) problems.push(`${id}: card key ${card.key} appears twice`);
    keys.add(card.key);
    if (!filled(card.body)) problems.push(`${id}: card ${card.key} is empty`);
    else if (card.body.length > LIMITS.card)
      problems.push(`${id}: card ${card.key} is longer than ${LIMITS.card} characters`);
    else {
      cards.push({
        key: card.key,
        story_id: id,
        kind: card.kind,
        part: card.kind === "part" ? card.part : null,
        slice: card.kind === "part" ? card.slice : null,
        position: card.position,
        body: card.body,
      });
    }
  }
  for (const part of numbers) {
    if (!list.some((card) => card?.kind === "part" && card.part === part))
      problems.push(`${id}: part ${part} has no card`);
  }
}

const refusal = (problems) =>
  `Nothing was printed. Fix these in the export first; the import does not invent them:\n${problems
    .map((problem) => `- ${problem}`)
    .join("\n")}`;

/** Ids, keys, kinds and slices, already checked against their patterns (no quote inside). */
const literal = (value) => {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (!/^[a-z0-9.-]+$/.test(value)) throw new Error(`unsafe value ${value}`);
  return `'${value}'`;
};
const ids = (rows) => rows.map((row) => `'${row.id}'`).join(", ");

/** Stops before any write when the import would overwrite something published or not his. */
function guard(rows) {
  const id = rows.companion.id;
  return [
    "do $guard$",
    "begin",
    `  if exists (select 1 from public.stories where id in (${ids(rows.stories)}) and companion_id <> '${id}') then`,
    "    raise exception 'a story id of this import belongs to another Companion; nothing was written';",
    "  end if;",
    "  if exists (select 1 from public.story_cards c join public.stories s on s.id = c.story_id",
    `    where s.companion_id = '${id}' and (c.published or c.published_at is not null)) then`,
    "    raise exception 'a card of this Companion was published: the import does not run again; edit in the admin';",
    "  end if;",
    `  if exists (select 1 from public.content_fields f where f.companion_id = '${id}' and f.published_at is not null) then`,
    "    raise exception 'a field of this Companion was published: the import does not run again; edit in the admin';",
    "  end if;",
    "end",
    "$guard$;",
  ];
}

/**
 * The SQL, in one transaction. Comments name ids and counts only, never a text. Running it again
 * before anything is published updates the same rows (later versions saved in the admin stay).
 * @param {ReturnType<typeof readDraftExport>} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function importSql(rows, { dryRun = false } = {}) {
  const c = rows.companion;
  const lines = [
    `-- Draft import of ${c.id} (scripts/content/import-drafts.mjs, #502): ${rows.stories.length} stories, ${rows.parts.length} part titles, ${rows.cards.length} cards, ${rows.fields.length} draft fields. Nothing is published.`,
    "-- Holds story text: run it in the SQL editor only; never save it in the repository.",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    "begin;",
    "set local standard_conforming_strings = on;",
    "set constraints all deferred;",
    ...guard(rows),
    "insert into public.companions (id, position, name, short_name, tags, line, portrait, enter_href, mode, key_code)",
    `  values ('${c.id}', ${c.position}, ${quote(c.name)}, ${quote(c.short_name)}, ${quote(c.tags)}, ${quote(c.line)}, ${quote(c.portrait)}, null, '${c.mode}', '${c.key_code}')`,
    "  on conflict (id) do update set line = excluded.line, portrait = excluded.portrait, enter_href = null, mode = excluded.mode, key_code = excluded.key_code, updated_at = now();",
  ];
  for (const story of rows.stories) {
    lines.push(
      "insert into public.stories (id, companion_id, sequence, title, period, goal_short, who, opening)",
      `  values ('${story.id}', '${c.id}', ${story.sequence}, ${quote(story.title)}, ${quote(story.period)}, '', '', '')`,
      "  on conflict (id) do update set sequence = excluded.sequence, title = excluded.title, period = excluded.period, goal_short = '', who = '', opening = '', updated_at = now();",
    );
  }
  for (const row of rows.inputs) {
    lines.push(
      "insert into public.story_inputs (story_id, date, goal, facts, forbidden_terms, key_moments, provenance, stage_zero)",
      `  values ('${row.story_id}', ${quote(row.date)}, ${quote(row.goal)}, ${quote(row.facts)}::json, ${quote(row.forbidden_terms)}::json, ${quote(row.key_moments)}::json, ${quote(row.provenance)}::json, ${quote(row.stage_zero)}::json)`,
      "  on conflict (story_id) do update set date = excluded.date, goal = excluded.goal, facts = excluded.facts, forbidden_terms = excluded.forbidden_terms, key_moments = excluded.key_moments, provenance = excluded.provenance, stage_zero = excluded.stage_zero, updated_at = now();",
    );
  }
  for (const part of rows.parts) {
    lines.push(
      "insert into public.story_parts (story_id, part, title)",
      `  values ('${part.story_id}', ${part.part}, ${quote(part.title)})`,
      "  on conflict (story_id, part) do update set title = excluded.title;",
    );
  }
  for (const card of rows.cards) {
    const values = [card.key, 1, card.story_id, card.kind, card.part, card.slice, card.position]
      .map(literal)
      .join(", ");
    lines.push(
      "insert into public.story_cards (key, version, story_id, kind, part, slice, position, body, published, published_at, created_by)",
      `  values (${values}, ${quote(card.body)}, false, null, null)`,
      "  on conflict (key, version) do update set story_id = excluded.story_id, kind = excluded.kind, part = excluded.part, slice = excluded.slice, position = excluded.position, body = excluded.body;",
    );
  }
  for (const field of rows.fields) {
    lines.push(
      "insert into public.content_fields (key, version, companion_id, story_id, field, body, published, published_at, created_by)",
      `  values ('${field.key}', 1, '${c.id}', '${field.story_id}', '${field.field}', ${quote(field.body)}, false, null, null)`,
      "  on conflict (key, version) do update set body = excluded.body;",
    );
  }
  if (dryRun) {
    lines.push(
      "select",
      `  (select count(*) from public.stories where companion_id = '${c.id}') as stories,`,
      `  (select count(*) from public.story_parts p join public.stories s on s.id = p.story_id where s.companion_id = '${c.id}') as part_titles,`,
      `  (select count(*) from public.story_cards k join public.stories s on s.id = k.story_id where s.companion_id = '${c.id}') as cards,`,
      `  (select count(*) from public.story_cards k join public.stories s on s.id = k.story_id where s.companion_id = '${c.id}' and k.published) as published_cards,`,
      `  (select count(*) from public.content_fields where companion_id = '${c.id}' and not published) as draft_fields,`,
      `  (select enter_href from public.companions where id = '${c.id}') as enter_href;`,
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/** The md5 of each stored item, built the same way as the check query builds it in Postgres. */
const digests = {
  companion: (c) => md5([c.line, c.portrait, "null", c.mode, c.key_code].join("|")),
  story: (s, companionId) => md5([companionId, String(s.sequence), s.title, s.period].join("|")),
  inputs: (i) =>
    md5(
      [i.date, i.goal, i.facts, i.forbidden_terms, i.key_moments, i.provenance, i.stage_zero].join(
        "|",
      ),
    ),
  part: (p) => md5(p.title),
  card: (k) =>
    md5(
      [
        k.story_id,
        k.kind,
        k.part === null ? "" : String(k.part),
        k.slice ?? "",
        String(k.position),
        k.body,
        "draft",
      ].join("|"),
    ),
  field: (f) => md5(f.body),
};

/**
 * A read-only SELECT: one row per stored item (the Companion, each story, its inputs, each part
 * title, each card's version 1 and each draft field) saying ok, missing or differs. Only ids and
 * md5 sums are printed, never a text. A card that was published says "differs".
 * @param {ReturnType<typeof readDraftExport>} rows
 */
export function checkSql(rows) {
  const c = rows.companion;
  const expected = [
    `('companion', '${c.id}', '${digests.companion(c)}')`,
    ...rows.stories.map((s) => `('story', '${s.id}', '${digests.story(s, c.id)}')`),
    ...rows.inputs.map((i) => `('inputs', '${i.story_id}', '${digests.inputs(i)}')`),
    ...rows.parts.map((p) => `('part', '${p.story_id}.p${p.part}', '${digests.part(p)}')`),
    ...rows.cards.map((k) => `('card', '${k.key}', '${digests.card(k)}')`),
    ...rows.fields.map((f) => `('field', '${f.key}', '${digests.field(f)}')`),
  ];
  return [
    `-- Read only: compares the draft import of ${c.id} with the export folder (#502). Every row should say ok.`,
    "with expected (kind, item, digest) as (values",
    expected.map((row) => `  ${row}`).join(",\n"),
    ")",
    "select x.kind, x.item,",
    "  case when a.digest is null then 'missing' when a.digest <> x.digest then 'differs from the file' else 'ok' end as result",
    "from expected x",
    "left join lateral (",
    "  select md5(concat_ws('|', co.line, co.portrait, coalesce(co.enter_href, 'null'), co.mode, co.key_code)) as digest",
    "    from public.companions co where x.kind = 'companion' and co.id = x.item",
    "  union all",
    "  select md5(concat_ws('|', s.companion_id, s.sequence::text, s.title, s.period))",
    "    from public.stories s where x.kind = 'story' and s.id = x.item",
    "  union all",
    "  select md5(concat_ws('|', i.date, i.goal, i.facts::text, i.forbidden_terms::text, i.key_moments::text, i.provenance::text, i.stage_zero::text))",
    "    from public.story_inputs i where x.kind = 'inputs' and i.story_id = x.item",
    "  union all",
    "  select md5(p.title) from public.story_parts p where x.kind = 'part' and p.story_id || '.p' || p.part = x.item",
    "  union all",
    "  select md5(concat_ws('|', k.story_id, k.kind, coalesce(k.part::text, ''), coalesce(k.slice, ''), k.position::text, k.body,",
    "      case when k.published or k.published_at is not null then 'published' else 'draft' end))",
    "    from public.story_cards k where x.kind = 'card' and k.key = x.item and k.version = 1",
    "  union all",
    "  select md5(f.body) from public.content_fields f where x.kind = 'field' and f.key = x.item and f.version = 1",
    ") a on true",
    "order by x.kind, x.item;",
    "",
  ].join("\n");
}

/**
 * The undo: removes the Companion's imported stories (their inputs, parts, cards and fields go
 * with them) and his Companion row. It stops with an error, and removes nothing, when a card or a
 * field of his was ever published.
 * @param {ReturnType<typeof readDraftExport>} rows
 */
export function undoSql(rows) {
  const id = rows.companion.id;
  return [
    `-- Undo of the draft import of ${id} (scripts/content/import-drafts.mjs, #502).`,
    "begin;",
    "do $guard$",
    "begin",
    "  if exists (select 1 from public.story_cards c join public.stories s on s.id = c.story_id",
    `    where s.companion_id = '${id}' and (c.published or c.published_at is not null))`,
    `    or exists (select 1 from public.content_fields f where f.companion_id = '${id}' and (f.published or f.published_at is not null)) then`,
    "    raise exception 'something of this Companion was published; the undo removes nothing';",
    "  end if;",
    "end",
    "$guard$;",
    `delete from public.stories where companion_id = '${id}' and id in (${ids(rows.stories)});`,
    `delete from public.companions where id = '${id}' and not exists (select 1 from public.stories where companion_id = '${id}');`,
    "commit;",
    "",
  ].join("\n");
}

// ---- #502 AC4: no text of the export in the changed files --------------------------------------

const WINDOW = 40;
const normal = (text) => text.replace(/\s+/g, " ");

/**
 * The names of the files that hold any 40-character window of the source texts, spacing ignored.
 * A window inside an allowed text (the Companion's committed short fields) does not count.
 * @param {string[]} sources
 * @param {Record<string, string>} files
 * @param {string[]} [allowed]
 * @returns {string[]}
 */
export function sourceTextMatches(sources, files, allowed = []) {
  const allow = allowed.map(normal);
  const windows = new Set();
  for (const source of sources) {
    const text = normal(source);
    for (let at = 0; at + WINDOW <= text.length; at += 1) {
      const window = text.slice(at, at + WINDOW);
      if (!allow.some((entry) => entry.includes(window))) windows.add(window);
    }
  }
  const found = [];
  for (const [name, content] of Object.entries(files)) {
    const text = normal(content);
    for (let at = 0; at + WINDOW <= text.length; at += 1) {
      if (windows.has(text.slice(at, at + WINDOW))) {
        found.push(name);
        break;
      }
    }
  }
  return found.sort();
}

/** Every text of the export folder: the string values of its JSON files and its other text files. */
function exportTexts(folder) {
  const texts = [];
  const strings = (value) => {
    if (typeof value === "string") texts.push(value);
    else if (Array.isArray(value)) value.forEach(strings);
    else if (isRow(value)) Object.values(value).forEach(strings);
  };
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".json")) strings(JSON.parse(readFileSync(full, "utf8")));
      else if (/\.(md|txt)$/.test(name)) texts.push(readFileSync(full, "utf8"));
    }
  };
  walk(folder);
  return texts;
}

function sourceCheck(folder, base, extras) {
  const resolved = outsideRepository(folder);
  const git = (...args) =>
    spawnSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 }).stdout;
  const lines = (text) => text.split("\n").filter(Boolean);
  // What this branch adds: the added lines of each changed tracked file, and every new file.
  // Lines already on the base branch are not this change's text.
  const files = {};
  for (const file of lines(git("diff", "--name-only", "--diff-filter=AM", base))) {
    files[file] = lines(git("diff", "-U0", "--no-color", base, "--", file))
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1))
      .join("\n");
  }
  for (const file of lines(git("ls-files", "--others", "--exclude-standard"))) {
    const full = path.join(REPO, file);
    if (existsSync(full)) files[file] = readFileSync(full, "utf8");
  }
  for (const extra of extras) files[extra] = readFileSync(extra, "utf8");
  const exported = JSON.parse(readFileSync(path.join(resolved, "app", "companion.json"), "utf8"));
  const allowed = ["name", "shortName", "tags", "line"].map((key) => exported[key]).filter(filled);
  const found = sourceTextMatches(exportTexts(resolved), files, allowed);
  console.log(
    `Compared ${Object.keys(files).length} changed files with the export: ${found.length} with a match.`,
  );
  for (const name of found) console.log(`- ${name}`);
  return found.length === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const valueOf = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 ? undefined : args[at + 1];
  };
  const extras = args.flatMap((arg, at) => (arg === "--extra" ? [args[at + 1]] : []));
  const valued = new Set(
    args.flatMap((arg, at) => (arg === "--extra" || arg === "--base" ? [at + 1] : [])),
  );
  const flags = args.filter((arg) => arg.startsWith("--") && arg !== "--extra" && arg !== "--base");
  const folders = args.filter((arg, at) => !arg.startsWith("--") && !valued.has(at));
  const known = ["--dry-run", "--check", "--undo", "--source-check"];
  if (flags.some((flag) => !known.includes(flag)) || flags.length > 1 || folders.length !== 1) {
    console.error(
      "Usage: node scripts/content/import-drafts.mjs <export folder> [--dry-run | --check | --undo | --source-check [--base <ref>] [--extra <file>]...]",
    );
    process.exit(2);
  }
  try {
    if (flags[0] === "--source-check") {
      process.exit(sourceCheck(folders[0], valueOf("--base") ?? "origin/main", extras) ? 0 : 1);
    }
    const rows = readDraftExport(folders[0]);
    process.stdout.write(
      flags[0] === "--check"
        ? checkSql(rows)
        : flags[0] === "--undo"
          ? undoSql(rows)
          : importSql(rows, { dryRun: flags[0] === "--dry-run" }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
