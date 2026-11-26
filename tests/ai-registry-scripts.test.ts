import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOK_TEXT_EXAMPLES,
  NEW_SLUGS,
  parseRegistrySeed,
  readRegistrySeed,
  registryCheckSql,
  registrySeedSql,
  registrySlug,
  registryUndoSql,
  RUNTIME_SLUGS,
} from "../scripts/ai-features/registry-seed.mjs";
import {
  importCheckSql,
  importPromptsSql,
  importUndoSql,
  PROMPT_FILES,
  readPipelinePrompts,
} from "../scripts/ai-features/import-pipeline-prompts.mjs";
import { readFeatureSeed, seedSql } from "../scripts/ai-features/seed.mjs";

// #473: the registry seed and the pipeline prompt import print SQL from the owner's files, which
// stay outside the repository. These tests use invented fixtures (tests/fixtures/ai-registry):
// the seed's shape with made-up text, and 12 short made-up prompt files.

const root = path.join(import.meta.dirname, "..");
const fixtures = path.join(root, "tests", "fixtures", "ai-registry");
const SEED = path.join(fixtures, "registry-seed.json");
const EN = path.join(fixtures, "en");
const seedScript = path.join(root, "scripts", "ai-features", "registry-seed.mjs");
const importScript = path.join(root, "scripts", "ai-features", "import-pipeline-prompts.mjs");
const run = (script: string, ...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

describe("#473 the registry seed", () => {
  it("test_473_nineteen_rows_with_ids_slugs_categories_and_positions", () => {
    const rows = readRegistrySeed(SEED);
    expect(rows).toHaveLength(19);
    const added = rows.filter((row) => row.category !== "runtime");
    expect(added.map((row) => row.slug)).toEqual(NEW_SLUGS);
    expect(added.map((row) => row.position)).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(added.find((row) => row.feature_id === "P-04")).toMatchObject({
      slug: "p04_plan_historical",
      category: "pipeline",
      title: "Plan (historical) (p04_plan_historical)",
    });
    expect(added.find((row) => row.feature_id === "G-05")?.category).toBe("gate");
    const runtime = rows.filter((row) => row.category === "runtime");
    expect(Object.fromEntries(runtime.map((row) => [row.feature_id, row.slug]))).toEqual(
      RUNTIME_SLUGS,
    );
    expect(registrySlug("P-01", "Find episodes")).toBe("p01_find_episodes");
  });

  it("test_473_an_example_state_is_stored_only_with_its_text", () => {
    const rows = readRegistrySeed(SEED);
    for (const row of rows) {
      if (row.example_text === "") expect(row.example_state, row.feature_id).toBe("none");
    }
    const state = Object.fromEntries(rows.map((row) => [row.feature_id, row.example_state]));
    // Book text left out (P-04 was confirmed in the seed), and no example in the seed (G-03).
    expect(state).toMatchObject({ "P-04": "none", "R-02": "none", "G-03": "none" });
    expect(state).toMatchObject({ "P-02": "confirmed", "R-07": "candidate" });
    // The dry-run header still says what the seed had.
    expect(run(seedScript, SEED, "--dry-run").stdout).toContain(
      "P-04 p04_plan_historical: pipeline, frozen, example none (seed: confirmed, no text stored)",
    );
    const sql = registrySeedSql(rows);
    expect(sql).toContain("$seed$Plan (historical) (p04_plan_historical)$seed$");
    expect(sql).toMatch(/'p04_plan_historical'[^\n]*, '', 'none'\)$/m);
  });

  it("test_473_the_436_seed_writes_the_registry_columns_the_migration_requires", () => {
    // On a fresh database (new project, db reset) the #436 seed runs after this migration, which
    // makes feature_id required and drops the category default. Its SQL must name both, and still
    // run on a database that does not have them yet (the order of docs/deploy.md).
    const migration = readFileSync(
      path.join(root, "supabase", "migrations", "20261202000000_ai_registry.sql"),
      "utf8",
    ).replace(/--.*$/gm, "");
    const required = [
      ...migration.matchAll(/alter column (\w+) set not null/g),
      ...migration.matchAll(/alter column (\w+) drop default/g),
    ].map((match) => match[1]);
    expect(required.sort()).toEqual(["category", "feature_id"]);
    const sql = seedSql(readFeatureSeed());
    const block = sql.slice(sql.indexOf("do $seed_block$"), sql.lastIndexOf("$seed_block$;"));
    const [withRegistry, without] = block.split(/^else$/m);
    expect(withRegistry).toMatch(
      /where table_schema = 'public' and table_name = 'ai_features' and column_name = 'feature_id'/,
    );
    const columns = [...withRegistry.matchAll(/^insert into public\.ai_features \(([^)]*)\)$/gm)];
    expect(columns).toHaveLength(7);
    for (const [, list] of columns) {
      for (const column of required) expect(list.split(", ")).toContain(column);
    }
    const ids = [...withRegistry.matchAll(/'([a-z_]+)', \d+, [\s\S]*?'(R-0\d)', 'runtime'\)$/gm)];
    expect(Object.fromEntries(ids.map(([, slug, id]) => [id, slug]))).toEqual(RUNTIME_SLUGS);
    expect(
      without.match(
        /^insert into public\.ai_features \(slug, position, title, prompt_keys, purpose, pass_questions, approach, status\)$/gm,
      ),
    ).toHaveLength(7);
    // The registry seed fills these rows afterwards; it never inserts them.
    expect(registrySeedSql(readRegistrySeed(SEED))).not.toMatch(
      /insert into public\.ai_features \(slug, feature_id, category, position, title, prompt_keys, status, [^)]*\)\nvalues \('plan_split'/,
    );
  });

  it("test_473_new_rows_take_the_seed_status", () => {
    const rows = readRegistrySeed(SEED);
    const status = Object.fromEntries(rows.map((row) => [row.feature_id, row.status]));
    expect(status).toMatchObject({
      "P-03": "passed",
      "P-04": "frozen",
      "G-03": "not_started",
      "G-04": "not_started",
      "P-01": "exploring",
    });
  });

  it("test_473_examples_that_quote_book_text_are_left_empty", () => {
    expect(BOOK_TEXT_EXAMPLES).toEqual([
      "P-04",
      "P-05",
      "P-06",
      "P-07",
      "R-02",
      "R-03",
      "R-04",
      "R-05",
      "R-06",
    ]);
    const rows = readRegistrySeed(SEED);
    for (const row of rows) {
      if (BOOK_TEXT_EXAMPLES.includes(row.feature_id)) expect(row.example_text).toBe("");
    }
    expect(rows.find((row) => row.feature_id === "R-07")?.example_text).toBe(
      "Invented example for R-07.",
    );
    // The fixture puts a marker in every book-text example: none reaches the SQL.
    const sql = registrySeedSql(rows);
    expect(sql).not.toContain("BOOKLINE");
    expect(readFileSync(SEED, "utf8")).toContain("BOOKLINE");
  });

  it("test_473_sql_inserts_new_rows_and_fills_only_empty_runtime_fields", () => {
    const sql = registrySeedSql(readRegistrySeed(SEED));
    expect(sql.match(/^insert into public\.ai_features/gm)).toHaveLength(12);
    expect(sql.match(/^on conflict \(slug\) do nothing;$/gm)).toHaveLength(12);
    expect(sql.match(/^update public\.ai_features$/gm)).toHaveLength(7);
    expect(sql).toContain(
      "requirement = case when requirement = '' then $seed$Invented requirement for R-01.$seed$ else requirement end",
    );
    // The runtime rows keep purpose, status, title and slug: the update never sets them.
    const updates = sql.split("update public.ai_features").slice(1).join("");
    expect(updates).not.toMatch(/\b(purpose|status|title|position|pass_questions|approach) =/);
    expect(sql).not.toMatch(/ai_feature_status_history|ai_feature_field_history/);
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });

  it("test_473_dry_run_ends_in_rollback_and_check_is_read_only", () => {
    const dry = run(seedScript, SEED, "--dry-run");
    expect(dry.status).toBe(0);
    expect(dry.stdout.trim().endsWith("rollback;")).toBe(true);
    expect(dry.stdout).not.toContain("commit;");
    const check = registryCheckSql(readRegistrySeed(SEED));
    expect(check).toMatch(/^select|^with/m);
    expect(check).not.toMatch(/\b(insert|update|delete|alter|drop|create)\b/i);
    expect(run(seedScript, SEED, "--check").stdout).toBe(check);
  });

  it("test_473_undo_removes_the_new_rows_and_empties_unedited_runtime_fields", () => {
    const undo = registryUndoSql();
    expect(undo).toContain(
      `delete from public.ai_features where slug in (${NEW_SLUGS.map((slug) => `'${slug}'`).join(", ")});`,
    );
    expect(undo).toMatch(
      /where slug in \('plan_split'[^)]*\) and fields_updated_at is null and example_set_at is null;/,
    );
    expect(undo).not.toMatch(/\b(purpose|status) =/);
    expect(run(seedScript, "--undo").stdout).toBe(undo);
  });

  it("test_473_a_bad_seed_is_refused", () => {
    const seed = JSON.parse(readFileSync(SEED, "utf8"));
    const broken = (change: (rows: Record<string, unknown>[]) => void) => {
      const copy = structuredClone(seed);
      change(copy.rows);
      return () => parseRegistrySeed(copy);
    };
    expect(broken((rows) => (rows[0].status = "done"))).toThrow(/unknown status/);
    expect(broken((rows) => (rows[0].category = "Runtime"))).toThrow(/id letter/);
    expect(broken((rows) => (rows[1].id = "P-01"))).toThrow(/share/);
    expect(broken((rows) => rows.pop())).toThrow(/no row R-07/);
    expect(broken((rows) => (rows[0].name = "Something else"))).toThrow(/not one of the 12/);
    expect(run(seedScript).status).toBe(2);
  });
});

describe("#473 the pipeline prompt import", () => {
  it("test_473_twelve_keys_from_the_mapped_files_with_their_category", () => {
    const seed = JSON.parse(readFileSync(SEED, "utf8"));
    const prompts = readPipelinePrompts(EN, { seed });
    expect(prompts.map((prompt) => [prompt.id, prompt.key, prompt.category, prompt.file])).toEqual(
      PROMPT_FILES.map((entry) => [entry.id, entry.key, entry.category, entry.file]),
    );
    expect(prompts.map((prompt) => prompt.key)).toEqual(NEW_SLUGS);
    expect(new Set(prompts.map((prompt) => prompt.category))).toEqual(
      new Set(["pipeline", "gate"]),
    );
    expect(PROMPT_FILES.find((entry) => entry.id === "P-04")?.file).toBe("S4h.md");
    expect(PROMPT_FILES.find((entry) => entry.id === "P-05")?.file).toBe("S4f.md");
    expect(PROMPT_FILES.find((entry) => entry.id === "P-07")?.file).toBe("cards.md");
  });

  it("test_473_the_seed_must_name_the_file_the_import_reads", () => {
    const seed = JSON.parse(readFileSync(SEED, "utf8"));
    seed.rows[3].prompt = "S4_notebook-fictional v3.5";
    expect(() => readPipelinePrompts(EN, { seed })).toThrow(/P-04/);
  });

  it("test_473_proposed4_is_never_imported", () => {
    expect(() => readPipelinePrompts(path.join(fixtures, "proposed4"))).toThrow(/proposed4/);
    const sql = importPromptsSql(readPipelinePrompts(EN));
    expect(sql).not.toContain("proposed4/");
  });

  it("test_473_sql_inserts_version_1_active_only_when_the_key_is_missing", () => {
    const sql = importPromptsSql(readPipelinePrompts(EN));
    expect(
      sql.match(
        /^insert into public\.prompts \(key, version, active, body, params, note, category\)$/gm,
      ),
    ).toHaveLength(12);
    expect(sql).toContain("select 'p01_find_episodes', 1, true, ");
    expect(sql).toContain(
      "where not exists (select 1 from public.prompts where key = 'p01_find_episodes');",
    );
    expect(sql).toMatch(/'g05_simulated_user', 1, true, [\s\S]*?'gate'\n/);
    // A body holding the default dollar quote marker is still quoted safely.
    expect(sql).toContain("$seed_1$# Invented prompt S1");
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });

  it("test_473_dry_run_check_and_undo", () => {
    const dry = run(importScript, EN, "--dry-run");
    expect(dry.status).toBe(0);
    expect(dry.stdout.trim().endsWith("rollback;")).toBe(true);
    const check = importCheckSql(readPipelinePrompts(EN));
    expect(check).not.toMatch(/\b(insert|update|delete|alter|drop|create)\b/i);
    expect(check).not.toContain("Invented prompt");
    expect(run(importScript, EN, "--check").stdout).toBe(check);
    const undo = importUndoSql();
    expect(undo).toContain("delete from public.prompts where key in ('p01_find_episodes'");
    expect(undo).toContain(
      "delete from public.publish_history where kind = 'prompt' and item_key in (",
    );
    expect(undo).not.toMatch(/'plan_split'|'step_cards'|'rest_reply'/);
    expect(run(importScript, "--undo").stdout).toBe(undo);
    expect(run(importScript, "--seed").status).toBe(2);
  });
});
