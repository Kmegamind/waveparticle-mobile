// Turns the owner's sample files into SQL for the sample library (#479; AI-LAB-SAMPLES,
// AI-SOURCE-EXCERPTS, AI-SAMPLES-LOCAL; docs/api/ai-samples.md; docs/decisions/0036). The files
// stay in the owner's planning folder (story-pipeline/admin-handoff_<date>/samples-for-import/)
// and are never copied into the repository: this script reads them when it runs and PRINTS SQL to
// stdout. It writes no file, connects to nothing and never calls a model.
//
//   node scripts/ai-samples/import-samples.mjs <samples-for-import>            # the SQL
//   node scripts/ai-samples/import-samples.mjs <samples-for-import> --dry-run  # then ROLLBACK
//   node scripts/ai-samples/import-samples.mjs <samples-for-import> --check    # read-only SELECT
//   node scripts/ai-samples/import-samples.mjs <samples-for-import> --undo     # the undo SQL
//
// Run it after supabase/migrations/20261205000000_ai_samples.sql. Each *.json file of the folder
// is one sample, in file name order (its position in the library). Its source excerpt becomes a
// row of public.ai_source_excerpts with the same id and the source named; the sample becomes a row
// of public.ai_samples. Running it again updates the same rows. A folder inside the repository or
// inside proposed4 is refused. Keys starting with "_" (notes for the owner) are not stored.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Limits as the migration's checks. */
export const LIMITS = { excerpt: 50_000, text: 20_000, name: 200, source: 300 };

const KEYS = [
  "id",
  "name",
  "companion",
  "mode",
  "persona",
  "source_label",
  "source_excerpt",
  "background",
  "facts",
  "world_record",
  "standing_task",
  "plan",
];

/**
 * @typedef {{ id: string, position: number, name: string, companion: string | null,
 *   mode: string | null, persona: string, sourceLabel: string | null, excerpt: string | null,
 *   background: string, facts: string[], worldRecord: string, standingTask: string,
 *   plan: Record<string, unknown> | null, file: string }} Sample
 */

/**
 * A dollar-quoted SQL text that cannot be closed by the text itself: the first place the closing
 * tag occurs in text + tag must be the closing tag, so the text neither contains the tag nor ends
 * in a part of it (for example "... $sample" before "$sample$").
 */
export function quote(text) {
  let tag = "$sample$";
  for (let n = 1; `${text}${tag}`.indexOf(tag) !== text.length; n += 1) tag = `$sample_${n}$`;
  return `${tag}${text}${tag}`;
}

const md5 = (text) => createHash("md5").update(text, "utf8").digest("hex");

function text(value, field, file, max, { optional = true } = {}) {
  if (value === undefined || value === null) {
    if (!optional) throw new Error(`${file}: ${field} is missing`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${file}: ${field} is not a text`);
  if (value.length > max) throw new Error(`${file}: ${field} is longer than ${max} characters`);
  return value;
}

/**
 * Checks one parsed sample file and returns the row to store.
 * @param {unknown} raw
 * @param {string} file
 * @param {number} position
 * @returns {Sample}
 */
export function parseSample(raw, file, position) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${file}: a sample file holds one object`);
  }
  const data = /** @type {Record<string, unknown>} */ (raw);
  const unknown = Object.keys(data).filter((key) => !key.startsWith("_") && !KEYS.includes(key));
  if (unknown.length > 0) throw new Error(`${file}: unknown field ${unknown.join(", ")}`);

  const id = text(data.id, "id", file, LIMITS.name, { optional: false });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`${file}: the id "${id}" is not a slug`);
  const name = text(data.name, "name", file, LIMITS.name, { optional: false }).trim();
  if (!name) throw new Error(`${file}: name is empty`);
  const companion = text(data.companion, "companion", file, LIMITS.name).trim() || null;
  const mode = text(data.mode, "mode", file, LIMITS.name).trim() || null;
  if (mode !== null && mode !== "historical" && mode !== "fictional") {
    throw new Error(`${file}: mode is historical or fictional`);
  }
  const excerpt = text(data.source_excerpt, "source_excerpt", file, LIMITS.excerpt);
  const sourceLabel = text(data.source_label, "source_label", file, LIMITS.source).trim();
  if (excerpt.trim() && !sourceLabel) {
    throw new Error(`${file}: the source excerpt needs its source named (source_label)`);
  }
  if (!excerpt.trim() && sourceLabel) {
    throw new Error(`${file}: source_label is given but the source excerpt is empty`);
  }
  const facts = data.facts ?? [];
  if (!Array.isArray(facts) || facts.some((fact) => typeof fact !== "string")) {
    throw new Error(`${file}: facts is a list of texts`);
  }
  const plan = data.plan ?? null;
  if (plan !== null) {
    if (typeof plan !== "object" || Array.isArray(plan)) {
      throw new Error(`${file}: plan is an object`);
    }
    const aims = /** @type {Record<string, unknown>} */ (plan).aims;
    if (aims !== undefined && !Array.isArray(aims)) throw new Error(`${file}: plan.aims is a list`);
  }
  return {
    id,
    position,
    name,
    companion,
    mode,
    persona: text(data.persona, "persona", file, LIMITS.text),
    sourceLabel: excerpt.trim() ? sourceLabel : null,
    excerpt: excerpt.trim() ? excerpt : null,
    background: text(data.background, "background", file, LIMITS.text),
    facts,
    worldRecord: text(data.world_record, "world_record", file, LIMITS.text),
    standingTask: text(data.standing_task, "standing_task", file, LIMITS.text),
    plan: /** @type {Record<string, unknown> | null} */ (plan),
    file,
  };
}

/**
 * Reads every *.json file of a folder outside the repository, in file name order.
 * @param {string} folder
 * @returns {Sample[]}
 */
export function readSamples(folder) {
  const resolved = path.resolve(folder);
  if (resolved.split(path.sep).includes("proposed4")) {
    throw new Error("proposed4 is not imported (AI-PROPOSED4-HOLD)");
  }
  if (resolved === REPO || resolved.startsWith(`${REPO}${path.sep}`)) {
    throw new Error("the sample files stay outside the repository (AI-SAMPLES-LOCAL)");
  }
  const files = readdirSync(resolved)
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error(`no .json sample file in ${resolved}`);
  const samples = files.map((file, index) =>
    parseSample(JSON.parse(readFileSync(path.join(resolved, file), "utf8")), file, index + 1),
  );
  const ids = samples.map((sample) => sample.id);
  const twice = ids.find((id, index) => ids.indexOf(id) !== index);
  if (twice) throw new Error(`two files have the id ${twice}`);
  return samples;
}

const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const nullable = (value) => (value === null ? "null" : quote(value));
const idList = (samples) => samples.map((sample) => `'${sample.id}'`).join(", ");

/**
 * The SQL: each excerpt, then each sample, inserted or updated by id, in one transaction. No text
 * of a sample is printed in the comments, only its id, file and sizes. With dryRun it ends in
 * ROLLBACK after listing what would be stored.
 * @param {Sample[]} samples
 * @param {{ dryRun?: boolean }} [options]
 */
export function importSql(samples, { dryRun = false } = {}) {
  const lines = [
    "-- The sample library from samples-for-import (scripts/ai-samples/import-samples.mjs, #479).",
    "-- Holds source text: run it in the SQL editor only; never save it in the repository.",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    ...samples.map(
      (sample) =>
        `--   ${sample.position}. ${sample.id} from ${sample.file}: excerpt ${sample.excerpt?.length ?? 0} characters`,
    ),
    "begin;",
  ];
  for (const sample of samples) {
    if (sample.excerpt === null) continue;
    lines.push(
      "insert into public.ai_source_excerpts (id, source_label, body)",
      `values ('${sample.id}', ${quote(sample.sourceLabel ?? "")}, ${quote(sample.excerpt)})`,
      "on conflict (id) do update set source_label = excluded.source_label, body = excluded.body, updated_at = now();",
    );
  }
  for (const sample of samples) {
    lines.push(
      "insert into public.ai_samples (id, position, name, companion, mode, persona, source_excerpt_id, background, facts, world_record, standing_task, plan)",
      `values ('${sample.id}', ${sample.position}, ${quote(sample.name)}, ${nullable(sample.companion)}, ${nullable(sample.mode)}, ${quote(sample.persona)}, ${sample.excerpt === null ? "null" : `'${sample.id}'`}, ${quote(sample.background)}, ${json(sample.facts)}, ${quote(sample.worldRecord)}, ${quote(sample.standingTask)}, ${sample.plan === null ? "null" : json(sample.plan)})`,
      "on conflict (id) do update set position = excluded.position, name = excluded.name, companion = excluded.companion, mode = excluded.mode, persona = excluded.persona, source_excerpt_id = excluded.source_excerpt_id, background = excluded.background, facts = excluded.facts, world_record = excluded.world_record, standing_task = excluded.standing_task, plan = excluded.plan, updated_at = now();",
    );
  }
  if (dryRun) {
    lines.push(
      "select s.position, s.id, s.mode, e.id is not null as has_excerpt, char_length(e.body) as excerpt_characters, jsonb_array_length(s.facts) as facts",
      "from public.ai_samples s left join public.ai_source_excerpts e on e.id = s.source_excerpt_id",
      `where s.id in (${idList(samples)}) order by s.position;`,
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/**
 * A read-only SELECT: for each sample, whether the stored rows are the files' text (by md5, so no
 * text is printed). Every row should say ok.
 * @param {Sample[]} samples
 */
export function checkSql(samples) {
  const texts = (sample) =>
    [sample.name, sample.persona, sample.background, sample.worldRecord, sample.standingTask]
      .map(md5)
      .join(",");
  return [
    "-- Read only: compares the sample library with samples-for-import (#479). Every row should say ok.",
    "with expected (id, position, texts_md5, facts, excerpt_md5, source_md5) as (values",
    samples
      .map(
        (sample) =>
          `  ('${sample.id}', ${sample.position}, '${texts(sample)}', ${sample.facts.length}, ` +
          `${sample.excerpt === null ? "null" : `'${md5(sample.excerpt)}'`}, ` +
          `${sample.sourceLabel === null ? "null" : `'${md5(sample.sourceLabel)}'`})`,
      )
      .join(",\n"),
    ")",
    "select x.id, x.position,",
    "  case",
    "    when s.id is null then 'missing'",
    "    when s.position <> x.position then 'different position'",
    "    when concat_ws(',', md5(s.name), md5(s.persona), md5(s.background), md5(s.world_record), md5(s.standing_task)) <> x.texts_md5 then 'sample text differs from the file'",
    "    when jsonb_array_length(s.facts) <> x.facts then 'different number of facts'",
    "    when x.excerpt_md5 is distinct from md5(e.body) then 'excerpt differs from the file'",
    "    when x.source_md5 is distinct from md5(e.source_label) then 'source named differs from the file'",
    "    else 'ok'",
    "  end as result",
    "from expected x",
    "left join public.ai_samples s on s.id = x.id",
    "left join public.ai_source_excerpts e on e.id = s.source_excerpt_id",
    "order by x.position;",
    "",
  ].join("\n");
}

/**
 * The undo: removes the imported samples and their excerpts. The tables were empty before the
 * first import. A sample that a run used cannot be removed (the run log keeps it): the delete
 * then stops with error 23503 and nothing is removed.
 * @param {Sample[]} samples
 */
export function undoSql(samples) {
  return [
    "-- Undo of scripts/ai-samples/import-samples.mjs (#479).",
    "begin;",
    `delete from public.ai_samples where id in (${idList(samples)});`,
    `delete from public.ai_source_excerpts where id in (${idList(samples)});`,
    "commit;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flags = args.filter((arg) => arg.startsWith("--"));
  const folders = args.filter((arg) => !arg.startsWith("--"));
  const unknown = flags.filter((flag) => !["--dry-run", "--check", "--undo"].includes(flag));
  if (unknown.length > 0 || flags.length > 1 || folders.length !== 1) {
    console.error(
      "Usage: node scripts/ai-samples/import-samples.mjs <samples-for-import folder> [--dry-run | --check | --undo]",
    );
    process.exit(2);
  }
  try {
    const samples = readSamples(folders[0]);
    process.stdout.write(
      flags[0] === "--check"
        ? checkSql(samples)
        : flags[0] === "--undo"
          ? undoSql(samples)
          : importSql(samples, { dryRun: flags[0] === "--dry-run" }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
