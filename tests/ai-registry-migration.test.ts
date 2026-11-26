import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readActivePromptsFromSupabase } from "@/lib/prompts/repository";

// #473: the registry migration (20261202000000_ai_registry.sql). The shape is read from the SQL;
// the rows and role rules were also run against a Postgres build during development (see the PR).

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261202000000_ai_registry.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => readFileSync(path.join(migrations, MIGRATION), "utf8").replace(/--.*$/gm, "");
const fn = (name: string) => {
  const match = code().match(
    new RegExp(`create (?:or replace )?function ${name.replace(".", "\\.")}\\(`),
  );
  expect(match, name).not.toBeNull();
  const start = match!.index!;
  return code().slice(start, code().indexOf("$$;", code().indexOf("$$", start) + 2) + 3);
};
const table = (name: string) => {
  const start = code().indexOf(`create table public.${name} (`);
  expect(start, name).toBeGreaterThan(-1);
  return code().slice(start, code().indexOf(");\n", start));
};

describe("#473 the AI registry migration", () => {
  it("test_473_runs_after_the_ai_feature_migrations", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261201000000_ai_feature_people.sql"),
    );
  });

  it("test_473_extends_ai_features_and_adds_no_second_registry_table", () => {
    const sql = code();
    // AI-REGISTRY-STORE: no second registry table.
    expect(sql.match(/create table public\.(\w+)/g)).toEqual([
      "create table public.ai_feature_field_history",
      "create table public.ai_feature_example_history",
    ]);
    const alter = sql.slice(sql.indexOf("alter table public.ai_features"));
    expect(alter).toMatch(
      /add column feature_id text unique check \(feature_id ~ '\^\[PGR\]-\[0-9\]\{2\}\$'\)/,
    );
    expect(alter).toMatch(
      /add column category text not null default 'runtime'\s+check \(category in \('pipeline', 'gate', 'runtime'\)\)/,
    );
    for (const column of [
      "where_used",
      "requirement",
      "output_format",
      "design_rationale",
      "room_to_improve",
      "notes",
      "example_text",
    ]) {
      expect(alter, column).toMatch(new RegExp(`add column ${column} text not null default ''`));
    }
    expect(alter).toMatch(
      /add column example_state text not null default 'none'\s+check \(example_state in \('none', 'candidate', 'confirmed'\)\)/,
    );
    expect(alter).toMatch(
      /add column example_set_by uuid references auth\.users \(id\) on delete set null/,
    );
    expect(alter).toMatch(/add column example_set_at timestamptz/);
    expect(sql).toMatch(/alter column feature_id set not null/);
  });

  it("test_473_keeps_the_seven_runtime_rows_and_backfills_only_id_and_category", () => {
    const sql = code();
    // The only update of ai_features in the file outside the functions is the feature_id backfill.
    const outside = sql.replace(/\$\$[\s\S]*?\$\$/g, "");
    const updates = outside.match(/update public\.ai_features[\s\S]*?;/g) ?? [];
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/^update public\.ai_features\s+set feature_id = case slug/);
    for (const [slug, id] of [
      ["plan_split", "R-01"],
      ["step_cards", "R-02"],
      ["pause_message", "R-03"],
      ["rest_reply", "R-04"],
      ["return_popup", "R-05"],
      ["closing_line", "R-06"],
      ["safety_classifier", "R-07"],
    ]) {
      expect(updates[0]).toContain(`when '${slug}' then '${id}'`);
    }
    expect(outside).not.toMatch(/delete from public\.ai_features/);
    expect(outside).not.toMatch(/insert into public\.ai_features/);
    expect(outside).not.toMatch(/set (purpose|status|slug|title|position)\b/);
    // An unknown slug stops the migration instead of leaving a row without an id.
    expect(sql).toMatch(/if exists \(select 1 from public\.ai_features where feature_id is null\)/);
  });

  it("test_473_a_candidate_or_confirmed_example_needs_text", () => {
    expect(code()).toMatch(
      /add constraint ai_features_example_needs_text\s+check \(example_state = 'none' or btrim\(example_text\) <> ''\);/,
    );
    expect(fn("public.set_ai_feature_example")).toMatch(
      /if new_state <> 'none' and btrim\(new_text\) = '' then\s+raise exception [^;]*errcode = '22023';/,
    );
  });

  it("test_473_field_and_example_history_keep_who_when_and_the_values", () => {
    const fields = table("ai_feature_field_history");
    expect(fields).toMatch(
      /feature_slug text not null references public\.ai_features \(slug\) on delete cascade/,
    );
    expect(fields).toMatch(/old_value jsonb not null/);
    expect(fields).toMatch(/new_value jsonb not null/);
    expect(fields).toMatch(/changed_by uuid references auth\.users \(id\) on delete set null/);
    expect(fields).toMatch(/changed_at timestamptz not null default now\(\)/);
    const examples = table("ai_feature_example_history");
    expect(examples).toMatch(/example_state text not null check/);
    expect(examples).toMatch(/set_by uuid references auth\.users/);
    expect(examples).toMatch(/set_at timestamptz not null default now\(\)/);
  });

  it("test_473_rls_editors_read_the_new_tables_anon_and_no_role_read_nothing", () => {
    const sql = code();
    for (const name of ["ai_feature_field_history", "ai_feature_example_history"]) {
      expect(sql).toContain(`alter table public.${name} enable row level security;`);
      expect(sql).toContain(`revoke all on public.${name} from public, anon, authenticated;`);
      expect(sql).toContain(`grant select on public.${name} to authenticated;`);
      expect(sql).toMatch(
        new RegExp(
          `create policy ${name}_read on public\\.${name}\\s+for select\\s+to authenticated\\s+using \\(\\(select public\\.is_content_editor\\(\\)\\)\\);`,
        ),
      );
    }
    // No API role gets a write right on any table, and anon gets nothing.
    expect(sql).not.toMatch(/grant (insert|update|delete|all)/);
    expect(sql).not.toMatch(/grant [^;]* to anon/);
    expect(sql).not.toMatch(/create policy [^;]* for (insert|update|delete|all)/);
  });

  it("test_473_editors_save_fields_and_examples_with_history", () => {
    const save = fn("public.save_ai_feature_fields");
    expect(save).toMatch(/security definer/);
    expect(save).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(save).not.toMatch(/\bcategory\b|\bstatus\b/);
    for (const field of [
      "where_used",
      "requirement",
      "output_format",
      "design_rationale",
      "room_to_improve",
      "notes",
    ]) {
      expect(save, field).toContain(`private.record_ai_feature_field(target_feature, '${field}',`);
    }
    const example = fn("public.set_ai_feature_example");
    expect(example).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(example).toMatch(/insert into public\.ai_feature_example_history/);
    expect(example).toMatch(/example_set_by = auth\.uid\(\)/);
    const record = fn("private.record_ai_feature_field");
    expect(record).toMatch(/if old_value is distinct from new_value then/);
    expect(record).toMatch(/auth\.uid\(\)/);
    // FR-AIREG-7: sections (a) to (c) are kept in the history too.
    const sections = fn("public.save_ai_feature_sections");
    for (const field of ["purpose", "pass_questions", "approach"]) {
      expect(sections, field).toContain(
        `private.record_ai_feature_field(target_feature, '${field}'`,
      );
    }
  });

  it("test_473_only_an_admin_changes_the_category", () => {
    const category = fn("public.set_ai_feature_category");
    expect(category).toMatch(/security definer/);
    expect(category).toMatch(/if public\.content_role\(\) is distinct from 'admin' then/);
    expect(category).toMatch(/errcode = '42501'/);
    expect(category).toContain("private.record_ai_feature_field(target_feature, 'category',");
    const sql = code();
    expect(sql).toMatch(
      /revoke all on function public\.set_ai_feature_category\(text, text\) from public, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.set_ai_feature_category\(text, text\) to authenticated;/,
    );
    expect(sql).toMatch(
      /revoke all on function private\.record_ai_feature_field\(text, text, jsonb, jsonb\)\s+from public, anon, authenticated;/,
    );
  });

  it("test_473_prompts_get_a_category_and_the_app_reads_runtime_only", () => {
    const sql = code();
    expect(sql).toMatch(
      /alter table public\.prompts\s+add column category text not null default 'runtime'\s+check \(category in \('runtime', 'pipeline', 'gate'\)\);/,
    );
    const read = fn("public.get_active_prompts");
    expect(read).toMatch(/where p\.active\s+and p\.category = 'runtime'/);
    // The admin reads every key, with its category.
    const list = fn("public.list_prompt_versions");
    expect(list).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(list).toMatch(/p\.category/);
    expect(list).not.toMatch(/where/);
    // A draft keeps its key's category.
    expect(sql).toMatch(/create trigger prompts_keep_category\s+before insert on public\.prompts/);
  });

  it("test_473_the_app_prompt_reader_drops_a_non_runtime_key", async () => {
    const answer = [
      { key: "plan_split", version: 1, body: "b", params: {}, note: "" },
      { key: "p01_find_episodes", version: 1, body: "b", params: {}, note: "" },
    ];
    const rows = await readActivePromptsFromSupabase({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3198",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        PROMPTS_READ_TOKEN: "t",
      },
      fetchImpl: async () =>
        new Response(JSON.stringify(answer), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    expect(rows.map((row) => row.key)).toEqual(["plan_split"]);
  });
});
