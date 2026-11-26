// Turns the drafts of docs/ai/AI_11_feature-pages.md (section 3) into SQL for `public.ai_features`
// (#436, AI-PAGE-STORE). It prints SQL and connects to nothing: paste it into the Supabase SQL
// editor, or pipe it to psql.
//
//   node scripts/ai-features/seed.mjs > ai-features-seed.sql
//   node scripts/ai-features/seed.mjs --dry-run      # the same inserts, then ROLLBACK
//   node scripts/ai-features/seed.mjs | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
//
// Each of the 7 features is inserted only when its slug has no row yet, with status "exploring"
// (AI-PAGE-STATUS). Running it twice, or after the owner edited a feature in the admin, changes
// nothing. A section with no draft line in AI_11 is an empty list: the page shows
// "Not written yet". Every line keeps its source and is marked as a draft ("draft - owner to edit").

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SPEC_FILE = fileURLToPath(
  new URL("../../docs/ai/AI_11_feature-pages.md", import.meta.url),
);

/** The four statuses (AI-PAGE-STATUS), as stored; every feature starts as exploring. */
export const STATUSES = ["not_started", "exploring", "passed", "frozen"];
export const START_STATUS = "exploring";

/**
 * @typedef {{ text: string, source: string | null, draft: boolean }} FeatureItem
 * @typedef {{ position: number, slug: string, title: string, prompt_keys: string[],
 *   purpose: FeatureItem[], pass_questions: FeatureItem[], approach: FeatureItem[] }} FeatureRow
 */

/** @type {Record<string, "purpose" | "pass_questions" | "approach">} */
const SECTIONS = {
  "(a) Purpose": "purpose",
  "(b) Pass standard": "pass_questions",
  "(c) Current approach": "approach",
};

const DRAFT_LINE = /^- draft - owner to edit: (.+) \(source: ([^()]+)\)$/;
const KEY = /^[a-z][a-z0-9_]*$/;

/**
 * The slug of a feature: its prompt key when it has one, otherwise its name in lower case with
 * underscores ("Pause message" → pause_message). The table keys stay the prompt names (NAMING-CODE).
 * @param {string} name
 * @param {string[]} keys
 */
export function featureSlug(name, keys) {
  return keys.length === 1 ? keys[0] : name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/**
 * The 7 feature rows from the text of AI_11: position, slug, title, prompt keys and the three
 * sections, each a list of { text, source, draft: true }.
 * @param {string} markdown
 * @returns {FeatureRow[]}
 */
export function parseFeaturePages(markdown) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => /^## 3\. /.test(line));
  if (start === -1) throw new Error("AI_11 has no section 3");
  /** @type {FeatureRow[]} */
  const features = [];
  /** @type {FeatureRow | null} */
  let feature = null;
  /** @type {"purpose" | "pass_questions" | "approach" | null} */
  let section = null;
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    const heading = line.match(/^### 3\.(\d+) (.+) \(([^()]+)\)$/);
    if (heading) {
      const name = heading[2].trim();
      const keys = heading[3].split(" + ").map((key) => key.trim());
      for (const key of keys) if (!KEY.test(key)) throw new Error(`bad prompt key: ${key}`);
      feature = {
        position: Number(heading[1]),
        slug: featureSlug(name, keys),
        title: `${name} (${keys.join(" + ")})`,
        prompt_keys: keys,
        purpose: [],
        pass_questions: [],
        approach: [],
      };
      features.push(feature);
      section = null;
      continue;
    }
    if (/^### /.test(line)) throw new Error(`unexpected heading in section 3: ${line}`);
    const bold = line.match(/^\*\*(.+)\*\*$/);
    if (bold && feature) {
      section = SECTIONS[bold[1]] ?? null;
      if (!section) throw new Error(`unknown section in ${feature.title}: ${bold[1]}`);
      continue;
    }
    if (line.startsWith("- draft - owner to edit:")) {
      if (!feature || !section) throw new Error(`draft line outside a section: ${line}`);
      const draft = line.match(DRAFT_LINE);
      if (!draft) throw new Error(`draft line without a source: ${line}`);
      feature[section].push({ text: draft[1].trim(), source: draft[2].trim(), draft: true });
    }
  }
  const slugs = new Set(features.map((row) => row.slug));
  if (slugs.size !== features.length) throw new Error("two features share a slug");
  return features;
}

/** The feature rows from the spec file (default docs/ai/AI_11_feature-pages.md). */
export function readFeatureSeed(file = SPEC_FILE) {
  return parseFeaturePages(readFileSync(file, "utf8"));
}

/** A dollar-quoted SQL string whose marker does not occur in the text. */
export function quote(text) {
  let tag = "$seed$";
  for (let n = 1; text.includes(tag); n += 1) tag = `$seed_${n}$`;
  return `${tag}${text}${tag}`;
}

const items = (list) => `${quote(JSON.stringify(list))}::jsonb`;

/**
 * The Feature ID of each of the 7 features in the registry (#473, AI_11 section 5.2: R-01 to R-07).
 * After 20261202000000_ai_registry.sql every row must have one, with the category runtime.
 */
export const RUNTIME_FEATURE_IDS = {
  plan_split: "R-01",
  step_cards: "R-02",
  pause_message: "R-03",
  rest_reply: "R-04",
  return_popup: "R-05",
  closing_line: "R-06",
  safety_classifier: "R-07",
};

/** The dollar-quote marker of the block below; no seeded text may contain it. */
const BLOCK = "$seed_block$";

/**
 * The SQL: one insert per feature, skipped when the slug exists. The inserts sit in one block that
 * works before and after 20261202000000_ai_registry.sql (#473): when public.ai_features has the
 * registry columns, each row also gets its Feature ID and the category runtime (both required
 * there); otherwise the columns of 20261130000000_ai_features.sql only. With dryRun the transaction
 * ends in ROLLBACK after listing what it would have inserted, so pasting it changes nothing.
 * @param {ReturnType<typeof parseFeaturePages>} rows
 * @param {{ dryRun?: boolean }} [options]
 */
export function seedSql(rows, { dryRun = false } = {}) {
  const lines = [
    "-- AI feature pages from docs/ai/AI_11_feature-pages.md (scripts/ai-features/seed.mjs, #436).",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    ...rows.map(
      (row) =>
        `--   ${row.slug}: "${row.title}", ${row.purpose.length} purpose, ${row.pass_questions.length} pass questions, ${row.approach.length} approach lines`,
    ),
    "begin;",
  ];
  /** @type {string[]} */
  const registry = [];
  /** @type {string[]} */
  const plain = [];
  for (const row of rows) {
    if (!KEY.test(row.slug)) throw new Error(`bad slug: ${row.slug}`);
    // A slug outside the 7 has no Feature ID: the database refuses its null after #473.
    const featureId = RUNTIME_FEATURE_IDS[row.slug];
    const keys = row.prompt_keys.map((key) => `'${key}'`).join(", ");
    const values = `'${row.slug}', ${row.position}, ${quote(row.title)}, array[${keys}], ${items(row.purpose)}, ${items(row.pass_questions)}, ${items(row.approach)}, '${START_STATUS}'`;
    registry.push(
      "insert into public.ai_features (slug, position, title, prompt_keys, purpose, pass_questions, approach, status, feature_id, category)",
      `values (${values}, ${featureId ? `'${featureId}'` : "null"}, 'runtime')`,
      "on conflict (slug) do nothing;",
    );
    plain.push(
      "insert into public.ai_features (slug, position, title, prompt_keys, purpose, pass_questions, approach, status)",
      `values (${values})`,
      "on conflict (slug) do nothing;",
    );
  }
  const block = [
    `do ${BLOCK}`,
    "begin",
    "if exists (",
    "  select 1 from information_schema.columns",
    "  where table_schema = 'public' and table_name = 'ai_features' and column_name = 'feature_id'",
    ") then",
    ...registry,
    "else",
    ...plain,
    "end if;",
    "end;",
    `${BLOCK};`,
  ];
  if (block.slice(1, -1).some((line) => line.includes(BLOCK))) {
    throw new Error(`a seeded text contains ${BLOCK}`);
  }
  lines.push(...block);
  if (dryRun) {
    lines.push(
      "select slug, title, status, jsonb_array_length(purpose) as purpose, jsonb_array_length(pass_questions) as pass_questions, jsonb_array_length(approach) as approach",
      "from public.ai_features order by position;",
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const unknown = args.filter((arg) => arg !== "--dry-run");
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown.join(" ")}`);
    process.exit(2);
  }
  process.stdout.write(seedSql(readFeatureSeed(), { dryRun }));
}
