// Turns the owner's registry-seed.json into SQL for the AI feature registry (#473; AI-REGISTRY-STORE,
// AI-SEED-STATUS, AI-REQUIREMENT-FIELD, AI-SAMPLES-LOCAL; docs/ai/AI_11_feature-pages.md section 5.2;
// docs/decisions/0033). The seed file stays in the owner's planning folder
// (story-pipeline/admin-handoff_2026-11-26/) and is never copied into the repository: this script
// reads it when it runs and prints SQL. It connects to nothing and never calls a model.
//
//   node scripts/ai-features/registry-seed.mjs <registry-seed.json>            # the SQL to apply
//   node scripts/ai-features/registry-seed.mjs <registry-seed.json> --dry-run  # the same, then ROLLBACK
//   node scripts/ai-features/registry-seed.mjs <registry-seed.json> --check    # a read-only SELECT
//   node scripts/ai-features/registry-seed.mjs --undo                          # the undo SQL
//
// Run it after supabase/migrations/20261202000000_ai_registry.sql. What it does:
// - Inserts the 12 Pipeline and Quality gate rows, each only when its slug has no row yet, with the
//   seed's status (AI-SEED-STATUS) and no status history row (AI-SEED-HISTORY is open; the seed
//   writes no history, as scripts/ai-features/seed.mjs).
// - Fills the registry fields of the 7 Runtime rows (where it appears, requirement, output format,
//   design rationale, room to improve, example), each only while it is still empty. Their slug,
//   title, prompt keys, sections (a) to (c), status and history are never touched.
// - Leaves out every example that quotes book or story text (BOOK_TEXT_EXAMPLES): the field stays
//   empty and the page shows "Not written yet"; the example state is kept.
// Running it twice changes nothing the second time.

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { quote } from "./seed.mjs";

/** The seed's category names, as stored. */
export const CATEGORIES = { Pipeline: "pipeline", "Quality gate": "gate", Runtime: "runtime" };
/** The seed's status words, as stored (AI-PAGE-STATUS). */
export const SEED_STATUSES = {
  "not started": "not_started",
  exploring: "exploring",
  passed: "passed",
  frozen: "frozen",
};
export const EXAMPLE_STATES = ["none", "candidate", "confirmed"];

/** The 7 Runtime rows already in the database: Feature ID → slug (AI_11 section 5.2). */
export const RUNTIME_SLUGS = {
  "R-01": "plan_split",
  "R-02": "step_cards",
  "R-03": "pause_message",
  "R-04": "rest_reply",
  "R-05": "return_popup",
  "R-06": "closing_line",
  "R-07": "safety_classifier",
};

/**
 * The rows whose seed example quotes book or story text (generated lines built from the books, or a
 * line of the biography). Their example text is never stored; checked by hand against the seed of
 * 2026-11-26 (the same list as the prototype, #472).
 */
export const BOOK_TEXT_EXAMPLES = [
  "P-04",
  "P-05",
  "P-06",
  "P-07",
  "R-02",
  "R-03",
  "R-04",
  "R-05",
  "R-06",
];

/** The text fields copied from the seed: seed name → column. */
export const TEXT_FIELDS = {
  where: "where_used",
  requirement: "requirement",
  output_format: "output_format",
  rationale: "design_rationale",
  room_to_improve: "room_to_improve",
};

const ID = /^([PGR])-(\d{2})$/;
const KEY = /^[a-z][a-z0-9_]*$/;

/**
 * The slug of a new row, which is also its prompt key in public.prompts (AI-PROMPT-CATEGORY): the
 * Feature ID without the dash, then the name in lower case with underscores ("P-04", "Plan
 * (historical)" → p04_plan_historical). A Runtime row keeps its slug.
 * @param {string} id
 * @param {string} name
 */
export function registrySlug(id, name) {
  if (RUNTIME_SLUGS[id]) return RUNTIME_SLUGS[id];
  const match = id.match(ID);
  if (!match) throw new Error(`bad feature id: ${id}`);
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${match[1].toLowerCase()}${match[2]}_${words}`;
}

/**
 * @typedef {{ feature_id: string, slug: string, category: string, title: string, position: number,
 *   status: string, where_used: string, requirement: string, output_format: string,
 *   design_rationale: string, room_to_improve: string, example_text: string,
 *   example_state: string }} RegistryRow
 */

const text = (value, field, id) => {
  if (typeof value !== "string") throw new Error(`${id}: ${field} is not text`);
  return value.trim();
};

/**
 * The 19 registry rows from the parsed seed file: the 12 new rows get positions 8 to 19 in seed
 * order, after the 7 Runtime rows, which keep theirs (1 to 7).
 * @param {unknown} seed
 * @returns {RegistryRow[]}
 */
export function parseRegistrySeed(seed) {
  const rows = /** @type {{ rows?: unknown }} */ (seed)?.rows;
  if (!Array.isArray(rows)) throw new Error("the seed has no rows list");
  /** @type {RegistryRow[]} */
  const result = [];
  let nextPosition = 8;
  for (const raw of rows) {
    const id = raw?.id;
    if (typeof id !== "string" || !ID.test(id)) throw new Error(`bad feature id: ${id}`);
    const category = CATEGORIES[raw.category];
    if (!category) throw new Error(`${id}: unknown category ${raw.category}`);
    if (category[0] !== id[0].toLowerCase()) {
      throw new Error(`${id}: the id letter does not match the category ${raw.category}`);
    }
    const status = SEED_STATUSES[raw.status];
    if (!status) throw new Error(`${id}: unknown status ${raw.status}`);
    const exampleState = raw.example_state;
    if (!EXAMPLE_STATES.includes(exampleState)) {
      throw new Error(`${id}: unknown example state ${exampleState}`);
    }
    const name = text(raw.name, "name", id);
    const slug = registrySlug(id, name);
    if (!KEY.test(slug)) throw new Error(`${id}: bad slug ${slug}`);
    const runtime = category === "runtime";
    if (runtime !== Boolean(RUNTIME_SLUGS[id])) {
      throw new Error(`${id}: not one of the 7 runtime rows R-01 to R-07`);
    }
    const fields = Object.fromEntries(
      Object.entries(TEXT_FIELDS).map(([from, to]) => [to, text(raw[from] ?? "", from, id)]),
    );
    result.push({
      feature_id: id,
      slug,
      category,
      title: `${name} (${slug})`,
      position: runtime ? Number(id.slice(2)) : nextPosition++,
      status,
      ...fields,
      example_text: BOOK_TEXT_EXAMPLES.includes(id)
        ? ""
        : text(raw.example_or_notes ?? "", "example_or_notes", id),
      example_state: exampleState,
    });
  }
  const ids = new Set(result.map((row) => row.feature_id));
  if (ids.size !== result.length) throw new Error("two rows share a feature id");
  const slugs = new Set(result.map((row) => row.slug));
  if (slugs.size !== result.length) throw new Error("two rows share a slug");
  for (const id of Object.keys(RUNTIME_SLUGS)) {
    if (!ids.has(id)) throw new Error(`the seed has no row ${id}`);
  }
  // The undo removes exactly these slugs, so the seed may add no other row.
  for (const row of result) {
    if (row.category !== "runtime" && !NEW_SLUGS.includes(row.slug)) {
      throw new Error(`${row.feature_id}: slug ${row.slug} is not one of the 12 registry slugs`);
    }
  }
  return result;
}

/** The registry rows from a seed file. */
export function readRegistrySeed(file) {
  return parseRegistrySeed(JSON.parse(readFileSync(file, "utf8")));
}

const literal = (value) => (value === "" ? "''" : quote(value));

/**
 * The SQL that applies the seed. With dryRun the transaction ends in ROLLBACK after listing the
 * rows, so pasting it changes nothing.
 * @param {RegistryRow[]} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function registrySeedSql(rows, { dryRun = false } = {}) {
  const added = rows.filter((row) => row.category !== "runtime");
  const runtime = rows.filter((row) => row.category === "runtime");
  const lines = [
    "-- AI feature registry from registry-seed.json (scripts/ai-features/registry-seed.mjs, #473).",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    `-- ${added.length} new rows (inserted when the slug is missing), ${runtime.length} runtime rows (empty registry fields filled).`,
    ...rows.map(
      (row) =>
        `--   ${row.feature_id} ${row.slug}: ${row.category}, ${row.category === "runtime" ? "status kept" : row.status}, example ${row.example_state}${row.example_text ? "" : " (no text)"}`,
    ),
    "begin;",
  ];
  for (const row of added) {
    lines.push(
      "insert into public.ai_features (slug, feature_id, category, position, title, prompt_keys, status, where_used, requirement, output_format, design_rationale, room_to_improve, example_text, example_state)",
      `values ('${row.slug}', '${row.feature_id}', '${row.category}', ${row.position}, ${quote(row.title)}, array['${row.slug}'], '${row.status}', ${literal(row.where_used)}, ${literal(row.requirement)}, ${literal(row.output_format)}, ${literal(row.design_rationale)}, ${literal(row.room_to_improve)}, ${literal(row.example_text)}, '${row.example_state}')`,
      "on conflict (slug) do nothing;",
    );
  }
  for (const row of runtime) {
    const fill = (column) =>
      `${column} = case when ${column} = '' then ${literal(row[column])} else ${column} end`;
    lines.push(
      "update public.ai_features",
      `set ${Object.values(TEXT_FIELDS).map(fill).join(",\n  ")},`,
      `  example_text = case when example_state = 'none' and example_text = '' then ${literal(row.example_text)} else example_text end,`,
      `  example_state = case when example_state = 'none' and example_text = '' then '${row.example_state}' else example_state end`,
      `where slug = '${row.slug}' and feature_id = '${row.feature_id}';`,
    );
  }
  if (dryRun) {
    lines.push(
      "select feature_id, slug, category, status, position, char_length(requirement) as requirement, example_state",
      "from public.ai_features order by feature_id;",
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/**
 * A read-only SELECT that compares the database with the seed: one line per seed row, with what
 * is stored and whether the id, category, status (new rows only), position and filled fields match.
 * @param {RegistryRow[]} rows
 */
export function registryCheckSql(rows) {
  const expected = rows
    .map(
      (row) =>
        `  ('${row.feature_id}', '${row.slug}', '${row.category}', ${row.category === "runtime" ? "null" : `'${row.status}'`}, ${row.position}, ${row.requirement === "" ? "false" : "true"})`,
    )
    .join(",\n");
  return [
    "-- Read only: compares public.ai_features with registry-seed.json (#473). Every row should say ok.",
    "with expected (feature_id, slug, category, status, position, has_requirement) as (values",
    expected,
    ")",
    "select e.feature_id, e.slug, f.category, f.status, f.position,",
    "  char_length(f.requirement) as requirement_chars, f.example_state,",
    "  case",
    "    when f.slug is null then 'missing'",
    "    when f.feature_id is distinct from e.feature_id or f.category <> e.category then 'different id or category'",
    "    when e.status is not null and f.status <> e.status then 'status changed since the seed'",
    "    when (f.requirement <> '') <> e.has_requirement then 'requirement not filled'",
    "    else 'ok'",
    "  end as result",
    "from expected e",
    "left join public.ai_features f on f.slug = e.slug",
    "order by e.feature_id;",
    "",
  ].join("\n");
}

/** The slugs of the 12 new rows, the same for every seed (AI_11 section 5.2). */
export const NEW_SLUGS = [
  "p01_find_episodes",
  "p02_select_stories",
  "p03_cut_source",
  "p04_plan_historical",
  "p05_plan_fictional",
  "p06_merged_titles",
  "p07_story_cards",
  "g01_judge_plan",
  "g02_fix_plan",
  "g03_judge_cards",
  "g04_fix_cards",
  "g05_simulated_user",
];

/**
 * The undo: removes the 12 new rows (their history and test runs go with them; they had none before
 * the seed) and empties the registry fields of the Runtime rows that the seed filled, back to the
 * state the migration left them in. A Runtime row whose fields or example were saved in the admin
 * after the seed (fields_updated_at or example_set_at set) is left as it is.
 */
export function registryUndoSql() {
  const runtime = Object.values(RUNTIME_SLUGS)
    .map((slug) => `'${slug}'`)
    .join(", ");
  return [
    "-- Undo of scripts/ai-features/registry-seed.mjs (#473).",
    "begin;",
    `delete from public.ai_features where slug in (${NEW_SLUGS.map((slug) => `'${slug}'`).join(", ")});`,
    "update public.ai_features",
    `set ${Object.values(TEXT_FIELDS)
      .map((column) => `${column} = ''`)
      .join(", ")}, example_text = '', example_state = 'none'`,
    `where slug in (${runtime}) and fields_updated_at is null and example_set_at is null;`,
    "commit;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flags = args.filter((arg) => arg.startsWith("--"));
  const files = args.filter((arg) => !arg.startsWith("--"));
  const unknown = flags.filter((flag) => !["--dry-run", "--check", "--undo"].includes(flag));
  if (unknown.length > 0 || flags.length > 1 || files.length > 1) {
    console.error(
      "Usage: node scripts/ai-features/registry-seed.mjs <registry-seed.json> [--dry-run | --check] | --undo",
    );
    process.exit(2);
  }
  if (flags[0] === "--undo") {
    process.stdout.write(registryUndoSql());
  } else {
    if (files.length !== 1) {
      console.error(
        "Name the seed file: .../story-pipeline/admin-handoff_2026-11-26/registry-seed.json",
      );
      process.exit(2);
    }
    const rows = readRegistrySeed(files[0]);
    process.stdout.write(
      flags[0] === "--check"
        ? registryCheckSql(rows)
        : registrySeedSql(rows, { dryRun: flags[0] === "--dry-run" }),
    );
  }
}
