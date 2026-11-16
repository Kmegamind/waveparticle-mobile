// The story content files (#284): the seed of the `companions`, `stories` and `story_inputs`
// tables. Shared by the import and export scripts, the e2e Supabase stub and the tests. The app
// never imports these files; it reads the tables through src/lib/content/repository.ts.
//
// Files (paths relative to the repository root):
//   src/content/companions.json               the Companions, in display order
//   src/content/oppenheimer/stories.json      each story's record (title, date, facts, key moments)
//   src/content/oppenheimer/periods.json      the Life Path periods, each with its story ids
//   docs/demo/<story-id>.stage0.json          each story's generation inputs (stage 0)
//
// Each text the screens show is stored once, in the display tables, under the name the screens
// use: `title`, `goal_short` (the goal sentence), `who` (the "Who I am" line), `opening` (the goal
// dialogue's first line) and `period`. In `story_inputs.stage_zero` those places are null; the
// export puts the display values back. The date lives in `story_inputs.date` only.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const CONTENT_FILES = {
  companions: path.join("src", "content", "companions.json"),
  stories: path.join("src", "content", "oppenheimer", "stories.json"),
  periods: path.join("src", "content", "oppenheimer", "periods.json"),
  stageZeroDirectory: path.join("docs", "demo"),
};

/** The goal dialogue's question after the opening place (the screen shows both). */
export const OPENING_QUESTION = "What are you working on?";

const defaultRoot = fileURLToPath(new URL("../..", import.meta.url));
const STORIES_COMPANION = "oppenheimer";

const readJson = (root, file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const stageZeroFile = (id) => path.join(CONTENT_FILES.stageZeroDirectory, `${id}.stage0.json`);

const openingOf = (place) => `${place} ${OPENING_QUESTION}`;

/**
 * The opening place of a stored opening. The files keep the place only and the import adds the
 * question back, so an opening without the question cannot be written to the files unchanged.
 */
function placeOf(storyId, opening) {
  const suffix = ` ${OPENING_QUESTION}`;
  if (!opening.endsWith(suffix)) {
    throw new Error(`${storyId}: the opening must end with "${suffix}"`);
  }
  return opening.slice(0, -suffix.length);
}

/** The stage 0 parts the export writes the display texts into; named when one is missing. */
function stageZeroParts(storyId, stageZero) {
  for (const part of ["story", "whereNow"]) {
    const value = stageZero?.[part];
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${storyId}: stage_zero has no ${part} object`);
    }
  }
}

/**
 * The rows of the three tables, read from the files, as the database holds them.
 * @param {string} [root]
 */
export function readContentRows(root = defaultRoot) {
  const companions = readJson(root, CONTENT_FILES.companions).map((companion, index) => ({
    id: companion.id,
    position: index + 1,
    name: companion.name,
    short_name: companion.shortName,
    tags: companion.tags,
    line: companion.line,
    portrait: companion.portrait,
    enter_href: companion.enterHref ?? null,
  }));
  const periodOf = new Map();
  for (const period of readJson(root, CONTENT_FILES.periods)) {
    for (const id of period.storyIds) periodOf.set(id, period.name);
  }
  const stories = [];
  const storyInputs = [];
  for (const record of readJson(root, CONTENT_FILES.stories)) {
    const stage = readJson(root, stageZeroFile(record.id));
    if (!periodOf.has(record.id)) throw new Error(`story ${record.id} has no period`);
    stories.push({
      id: record.id,
      companion_id: STORIES_COMPANION,
      sequence: record.sequence,
      title: record.title,
      period: periodOf.get(record.id),
      goal_short: stage.story.goalShort,
      who: stage.who,
      opening: openingOf(stage.whereNow.s1),
    });
    // Same key order as the file: each display text and the date are kept in one place only.
    const stageZero = structuredClone(stage);
    stageZero.who = null;
    stageZero.story.title = null;
    stageZero.story.date = null;
    stageZero.story.goalShort = null;
    stageZero.whereNow.s1 = null;
    storyInputs.push({
      story_id: record.id,
      date: record.date,
      goal: record.goal,
      facts: record.facts,
      forbidden_terms: record.forbiddenTerms,
      key_moments: record.keySlices,
      provenance: record.provenance,
      stage_zero: stageZero,
    });
  }
  return { companions, stories, storyInputs };
}

const byPosition = (left, right) => left.position - right.position;

/** Stories in Companion order, then story order, as the database functions sort them. */
function inStoryOrder(companions, stories) {
  const position = new Map(companions.map((row) => [row.id, row.position]));
  return [...stories].sort(
    (left, right) =>
      (position.get(left.companion_id) ?? 0) - (position.get(right.companion_id) ?? 0) ||
      left.sequence - right.sequence,
  );
}

/**
 * What `get_story_content` returns: the Companions and, for each story, its display fields and
 * the model inputs. No date and no provenance (DATES-ADMIN-ONLY). A story without an inputs row
 * is left out, so one unfinished row in the table editor does not stop every page.
 */
export function appDocument(rows) {
  const inputsOf = new Map(rows.storyInputs.map((row) => [row.story_id, row]));
  return {
    companions: [...rows.companions].sort(byPosition),
    stories: inStoryOrder(rows.companions, rows.stories)
      .filter((story) => inputsOf.has(story.id))
      .map((story) => {
        const inputs = inputsOf.get(story.id);
        return {
          ...story,
          inputs: {
            goal: inputs.goal,
            facts: inputs.facts,
            forbidden_terms: inputs.forbidden_terms,
            key_moments: inputs.key_moments,
            stage_zero: inputs.stage_zero,
          },
        };
      }),
  };
}

/** What `export_story_content` returns: every row of the three tables. */
export function exportDocument(rows) {
  return {
    companions: [...rows.companions].sort(byPosition),
    stories: inStoryOrder(rows.companions, rows.stories),
    story_inputs: [...rows.storyInputs],
  };
}

/** The file contents for an export document, keyed by relative path. */
export function contentFilesOf(document) {
  const files = new Map();
  files.set(
    CONTENT_FILES.companions,
    document.companions.map((row) => ({
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      tags: row.tags,
      line: row.line,
      portrait: row.portrait,
      enterHref: row.enter_href ?? null,
    })),
  );
  const inputsOf = new Map(document.story_inputs.map((row) => [row.story_id, row]));
  const periods = [];
  const records = [];
  for (const story of document.stories) {
    const inputs = inputsOf.get(story.id);
    if (!inputs) throw new Error(`story ${story.id} has no inputs`);
    // The files hold Oppenheimer's stories only; another Companion's stories need files of their own.
    if (story.companion_id !== STORIES_COMPANION) {
      throw new Error(
        `story ${story.id} belongs to ${story.companion_id}; only ${STORIES_COMPANION}'s stories have files`,
      );
    }
    stageZeroParts(story.id, inputs.stage_zero);
    const last = periods.at(-1);
    if (last && last.name === story.period) last.storyIds.push(story.id);
    else periods.push({ name: story.period, storyIds: [story.id] });
    records.push({
      id: story.id,
      sequence: story.sequence,
      title: story.title,
      date: inputs.date,
      goal: inputs.goal,
      facts: inputs.facts,
      forbiddenTerms: inputs.forbidden_terms,
      keySlices: inputs.key_moments,
      provenance: inputs.provenance,
    });
    const stage = structuredClone(inputs.stage_zero);
    stage.who = story.who;
    stage.story.title = story.title;
    stage.story.date = inputs.date;
    stage.story.goalShort = story.goal_short;
    stage.whereNow.s1 = placeOf(story.id, story.opening);
    files.set(stageZeroFile(story.id), stage);
  }
  files.set(CONTENT_FILES.stories, records);
  files.set(CONTENT_FILES.periods, periods);
  return files;
}

/**
 * Writes the export back to the files. A file whose JSON is unchanged is not touched, so an
 * export of unchanged data changes nothing. Returns the relative paths written.
 */
export function writeContentFiles(document, root = defaultRoot) {
  const written = [];
  for (const [file, content] of contentFilesOf(document)) {
    const target = path.join(root, file);
    if (existsSync(target)) {
      const current = JSON.parse(readFileSync(target, "utf8"));
      if (isDeepStrictEqual(current, content)) continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(content, null, 2)}\n`);
    written.push(file);
  }
  return written;
}
