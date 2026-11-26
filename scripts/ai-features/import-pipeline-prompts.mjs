// Turns the owner's Pipeline and Quality gate prompt files into SQL for public.prompts (#473;
// AI-PROMPT-CATEGORY, AI-REGISTRY-STORE, AI-PROPOSED4-HOLD; docs/ai/AI_11_feature-pages.md section
// 5.2; docs/decisions/0033). The files stay in the owner's planning folder
// (story-pipeline/prompt-table-source/en/) and are never copied into the repository: this script
// reads them when it runs and prints SQL. It connects to nothing and never calls a model.
//
//   node scripts/ai-features/import-pipeline-prompts.mjs <prompt-table-source/en>            # the SQL
//   node scripts/ai-features/import-pipeline-prompts.mjs <prompt-table-source/en> --dry-run  # then ROLLBACK
//   node scripts/ai-features/import-pipeline-prompts.mjs <prompt-table-source/en> --check    # read-only SELECT
//   node scripts/ai-features/import-pipeline-prompts.mjs --undo                              # the undo SQL
//
// Optional: --seed <registry-seed.json> checks that each row's prompt name in the seed is the file
// this script reads for it (PROMPT_FILES).
//
// Run it after supabase/migrations/20261202000000_ai_registry.sql. Each of the 12 keys gets version 1,
// active, with its category (pipeline or gate), only when the key has no row yet: after that the
// key's versions are made in the admin's prompt editor, and running the import again changes
// nothing. The app never reads these keys (get_active_prompts returns runtime keys only).
// The proposed prompts in prompt-table-source/proposed4/ are never read (AI-PROPOSED4-HOLD).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { quote } from "./seed.mjs";

/**
 * Each registry row → its prompt key, category, the file in prompt-table-source/en/ and the start
 * of the prompt name the seed gives it. The file is the seed name's step before "_" (S1, S2, S3,
 * S5, S6, S5c, S6c, S7, S4e); the two S4 notebooks are S4h (historical) and S4f (fictional), and
 * "scripts/deepseek_cards" is cards.md.
 */
export const PROMPT_FILES = [
  {
    id: "P-01",
    key: "p01_find_episodes",
    category: "pipeline",
    file: "S1.md",
    seedName: "S1_find-episodes",
  },
  {
    id: "P-02",
    key: "p02_select_stories",
    category: "pipeline",
    file: "S2.md",
    seedName: "S2_select-stories",
  },
  {
    id: "P-03",
    key: "p03_cut_source",
    category: "pipeline",
    file: "S3.md",
    seedName: "S3_cut-source",
  },
  {
    id: "P-04",
    key: "p04_plan_historical",
    category: "pipeline",
    file: "S4h.md",
    seedName: "S4_notebook-historical",
  },
  {
    id: "P-05",
    key: "p05_plan_fictional",
    category: "pipeline",
    file: "S4f.md",
    seedName: "S4_notebook-fictional",
  },
  {
    id: "P-06",
    key: "p06_merged_titles",
    category: "pipeline",
    file: "S4e.md",
    seedName: "S4e_merged-titles",
  },
  {
    id: "P-07",
    key: "p07_story_cards",
    category: "pipeline",
    file: "cards.md",
    seedName: "scripts/deepseek_cards",
  },
  {
    id: "G-01",
    key: "g01_judge_plan",
    category: "gate",
    file: "S5.md",
    seedName: "S5_judge-two-runs",
  },
  { id: "G-02", key: "g02_fix_plan", category: "gate", file: "S6.md", seedName: "S6_fix-entry" },
  {
    id: "G-03",
    key: "g03_judge_cards",
    category: "gate",
    file: "S5c.md",
    seedName: "S5c_judge-cards",
  },
  { id: "G-04", key: "g04_fix_cards", category: "gate", file: "S6c.md", seedName: "S6c_fix-cards" },
  {
    id: "G-05",
    key: "g05_simulated_user",
    category: "gate",
    file: "S7.md",
    seedName: "S7_simulated-user",
  },
];

/** The prompt editor's limit (PROMPT_BODY_MAX_LENGTH in src/lib/prompts/admin.ts). */
export const BODY_MAX_LENGTH = 20_000;

/**
 * @typedef {{ id: string, key: string, category: string, file: string, body: string,
 *   note: string, md5: string }} PipelinePrompt
 */

/**
 * Reads the 12 prompt files from a prompt-table-source/en folder. A folder inside proposed4 is
 * refused.
 * @param {string} folder
 * @param {{ seed?: unknown }} [options]
 * @returns {PipelinePrompt[]}
 */
export function readPipelinePrompts(folder, { seed } = {}) {
  const resolved = path.resolve(folder);
  if (resolved.split(path.sep).includes("proposed4")) {
    throw new Error("proposed4 is not imported (AI-PROPOSED4-HOLD)");
  }
  const seedRows = seed === undefined ? null : /** @type {{ rows?: unknown }} */ (seed).rows;
  if (seed !== undefined && !Array.isArray(seedRows)) throw new Error("the seed has no rows list");
  return PROMPT_FILES.map((entry) => {
    if (seedRows) {
      const row = seedRows.find((item) => item?.id === entry.id);
      if (!row) throw new Error(`the seed has no row ${entry.id}`);
      if (typeof row.prompt !== "string" || !row.prompt.startsWith(`${entry.seedName} `)) {
        throw new Error(
          `${entry.id}: the seed names the prompt "${row.prompt}", not ${entry.seedName} (${entry.file})`,
        );
      }
    }
    const body = readFileSync(path.join(resolved, entry.file), "utf8").replace(/\s+$/, "") + "\n";
    if (body.trim().length === 0) throw new Error(`${entry.file} is empty`);
    if (body.length > BODY_MAX_LENGTH) {
      throw new Error(`${entry.file} is longer than ${BODY_MAX_LENGTH} characters`);
    }
    return {
      id: entry.id,
      key: entry.key,
      category: entry.category,
      file: entry.file,
      body,
      note: `${entry.id}: imported from prompt-table-source/en/${entry.file}`,
      md5: createHash("md5").update(body, "utf8").digest("hex"),
    };
  });
}

/**
 * The SQL: one insert per key, skipped when the key has any row. With dryRun the transaction ends
 * in ROLLBACK after listing the keys.
 * @param {PipelinePrompt[]} prompts
 * @param {{ dryRun?: boolean }} [options]
 */
export function importPromptsSql(prompts, { dryRun = false } = {}) {
  const lines = [
    "-- Pipeline and Quality gate prompts from prompt-table-source/en (scripts/ai-features/import-pipeline-prompts.mjs, #473).",
    ...(dryRun ? ["-- DRY RUN: ends in ROLLBACK; nothing is kept."] : []),
    ...prompts.map(
      (prompt) =>
        `--   ${prompt.key} (${prompt.category}) from ${prompt.file}: ${prompt.body.length} characters, md5 ${prompt.md5}`,
    ),
    "begin;",
  ];
  for (const prompt of prompts) {
    lines.push(
      "insert into public.prompts (key, version, active, body, params, note, category)",
      `select '${prompt.key}', 1, true, ${quote(prompt.body)}, '{}'::jsonb, ${quote(prompt.note)}, '${prompt.category}'`,
      `where not exists (select 1 from public.prompts where key = '${prompt.key}');`,
    );
  }
  if (dryRun) {
    lines.push(
      "select key, version, active, category, char_length(body) as characters, md5(body) as md5",
      `from public.prompts where key in (${prompts.map((prompt) => `'${prompt.key}'`).join(", ")})`,
      "order by key, version;",
      "rollback;",
      "",
    );
  } else {
    lines.push("commit;", "");
  }
  return lines.join("\n");
}

/**
 * A read-only SELECT: for each key, its active version, category and whether the active text is
 * the file's text (by md5, so no prompt text is printed).
 * @param {PipelinePrompt[]} prompts
 */
export function importCheckSql(prompts) {
  return [
    "-- Read only: compares public.prompts with prompt-table-source/en (#473). Every row should say ok.",
    "with expected (key, category, md5) as (values",
    prompts
      .map((prompt) => `  ('${prompt.key}', '${prompt.category}', '${prompt.md5}')`)
      .join(",\n"),
    ")",
    "select e.key, p.version, p.category,",
    "  case",
    "    when p.key is null then 'missing or no active version'",
    "    when p.category <> e.category then 'different category'",
    "    when md5(p.body) <> e.md5 then 'active text differs from the file'",
    "    else 'ok'",
    "  end as result,",
    "  (select count(*) from public.prompts q where q.key = e.key) as versions",
    "from expected e",
    "left join public.prompts p on p.key = e.key and p.active",
    "order by e.key;",
    "",
  ].join("\n");
}

/**
 * The undo: removes every version of the 12 keys and their Publish history rows. None of the keys
 * existed before the import, so this is the state before it.
 */
export function importUndoSql() {
  const keys = PROMPT_FILES.map((entry) => `'${entry.key}'`).join(", ");
  return [
    "-- Undo of scripts/ai-features/import-pipeline-prompts.mjs (#473).",
    "begin;",
    `delete from public.publish_history where kind = 'prompt' and item_key in (${keys});`,
    `delete from public.prompts where key in (${keys});`,
    "commit;",
    "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const seedAt = args.indexOf("--seed");
  const seedFile = seedAt === -1 ? undefined : args[seedAt + 1];
  const rest =
    seedAt === -1 ? args : args.filter((_, index) => index !== seedAt && index !== seedAt + 1);
  const flags = rest.filter((arg) => arg.startsWith("--"));
  const folders = rest.filter((arg) => !arg.startsWith("--"));
  const unknown = flags.filter((flag) => !["--dry-run", "--check", "--undo"].includes(flag));
  if (
    unknown.length > 0 ||
    flags.length > 1 ||
    folders.length > 1 ||
    (seedAt !== -1 && !seedFile)
  ) {
    console.error(
      "Usage: node scripts/ai-features/import-pipeline-prompts.mjs <prompt-table-source/en> [--seed <registry-seed.json>] [--dry-run | --check] | --undo",
    );
    process.exit(2);
  }
  if (flags[0] === "--undo") {
    process.stdout.write(importUndoSql());
  } else {
    if (folders.length !== 1) {
      console.error("Name the folder: .../story-pipeline/prompt-table-source/en");
      process.exit(2);
    }
    const seed = seedFile ? JSON.parse(readFileSync(seedFile, "utf8")) : undefined;
    const prompts = readPipelinePrompts(folders[0], { seed });
    process.stdout.write(
      flags[0] === "--check"
        ? importCheckSql(prompts)
        : importPromptsSql(prompts, { dryRun: flags[0] === "--dry-run" }),
    );
  }
}
