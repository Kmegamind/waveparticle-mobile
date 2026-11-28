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
//   node scripts/content/import-drafts.mjs <export folder> --keep-published [--dry-run | --check | --undo]
//        #516: the cards of a Companion who already has published cards (Oppenheimer's
//        regenerated decks), as drafts next to them; see "Keep published" below
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
// Run again with a changed export (before anything is published), the run brings the database to
// the export: this Companion's stories, part titles and cards the export no longer has are
// removed. The dry run lists what the run adds, changes and removes; the check compares both
// ways; the undo removes every story of this Companion and keeps his Companion row (#514 review).
//
// Keep published (#516). The default run refuses a Companion with anything published. With
// --keep-published the export may hold only app/companion.json and app/parts_and_cards.json, the
// stories must already be his in the database, and every published row stays exactly as it is:
//   - a key in both sets gets the file's text as a new draft version (the history is kept);
//   - a new key (a seventh card, a fifth part) is added as a draft, version 1;
//   - an old key the file does not have stays published until that story's switch-over
//     (scripts/content/switch-story.mjs), which also sets the part titles to the new count;
//   - no Companion, story, part title or field row is written;
//   - #526: when the export has app/stage0/<story>.stage0.json files (then for every story), each
//     story's new slices, steps and scene wait in story_inputs.stage_zero_next for its switch-over
//     (migration 20261209000000). stage_zero, which phones read, is not touched; a story already
//     switched over is left alone; the undo clears them. Without stage 0 files, no input row is
//     written, as before.
// The import's own drafts are the versions no editor wrote (created_by null) and nobody ever
// published, above the key's last published version. A run writes them again with the file's
// text and removes those of keys the file no longer has; a key whose newest version already holds
// the file's text is left alone, so running it twice changes nothing. A key whose newest version
// is an editor's unpublished draft (created_by set: saved in the admin, before or after an earlier
// run) is left alone too and reported as "kept: editor draft", so the switch-over publishes the
// editor's text (#522 review). The undo removes only the import's drafts, refuses stories that
// are not this Companion's, and waits until any switch-over of these stories was undone. Every
// dry run stops with its report as an error, because the SQL editor shows only the last result.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
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

/** A file system object's identity: the same folder by any path, link or letter case. */
const identity = (file) => {
  const stat = statSync(file);
  return `${stat.dev}:${stat.ino}`;
};

/**
 * The repository's working folders: this checkout, and the main checkout when this one is a
 * git worktree (both hold tracked files).
 */
function repositoryRoots() {
  const roots = [REPO];
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: REPO,
    encoding: "utf8",
  });
  if (common.status === 0 && common.stdout.trim()) roots.push(path.dirname(common.stdout.trim()));
  return roots.filter((root) => existsSync(root));
}

/**
 * Refuses a folder inside the repository: the texts never enter it. The folder's real path (links
 * followed) is walked up to the root, and each folder on the way is compared with the repository
 * roots by device and inode, so a symbolic link, a different letter case on a case-insensitive
 * disk or the main checkout seen from a worktree cannot slip past.
 */
export function outsideRepository(folder) {
  let real;
  try {
    real = realpathSync.native(path.resolve(folder));
  } catch {
    throw new Error(`no folder ${folder}`);
  }
  const roots = new Set(repositoryRoots().map(identity));
  for (let at = real; ; at = path.dirname(at)) {
    if (roots.has(identity(at))) {
      throw new Error("the export folder stays outside the repository (#502)");
    }
    if (path.dirname(at) === at) break;
  }
  return real;
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
  if (problems.length > 0) {
    if (decks !== undefined && records === undefined) {
      problems.push(
        "an export of cards only: for a Companion who already has published cards, run it with --keep-published (#516)",
      );
    }
    throw new Error(refusal(problems));
  }

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
  if (exported.name !== own.name)
    problems.push(`app/companion.json: name differs from ${COMPANIONS_FILE}`);
  // #485: every model call names the Companion; a blank name stops the import.
  if (!filled(own.name)) problems.push(`${COMPANIONS_FILE}: ${own.id} has no name`);
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

/** The longest part title the admin saves (PART_TITLE_MAX_LENGTH, src/lib/story-cards/write.ts). */
const PART_TITLE_LIMIT = 200;

/**
 * #516: reads a cards-only export (app/companion.json and app/parts_and_cards.json) for the
 * --keep-published mode. The Companion must be in companions.json with the same id, name, mode
 * and key code; his line, tags and portrait are not compared, because this mode writes no
 * Companion row. merged_titles, when present, must be a list; it is not stored (no merged-title
 * step exists yet). Throws with one line per problem; nothing is printed then.
 * @param {string} folder
 * @param {{ repo?: string }} [options]
 */
export function readCardExport(folder, { repo = REPO } = {}) {
  const base = outsideRepository(folder);
  const problems = [];
  const exported = readJson(base, path.join("app", "companion.json"), problems);
  const decks = readJson(base, path.join("app", "parts_and_cards.json"), problems);
  if (problems.length > 0) throw new Error(refusal(problems));
  const companions = JSON.parse(readFileSync(path.join(repo, COMPANIONS_FILE), "utf8"));
  const own = companions.find((row) => row.id === exported?.id);
  if (!own) throw new Error(refusal([`no Companion ${exported?.id} in ${COMPANIONS_FILE}`]));
  if (exported.keyCode !== own.keyCode || decks?.key_code !== own.keyCode) {
    problems.push(
      `keyCode ${exported.keyCode} / ${decks?.key_code} does not match ${own.keyCode} in ${COMPANIONS_FILE}`,
    );
  }
  if (exported.name !== own.name)
    problems.push(`app/companion.json: name differs from ${COMPANIONS_FILE}`);
  if (exported.mode !== own.mode)
    problems.push(`mode ${exported.mode} does not match ${COMPANIONS_FILE}`);
  const deckList = Array.isArray(decks?.stories) ? decks.stories : [];
  if (deckList.length === 0) problems.push("app/parts_and_cards.json: no stories");
  const stories = [];
  const parts = [];
  const cards = [];
  for (const deck of deckList) {
    const id = deck?.id;
    if (typeof id !== "string" || !SAFE_ID.test(id)) {
      problems.push(`${String(id)}: the story id is not a slug`);
      continue;
    }
    if (stories.some((story) => story.id === id)) problems.push(`${id}: the story appears twice`);
    if (deck.merged_titles !== undefined && !Array.isArray(deck.merged_titles)) {
      problems.push(`${id}: merged_titles is not a list`);
    }
    readDeck(deck, id, own.keyCode, parts, cards, problems);
    stories.push({ id });
  }
  // #526: each story's new stage 0 (slices, steps, scene), when the export has a stage 0 folder.
  // Either every story of the export has its file or none has (a cards-only export of #516).
  const stageZeros = [];
  const withStage = stories.filter((story) =>
    existsSync(path.join(base, "app", "stage0", `${story.id}.stage0.json`)),
  );
  if (withStage.length > 0) {
    for (const story of stories) {
      const stage = readStageZeroUpdate(base, story.id, cards, parts, problems);
      if (stage) stageZeros.push({ story_id: story.id, stage });
    }
  }
  for (const part of parts) {
    if (part.title.length > PART_TITLE_LIMIT) {
      problems.push(
        `${part.story_id}: the title of part ${part.part} is longer than ${PART_TITLE_LIMIT} characters`,
      );
    }
  }
  if (problems.length > 0) throw new Error(refusal(problems));
  return { companion: { id: own.id, key_code: own.keyCode }, stories, parts, cards, stageZeros };
}

/** The stage 0 values a switch-over replaces (#526); every other key of stage_zero stays. */
export const STAGE_ZERO_KEYS = ["slices", "steps", "scene"];

/**
 * #526: the slices, steps and scene of one story's export stage 0 file
 * (app/stage0/<story>.stage0.json), or undefined with a problem. Nothing is filled in: a missing
 * or malformed value stops the script. The display texts in the file (who, story.goalShort,
 * whereNow.s1) are not read: content_fields holds them. Every part card's slice must be one of
 * the file's slices, and every step's covers must name its slices (SLICE-SUBTASK; the mapping is
 * the file's, not the script's).
 */
function readStageZeroUpdate(base, id, cards, parts, problems) {
  const file = path.join("app", "stage0", `${id}.stage0.json`);
  if (!existsSync(path.join(base, file))) {
    problems.push(`${id}: no stage 0 file (${file}); the other stories have one`);
    return undefined;
  }
  const stage = readJson(base, file, problems);
  if (stage === undefined) return undefined;
  const before = problems.length;
  if (!isRow(stage)) {
    problems.push(`${file}: not an object`);
    return undefined;
  }
  const slices = Array.isArray(stage.slices) ? stage.slices : [];
  const ids = new Set();
  if (slices.length === 0) problems.push(`${file}: no slices`);
  for (const slice of slices) {
    if (!isRow(slice) || !filled(slice.id)) problems.push(`${file}: a slice has no id`);
    else if (ids.has(slice.id)) problems.push(`${file}: slice ${slice.id} appears twice`);
    else ids.add(slice.id);
  }
  const steps = Array.isArray(stage.steps) ? stage.steps : [];
  if (steps.length === 0) problems.push(`${file}: no steps`);
  for (const step of steps) {
    const covers = isRow(step) && Array.isArray(step.covers) ? step.covers : null;
    if (!covers || covers.length === 0) {
      problems.push(`${file}: step ${isRow(step) ? step.n : "?"} covers no slice`);
      continue;
    }
    for (const slice of covers) {
      if (!ids.has(slice)) problems.push(`${file}: step ${step.n} covers ${slice}, not a slice`);
    }
  }
  if (!isRow(stage.scene)) problems.push(`${file}: no scene object`);
  for (const card of cards) {
    if (card.story_id === id && card.kind === "part" && !ids.has(card.slice)) {
      problems.push(
        `${id}: card ${card.key} is in slice ${card.slice}, which ${file} does not have`,
      );
    }
  }
  // #533 review M6: the steps match the deck's parts: one step per part, numbered as the parts,
  // and step n covers every slice the cards of part n sit in. Nothing is moved to make them match.
  const partNumbers = [...new Set(parts.filter((p) => p.story_id === id).map((p) => p.part))].sort(
    (a, b) => a - b,
  );
  const stepNumbers = steps.map((step) => (isRow(step) ? step.n : undefined));
  if (stepNumbers.join(",") !== partNumbers.join(",")) {
    problems.push(
      `${id}: the steps of ${file} (${stepNumbers.join(", ")}) do not match the parts of parts_and_cards.json (${partNumbers.join(", ")})`,
    );
  } else {
    for (const step of steps) {
      const covers = new Set(Array.isArray(step.covers) ? step.covers : []);
      const missing = [
        ...new Set(
          cards
            .filter((card) => card.story_id === id && card.kind === "part" && card.part === step.n)
            .map((card) => card.slice),
        ),
      ].filter((slice) => !covers.has(slice));
      if (missing.length > 0) {
        problems.push(
          `${id}: step ${step.n} of ${file} does not cover ${missing.join(", ")}, the slice of part ${step.n}'s cards`,
        );
      }
    }
  }
  if (problems.length > before) return undefined;
  return { slices: stage.slices, steps: stage.steps, scene: stage.scene };
}

/** Ids, keys, kinds and slices, already checked against their patterns (no quote inside). */
const literal = (value) => {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (!/^[a-z0-9.-]+$/.test(value)) throw new Error(`unsafe value ${value}`);
  return `'${value}'`;
};
const ids = (rows) => rows.map((row) => `'${row.id}'`).join(", ");

/** A published card or field of this Companion (any version, ever published). */
const publishedCondition = (id) => [
  "exists (select 1 from public.story_cards c join public.stories s on s.id = c.story_id",
  `    where s.companion_id = '${id}' and (c.published or c.published_at is not null))`,
  `    or exists (select 1 from public.content_fields f where f.companion_id = '${id}' and (f.published or f.published_at is not null))`,
];

/** Stops before any write when the import would overwrite something published or not his. */
function guard(rows) {
  const id = rows.companion.id;
  return [
    "do $guard$",
    "begin",
    `  if exists (select 1 from public.stories where id in (${ids(rows.stories)}) and companion_id <> '${id}') then`,
    "    raise exception 'a story id of this import belongs to another Companion; nothing was written';",
    "  end if;",
    `  if ${publishedCondition(id).join("\n")} then`,
    "    raise exception 'a card or field of this Companion was published: the import does not run again; edit in the admin';",
    "  end if;",
    "end",
    "$guard$;",
  ];
}

/**
 * Every row of this Companion that the import writes, as (kind, item, digest), read from the
 * database: his Companion row, his stories, their inputs, part titles, cards (version 1) and the
 * three draft fields per story (version 1). Built the same way as `digests` below.
 * @param {string} id
 */
function currentRowsSql(id) {
  const own = `join public.stories s on s.id = %.story_id where s.companion_id = '${id}'`;
  return [
    "  select 'companion'::text as kind, co.id as item,",
    "      md5(concat_ws('|', co.name, co.short_name, co.tags, co.line, co.portrait, coalesce(co.enter_href, 'null'), co.mode, co.key_code)) as digest",
    `    from public.companions co where co.id = '${id}'`,
    "  union all",
    "  select 'story', s.id, md5(concat_ws('|', s.companion_id, s.sequence::text, s.title, s.period, s.goal_short, s.who, s.opening))",
    `    from public.stories s where s.companion_id = '${id}'`,
    "  union all",
    "  select 'inputs', i.story_id, md5(concat_ws('|', i.date, i.goal, i.facts::text, i.forbidden_terms::text, i.key_moments::text, i.provenance::text, i.stage_zero::text))",
    `    from public.story_inputs i ${own.replace("%", "i")}`,
    "  union all",
    "  select 'part', p.story_id || '.p' || p.part, md5(p.title)",
    `    from public.story_parts p ${own.replace("%", "p")}`,
    "  union all",
    "  select 'card', k.key, md5(concat_ws('|', k.story_id, k.kind, coalesce(k.part::text, ''), coalesce(k.slice, ''), k.position::text, k.body,",
    "      case when k.published or k.published_at is not null then 'published' else 'draft' end))",
    `    from public.story_cards k ${own.replace("%", "k")} and k.version = 1`,
    "  union all",
    "  select 'field', f.key, md5(concat_ws('|', f.story_id, f.field, f.body,",
    "      case when f.published or f.published_at is not null then 'published' else 'draft' end))",
    `    from public.content_fields f where f.companion_id = '${id}' and f.version = 1`,
    "      and f.story_id is not null and f.field in ('goal', 'who', 'opening')",
  ];
}

/**
 * The SQL, in one transaction. Comments name ids and counts only, never a text. Run again before
 * anything is published, it brings the database to the export: rows the export no longer has
 * (stories, part titles, cards of this Companion only) are removed, the others written again.
 * Later versions saved in the admin stay for the cards still in the export. The dry run lists,
 * per kind, how many rows the run adds, changes and removes, then rolls back.
 * @param {ReturnType<typeof readDraftExport>} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function importSql(rows, { dryRun = false } = {}) {
  const c = rows.companion;
  const partItems = rows.parts.map((part) => `'${part.story_id}.p${part.part}'`).join(", ");
  const cardKeys = rows.cards.map((card) => literal(card.key)).join(", ");
  const lines = [
    `-- Draft import of ${c.id} (scripts/content/import-drafts.mjs, #502): ${rows.stories.length} stories, ${rows.parts.length} part titles, ${rows.cards.length} cards, ${rows.fields.length} draft fields. Nothing is published.`,
    "-- Holds story text: run it in the SQL editor only; never save it in the repository.",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    "begin;",
    "set local standard_conforming_strings = on;",
    "set constraints all deferred;",
    ...guard(rows),
    ...(dryRun
      ? [
          "create temporary table draft_import_before on commit drop as",
          ...currentRowsSql(c.id),
          ";",
        ]
      : []),
    "-- What the export no longer has: this Companion's stories (their inputs, parts, cards and fields",
    "-- go with them), part titles and cards. The guard above made sure none of it was published.",
    `delete from public.stories where companion_id = '${c.id}' and id not in (${ids(rows.stories)});`,
    "delete from public.story_parts p using public.stories s",
    `  where s.id = p.story_id and s.companion_id = '${c.id}' and p.story_id || '.p' || p.part not in (${partItems});`,
    "delete from public.story_cards k using public.stories s",
    `  where s.id = k.story_id and s.companion_id = '${c.id}' and k.key not in (${cardKeys});`,
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
      "-- What the run would add, change and remove, per kind (a Companion row added means it was",
      "-- not in the database before the run).",
      "with after as (",
      ...currentRowsSql(c.id),
      ")",
      "select coalesce(a.kind, b.kind) as kind,",
      "  count(*) filter (where b.item is null) as added,",
      "  count(*) filter (where a.item is not null and b.item is not null and a.digest <> b.digest) as changed,",
      "  count(*) filter (where a.item is null) as removed,",
      "  count(*) filter (where a.digest = b.digest) as unchanged",
      "from after a full join draft_import_before b on b.kind = a.kind and b.item = a.item",
      "group by 1 order by 1;",
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/** The md5 of each stored item, built the same way as `currentRowsSql` builds it in Postgres. */
const digests = {
  companion: (c) =>
    md5([c.name, c.short_name, c.tags, c.line, c.portrait, "null", c.mode, c.key_code].join("|")),
  story: (s, companionId) =>
    md5([companionId, String(s.sequence), s.title, s.period, "", "", ""].join("|")),
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
  field: (f) => md5([f.story_id, f.field, f.body, "draft"].join("|")),
};

/**
 * A read-only SELECT comparing the database with the export, both ways: one row per item of
 * either, saying ok, missing (in the file, not in the database), "only in the database" (a row of
 * this Companion the file no longer has) or "differs from the file" (a published card or field
 * differs too). Only ids and md5 sums are printed, never a text.
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
    `-- Read only: compares the draft import of ${c.id} with the export folder, both ways (#502). Every row should say ok.`,
    "with expected (kind, item, digest) as (values",
    expected.map((row) => `  ${row}`).join(",\n"),
    "), stored as (",
    ...currentRowsSql(c.id),
    ")",
    "select coalesce(x.kind, s.kind) as kind, coalesce(x.item, s.item) as item,",
    "  case when s.item is null then 'missing'",
    "    when x.item is null then 'only in the database, not in the file'",
    "    when s.digest <> x.digest then 'differs from the file'",
    "    else 'ok' end as result",
    "from expected x full join stored s on s.kind = x.kind and s.item = x.item",
    "order by 1, 2;",
    "",
  ].join("\n");
}

/**
 * The undo: removes every story of this Companion (their inputs, parts, cards and fields go with
 * them), whichever export they came from. It stops with an error, and removes nothing, when a
 * card or a field of his was ever published. His Companion row stays: it may have been there
 * before the import (scripts/content/import.mjs writes it from companions.json), and it holds only
 * the committed short fields with enter_href null.
 * @param {ReturnType<typeof readDraftExport>} rows
 */
export function undoSql(rows) {
  const id = rows.companion.id;
  return [
    `-- Undo of the draft import of ${id} (scripts/content/import-drafts.mjs, #502).`,
    "begin;",
    "do $guard$",
    "begin",
    `  if ${publishedCondition(id).join("\n")} then`,
    "    raise exception 'something of this Companion was published; the undo removes nothing';",
    "  end if;",
    "end",
    "$guard$;",
    `delete from public.stories where companion_id = '${id}';`,
    "-- The Companion row stays (see the Human steps for removing it when the run added it).",
    "commit;",
    "",
  ].join("\n");
}

// ---- #516: keep published --------------------------------------------------------------------

/** The cards and part titles of the file, as two temporary tables (dropped at the end). */
export function exportTables(rows, { bodies = true } = {}) {
  const cardValues = rows.cards.map((card) => {
    const values = [card.key, card.story_id, card.kind, card.part, card.slice, card.position]
      .map(literal)
      .join(", ");
    return `  (${values}, ${bodies ? quote(card.body) : `'${md5(card.body)}'`})`;
  });
  const partValues = rows.parts.map(
    (part) => `  (${literal(part.story_id)}, ${part.part}, ${quote(part.title)})`,
  );
  return [
    `create temporary table import_cards (key text primary key, story_id text not null, kind text not null, part integer, slice text, position integer not null, ${bodies ? "body" : "digest"} text not null) on commit drop;`,
    `insert into import_cards (key, story_id, kind, part, slice, position, ${bodies ? "body" : "digest"}) values`,
    `${cardValues.join(",\n")};`,
    "create temporary table import_parts (story_id text not null, part integer not null, title text not null, primary key (story_id, part)) on commit drop;",
    "insert into import_parts (story_id, part, title) values",
    `${partValues.join(",\n")};`,
  ];
}

/**
 * #526: the export's new stage 0 values (slices, steps, scene) by story, as a temporary table
 * (dropped at the end). Empty when the export has no stage 0 folder.
 * @param {{ stageZeros?: { story_id: string, stage: object }[] }} rows
 */
export function stageZeroTable(rows) {
  const stages = rows.stageZeros ?? [];
  if (stages.length === 0) return [];
  return [
    "create temporary table import_stage (story_id text primary key, stage jsonb not null) on commit drop;",
    "insert into import_stage (story_id, stage) values",
    `${stageValues(stages).join(",\n")};`,
  ];
}

/** One (story id, stage 0 values) row per story; the values hold story text. */
const stageValues = (stages) =>
  stages.map(
    (entry) => `  (${literal(entry.story_id)}, ${quote(JSON.stringify(entry.stage))}::jsonb)`,
  );

/** A story with a switch-over that is not undone. */
const switchedOver = (story) =>
  `exists (select 1 from private.story_switches w where w.story_id = ${story} and w.undone_at is null)`;

/** This import's own drafts of a key: written by no editor, never published, above the last published version. */
const importDraft = (alias) =>
  `${alias}.created_by is null and not ${alias}.published and ${alias}.published_at is null
    and ${alias}.version > coalesce((select max(e.version) from public.story_cards e where e.key = ${alias}.key and e.published_at is not null), 0)`;

/**
 * #516: the SQL of --keep-published, in one transaction. Every published row stays as it is; see
 * the file's header. The dry run lists what the run would do, the part titles the switch-over
 * will set, and how many published rows changed (always 0), then rolls back.
 * @param {ReturnType<typeof readCardExport>} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function keepPublishedSql(rows, { dryRun = false } = {}) {
  const c = rows.companion;
  const stories = ids(rows.stories);
  const stageZeros = (rows.stageZeros ?? []).length > 0;
  const lines = [
    `-- Draft import of the regenerated cards of ${c.id} next to his published cards (scripts/content/import-drafts.mjs --keep-published, #516): ${rows.stories.length} stories, ${rows.parts.length} part titles (set at each story's switch-over), ${rows.cards.length} cards. Nothing published changes.`,
    "-- Holds story text: run it in the SQL editor only; never save it in the repository.",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    "begin;",
    "set local standard_conforming_strings = on;",
    ...exportTables(rows),
    ...stageZeroTable(rows),
    "do $guard$",
    "begin",
    `  if not exists (select 1 from public.companions where id = '${c.id}') then`,
    `    raise exception 'no Companion ${c.id} in the database; nothing was written';`,
    "  end if;",
    "  if exists (select 1 from (select distinct story_id from import_cards) e",
    `      where not exists (select 1 from public.stories s where s.id = e.story_id and s.companion_id = '${c.id}')) then`,
    "    raise exception 'a story of the export is not one of this Companion''s stories in the database; nothing was written';",
    "  end if;",
    ...(stageZeros
      ? [
          "  if exists (select 1 from import_stage x where not exists (select 1 from public.story_inputs i where i.story_id = x.story_id)) then",
          "    raise exception 'a story of the export has no story inputs row; nothing was written';",
          "  end if;",
        ]
      : []),
    "end",
    "$guard$;",
    "-- #522 review: a key whose newest version is an editor's unpublished draft (saved in the admin,",
    "-- before or after an earlier run) is left alone, so the switch-over publishes the editor's text.",
    "create temporary table import_kept on commit drop as",
    "  select i.key from import_cards i",
    "  join lateral (select e.body, e.published, e.published_at, e.created_by from public.story_cards e",
    "    where e.key = i.key order by e.version desc limit 1) n on true",
    "  where n.created_by is not null and not n.published and n.published_at is null and n.body <> i.body;",
    ...(dryRun
      ? [
          "create temporary table import_before on commit drop as",
          `  select key, version, body, published, published_at from public.story_cards where story_id in (${stories});`,
          "create temporary table import_parts_before on commit drop as",
          `  select story_id, part, title from public.story_parts where story_id in (${stories});`,
          "create temporary table import_inputs_before on commit drop as",
          `  select story_id, stage_zero::text as stage_zero from public.story_inputs where story_id in (${stories});`,
        ]
      : []),
    "-- 1. Drafts of an earlier run of this import whose keys the export no longer has.",
    "delete from public.story_cards k",
    `  where k.story_id in (${stories}) and not exists (select 1 from import_cards i where i.key = k.key)`,
    `    and ${importDraft("k")};`,
    "-- 2. This import's own draft, when it is still the key's newest version: the file's text again.",
    "update public.story_cards k",
    "  set story_id = i.story_id, kind = i.kind, part = i.part, slice = i.slice, position = i.position, body = i.body",
    "  from import_cards i",
    "  where k.key = i.key and (k.body <> i.body or k.slice is distinct from i.slice)",
    "    and k.version = (select max(e.version) from public.story_cards e where e.key = k.key)",
    `    and ${importDraft("k")};`,
    "-- 3. Every other card whose newest version does not hold the file's text: a new draft version",
    "--    (version 1 for a new key), except the keys kept for an editor's draft. Published versions",
    "--    are not touched, so the history stays.",
    "insert into public.story_cards (key, version, story_id, kind, part, slice, position, body, published, published_at, created_by)",
    "  select i.key, coalesce(n.version, 0) + 1, i.story_id, i.kind, i.part, i.slice, i.position, i.body, false, null, null",
    "  from import_cards i",
    "  left join lateral (select e.version, e.body from public.story_cards e where e.key = i.key order by e.version desc limit 1) n on true",
    "  where n.body is distinct from i.body and not exists (select 1 from import_kept k where k.key = i.key);",
    ...(stageZeros
      ? [
          "-- 4. #526: each story's new stage 0 waits in stage_zero_next for its switch-over. stage_zero, which",
          "--    phones read, is not touched; a story already switched over is left alone.",
          "update public.story_inputs i set stage_zero_next = x.stage",
          "  from import_stage x",
          `  where i.story_id = x.story_id and i.stage_zero_next is distinct from x.stage and not ${switchedOver("x.story_id")};`,
        ]
      : []),
  ];
  if (!dryRun) {
    lines.push("commit;", "");
    return lines.join("\n");
  }
  const changed =
    "a.key is null or b.key is null or a.body <> b.body or a.published <> b.published or a.published_at is distinct from b.published_at";
  const isPublished = (alias) =>
    `(coalesce(${alias}.published, false) or ${alias}.published_at is not null)`;
  lines.push(
    "-- What the run would do (counts), then each part title of the file next to the one stored now.",
    "-- The SQL editor shows only the last result, so the report stops the script as an error that",
    '-- starts "Dry run: nothing was changed." (as scripts/story-cards/fix-published.mjs, #522 review).',
    "do $report$",
    "declare",
    "  report text;",
    "begin",
    "with after as (",
    `  select key, version, body, published, published_at from public.story_cards where story_id in (${stories})`,
    "), newest as (",
    "  select distinct on (key) key, body, published, published_at from after order by key, version desc",
    "), pairs as (",
    "  select a.key as a_key, b.key as b_key, a.version, a.body, b.body as b_body, a.published, a.published_at,",
    `    ${isPublished("a")} or ${isPublished("b")} as live, (${changed}) as differs`,
    "  from after a full join import_before b on b.key = a.key and b.version = a.version",
    ")",
    "select string_agg(what || coalesce(': ' || count::text, '') || coalesce(': ' || detail, ''), E'\\n' order by at, detail)",
    "  into report from (",
    "  select 1 as at, 'stories in the export' as what, (select count(distinct story_id) from import_cards)::int as count, null::text as detail",
    "  union all select 2, 'part titles in the export (set at the switch-over)', (select count(*) from import_parts)::int, null",
    "  union all select 3, 'cards in the export', (select count(*) from import_cards)::int, null",
    "  union all select 4, 'drafts added', (select count(*) from pairs where b_key is null)::int, null",
    "  union all select 5, 'drafts changed', (select count(*) from pairs where a_key is not null and b_key is not null and differs)::int, null",
    "  union all select 6, 'drafts removed', (select count(*) from pairs where a_key is null)::int, null",
    "  union all select 7, 'cards of the export that are drafts after the run', (select count(*) from import_cards i join newest n on n.key = i.key",
    "    where n.body = i.body and not n.published and n.published_at is null)::int, null",
    "  union all select 8, 'cards of the export already published with this text', (select count(*) from import_cards i join newest n on n.key = i.key",
    "    where n.body = i.body and (n.published or n.published_at is not null))::int, null",
    "  union all select 9, 'published cards not in the export (retired at the switch-over)', (select count(*) from after a",
    "    where a.published and not exists (select 1 from import_cards i where i.key = a.key))::int, null",
    "  union all select 10, 'published rows changed', (select count(*) from pairs where live and differs)::int, null",
    "  union all select 10, 'kept: editor draft', (select count(*) from import_kept)::int, null",
    "  union all select 14, 'editor draft kept', null, key from import_kept",
    ...(stageZeros
      ? [
          "  union all select 15, 'stage 0 files in the export', (select count(*) from import_stage)::int, null",
          "  union all select 16, 'stage 0 waiting for the switch-over', (select count(*) from import_stage x",
          "    join public.story_inputs i on i.story_id = x.story_id where i.stage_zero_next = x.stage)::int, null",
          `  union all select 17, 'stage 0 left alone (story switched over)', (select count(*) from import_stage x where ${switchedOver("x.story_id")})::int, null`,
          "  union all select 18, 'stage 0 that phones read, changed', (select count(*) from import_inputs_before b",
          "    join public.story_inputs i on i.story_id = b.story_id where i.stage_zero::text <> b.stage_zero)::int, null",
        ]
      : []),
    "  union all select 11, 'part titles changed', (select count(*) from import_parts_before b",
    "    full join public.story_parts p on p.story_id = b.story_id and p.part = b.part",
    `    where (p.story_id is null or p.story_id in (${stories})) and (p.story_id is null or b.story_id is null or p.title <> b.title))::int, null`,
    "  union all select 12, 'part title', null, x.story_id || ' part ' || x.part || ': now ' || coalesce(p.title, 'none') || '; new ' || x.title",
    "    from import_parts x left join public.story_parts p on p.story_id = x.story_id and p.part = x.part",
    "  union all select 12, 'part title', null, p.story_id || ' part ' || p.part || ': now ' || p.title || '; removed at the switch-over'",
    "    from public.story_parts p",
    `    where p.story_id in (${stories}) and not exists (select 1 from import_parts x where x.story_id = p.story_id and x.part = p.part)`,
    ") summary;",
    "  raise exception 'Dry run: nothing was changed.%', E'\\n' || report;",
    "end",
    "$report$;",
    "rollback;",
    "",
  );
  return lines.join("\n");
}

/** The stage 0 values a story's stage_zero holds now (slices, steps, scene). */
export const currentStage = (column) =>
  `(select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(${column}::jsonb) e where e.key in ('slices', 'steps', 'scene'))`;

/** #526: one check row per story of the export's stage 0 (only with a stage 0 folder). */
function stageZeroCheckRows(rows) {
  const stages = rows.stageZeros ?? [];
  if (stages.length === 0) return [];
  const current = currentStage("i.stage_zero");
  return [
    "union all",
    "select 'stage 0 ' || x.story_id,",
    "  case",
    "    when i.story_id is null then 'missing: no story inputs row'",
    `    when ${switchedOver("x.story_id")} and ${current} = x.stage then 'ok, switched over'`,
    `    when ${switchedOver("x.story_id")} then 'switched over with a different stage 0 (a changed export)'`,
    "    when i.stage_zero_next = x.stage then 'ok, waiting for the switch-over'",
    "    when i.stage_zero_next is null then 'not imported'",
    "    else 'differs from the file (a changed export)'",
    "  end",
    `from (values\n${stageValues(stages).join(",\n")}\n) x (story_id, stage)`,
    "left join public.story_inputs i on i.story_id = x.story_id",
  ];
}

/**
 * #516: a read-only SELECT comparing his database cards with the file by md5, one row per key of
 * either: the newest version against the file, and the old published keys the file does not have.
 * Only keys and results are printed, never a text.
 * @param {ReturnType<typeof readCardExport>} rows
 */
export function keepPublishedCheckSql(rows) {
  const expected = rows.cards.map((card) => `  ('${card.key}', '${md5(card.body)}')`);
  return [
    `-- Read only: the regenerated cards of ${rows.companion.id} against the file (#516). Every row should start with ok.`,
    "with expected (key, digest) as (values",
    expected.join(",\n"),
    "), cards as (",
    `  select key, version, body, published, published_at, created_by from public.story_cards where story_id in (${ids(rows.stories)})`,
    "), newest as (",
    "  select distinct on (key) key, md5(body) as digest, published, published_at, created_by from cards order by key, version desc",
    ")",
    "select coalesce(x.key, n.key) as item,",
    "  case",
    "    when n.key is null then 'missing'",
    "    when x.key is not null and n.digest <> x.digest and n.created_by is not null and not n.published and n.published_at is null",
    "      then 'kept: editor draft'",
    "    when x.key is null and exists (select 1 from cards c where c.key = n.key and c.published) then 'ok, published now; retired at the switch-over'",
    "    when x.key is null and exists (select 1 from cards c where c.key = n.key and c.published_at is not null) then 'ok, retired'",
    "    when x.key is null then 'only in the database, not in the file'",
    "    when n.digest <> x.digest then 'differs from the file (a later edit in the admin, or a changed export)'",
    "    when n.published then 'ok, published'",
    "    when n.published_at is not null then 'ok, published before (the switch-over was undone)'",
    "    else 'ok, draft'",
    "  end as result",
    "from expected x full join newest n on n.key = x.key",
    ...stageZeroCheckRows(rows),
    "order by 1;",
    "",
  ].join("\n");
}

/**
 * #516: the undo of --keep-published: removes this import's own drafts of these stories, and
 * nothing else (published versions, versions that were ever published and editors' drafts stay).
 * It stops, removing nothing, when a story of the file is not this Companion's, or while a
 * switch-over of one of these stories is not undone (the switch-over's undo turns the versions it
 * published back into drafts, so this undo then removes them too). The dry run reports how many
 * drafts it would remove, as an error, and changes nothing.
 * @param {ReturnType<typeof readCardExport>} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function keepPublishedUndoSql(rows, { dryRun = false } = {}) {
  const stories = ids(rows.stories);
  const id = rows.companion.id;
  return [
    `-- Undo of the draft import of the regenerated cards of ${id} (scripts/content/import-drafts.mjs --keep-published, #516).`,
    ...(dryRun ? ["-- DRY RUN: stops with its report; nothing is kept."] : []),
    "begin;",
    "do $guard$",
    "declare",
    "  switched boolean := false;",
    "begin",
    `  if exists (select 1 from unnest(array[${stories}]::text[]) e(story_id)`,
    `      where not exists (select 1 from public.stories s where s.id = e.story_id and s.companion_id = '${id}')) then`,
    "    raise exception 'a story of the export is not one of this Companion''s stories in the database; nothing was removed';",
    "  end if;",
    "  if to_regclass('private.story_switches') is not null then",
    "    execute 'select exists (select 1 from private.story_switches where undone_at is null and story_id = any ($1))'",
    `      into switched using array[${stories}]::text[];`,
    "  end if;",
    "  if switched then",
    "    raise exception 'a story of the export is switched over: undo the switch-over first (scripts/content/switch-story.mjs --undo); nothing was removed';",
    "  end if;",
    "end",
    "$guard$;",
    "do $undo$",
    "declare",
    "  removed integer;",
    "  published_removed integer;",
    "  stage_cleared integer := 0;",
    "begin",
    "  with gone as (",
    "    delete from public.story_cards k",
    `      where k.story_id in (${stories})`,
    `        and ${importDraft("k")}`,
    "      returning k.published, k.published_at",
    "  )",
    "  select count(*), count(*) filter (where published or published_at is not null)",
    "    into removed, published_removed from gone;",
    ...((rows.stageZeros ?? []).length > 0
      ? [
          "  -- #526: the stage 0 waiting for a switch-over goes too (no story is switched over: see above).",
          `  update public.story_inputs set stage_zero_next = null where story_id in (${stories}) and stage_zero_next is not null;`,
          "  get diagnostics stage_cleared = row_count;",
        ]
      : []),
    ...(dryRun
      ? [
          "  raise exception 'Dry run: nothing was changed.%', E'\\n' || 'drafts removed: ' || removed",
          "    || E'\\n' || 'published rows changed: ' || published_removed",
          "    || E'\\n' || 'stage 0 waiting cleared: ' || stage_cleared;",
        ]
      : []),
    "end",
    "$undo$;",
    dryRun ? "rollback;" : "commit;",
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
  const since = git("merge-base", base, "HEAD").trim() || base;
  for (const file of lines(git("diff", "--name-only", "--diff-filter=AM", since))) {
    files[file] = lines(git("diff", "-U0", "--no-color", since, "--", file))
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
  const keep = args.includes("--keep-published");
  const flags = args.filter(
    (arg) =>
      arg.startsWith("--") && arg !== "--extra" && arg !== "--base" && arg !== "--keep-published",
  );
  const folders = args.filter((arg, at) => !arg.startsWith("--") && !valued.has(at));
  const known = keep
    ? ["--dry-run", "--check", "--undo"]
    : ["--dry-run", "--check", "--undo", "--source-check"];
  // #522: with --keep-published, the undo has a dry run too (--undo --dry-run).
  const undoDryRun =
    keep && flags.length === 2 && flags.includes("--undo") && flags.includes("--dry-run");
  if (
    flags.some((flag) => !known.includes(flag)) ||
    (flags.length > 1 && !undoDryRun) ||
    folders.length !== 1
  ) {
    console.error(
      "Usage: node scripts/content/import-drafts.mjs <export folder> [--keep-published] [--dry-run | --check | --undo | --source-check [--base <ref>] [--extra <file>]...] (with --keep-published also --undo --dry-run)",
    );
    process.exit(2);
  }
  try {
    if (flags[0] === "--source-check") {
      process.exit(sourceCheck(folders[0], valueOf("--base") ?? "origin/main", extras) ? 0 : 1);
    }
    if (keep) {
      const cards = readCardExport(folders[0]);
      process.stdout.write(
        flags[0] === "--check"
          ? keepPublishedCheckSql(cards)
          : flags.includes("--undo")
            ? keepPublishedUndoSql(cards, { dryRun: undoDryRun })
            : keepPublishedSql(cards, { dryRun: flags[0] === "--dry-run" }),
      );
    } else {
      const rows = readDraftExport(folders[0]);
      process.stdout.write(
        flags[0] === "--check"
          ? checkSql(rows)
          : flags[0] === "--undo"
            ? undoSql(rows)
            : importSql(rows, { dryRun: flags[0] === "--dry-run" }),
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
