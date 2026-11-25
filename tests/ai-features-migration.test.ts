import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #436 AC1: the tables of the AI feature pages (AI-PAGE-STORE, AI-PAGE-RUNS, AI-PAGE-STATUS) and
// their row level security. Content editors read; nobody writes a table through the API; the
// sections are saved by content editors, and the status is changed by the admin role only (a
// writer is refused), with a history row in the same function.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261130000000_ai_features.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => readFileSync(path.join(migrations, MIGRATION), "utf8").replace(/--.*$/gm, "");
const fn = (name: string) => {
  const match = code().match(new RegExp(`create function ${name.replace(".", "\\.")}\\(`));
  expect(match, name).not.toBeNull();
  const start = match!.index!;
  return code().slice(start, code().indexOf("$$;", start));
};
const table = (name: string) => {
  const start = code().indexOf(`create table public.${name} (`);
  expect(start, name).toBeGreaterThan(-1);
  return code().slice(start, code().indexOf(");\n", start));
};
const TABLES = ["ai_features", "ai_feature_status_history", "ai_feature_test_runs"];

describe("AI feature tables migration (#436)", () => {
  it("test_436_runs_after_every_earlier_migration", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261129000000_research_conditions.sql"),
    );
    // It uses the role functions of #287.
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261116000000_content_roles.sql"),
    );
  });

  it("test_436_ac1_feature_rows_keyed_by_slug_with_title_keys_and_sections", () => {
    const features = table("ai_features");
    expect(features).toMatch(/slug text primary key check \(slug ~ '\^\[a-z\]\[a-z0-9_\]\*\$'\)/);
    expect(features).toMatch(/title text not null/);
    expect(features).toMatch(
      /prompt_keys text\[\] not null check \(private\.ai_feature_keys_valid\(prompt_keys\)\)/,
    );
    for (const section of ["purpose", "pass_questions", "approach"]) {
      expect(features, section).toMatch(
        new RegExp(
          `${section} jsonb not null default '\\[\\]'::jsonb\\s+check \\(private\\.ai_feature_items_valid\\(${section}\\)\\)`,
        ),
      );
    }
    // The prompt text is never copied here (AI-PAGE-STORE): no body column.
    expect(features).not.toMatch(/\bbody\b/);
  });

  it("test_436_ac1_each_item_keeps_its_text_source_and_draft_flag", () => {
    const items = fn("private.ai_feature_items_valid");
    expect(items).toMatch(/immutable/);
    expect(items).toMatch(/jsonb_typeof\(items\) <> 'array'/);
    expect(items).toMatch(/k\.name not in \('text', 'source', 'draft'\)/);
    expect(items).toMatch(/jsonb_typeof\(item -> 'text'\) is distinct from 'string'/);
    expect(items).toMatch(/jsonb_typeof\(item -> 'source'\) not in \('string', 'null'\)/);
    expect(items).toMatch(/jsonb_typeof\(item -> 'draft'\) is distinct from 'boolean'/);
  });

  it("test_436_ac1_status_is_one_of_four_and_starts_as_exploring", () => {
    expect(table("ai_features")).toMatch(
      /status text not null default 'exploring'\s+check \(status in \('not_started', 'exploring', 'passed', 'frozen'\)\)/,
    );
  });

  it("test_436_ac1_history_keeps_who_when_from_to_and_a_note", () => {
    const history = table("ai_feature_status_history");
    expect(history).toMatch(
      /feature_slug text not null references public\.ai_features \(slug\) on delete cascade/,
    );
    expect(history).toMatch(/from_status text not null/);
    expect(history).toMatch(/to_status text not null/);
    expect(history).toMatch(/note text/);
    expect(history).toMatch(/changed_by uuid references auth\.users \(id\) on delete set null/);
    expect(history).toMatch(/changed_at timestamptz not null default now\(\)/);
  });

  it("test_436_ac1_test_runs_have_kind_fake_model_or_real_and_the_counts", () => {
    const runs = table("ai_feature_test_runs");
    expect(runs).toMatch(/kind text not null check \(kind in \('fake_model', 'real'\)\)/);
    for (const column of [
      /prompt_key text not null/,
      /run_at timestamptz not null/,
      /prompt_version integer/,
      /pass_count integer not null/,
      /fail_count integer not null/,
      /summary text not null/,
      /report_path text not null/,
    ]) {
      expect(runs).toMatch(column);
    }
    expect(runs).toMatch(/unique \(feature_slug, prompt_key, kind, run_at\)/);
  });

  it("test_436_ac1_row_level_security_content_editors_read_and_nobody_writes_through_the_api", () => {
    for (const name of TABLES) {
      expect(code(), name).toMatch(
        new RegExp(`alter table public\\.${name} enable row level security;`),
      );
      expect(code(), name).toMatch(
        new RegExp(`revoke all on public\\.${name} from public, anon, authenticated;`),
      );
      expect(code(), name).toMatch(
        new RegExp(`grant select on public\\.${name} to authenticated;`),
      );
      expect(code(), name).toMatch(
        new RegExp(
          `create policy ${name}_read on public\\.${name}\\s+for select\\s+to authenticated\\s+using \\(\\(select public\\.is_content_editor\\(\\)\\)\\);`,
        ),
      );
    }
    // No insert, update or delete right and no other policy on any of the three tables.
    expect(code()).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on public\.ai_/);
    expect(code().match(/create policy/g)).toHaveLength(3);
    expect(code()).not.toMatch(/create policy \w+ on public\.\w+\s+for (insert|update|delete|all)/);
  });

  it("test_436_ac1_a_writer_cannot_change_a_status_only_an_admin", () => {
    const set = fn("public.set_ai_feature_status");
    expect(set).toMatch(/security definer/);
    expect(set).toMatch(/set search_path = ''/);
    // The admin check comes first: a writer ('writer'), no role (null) and no session are refused.
    const check = set.indexOf("if public.content_role() is distinct from 'admin' then");
    expect(check).toBeGreaterThan(-1);
    expect(set.indexOf("update public.ai_features")).toBeGreaterThan(check);
    expect(set).toMatch(/errcode = '42501'/);
    expect(set).not.toMatch(/is_content_editor/);
    expect(code()).toMatch(
      /revoke all on function public\.set_ai_feature_status\(text, text, text\) from public, anon, authenticated;/,
    );
    expect(code()).toMatch(
      /grant execute on function public\.set_ai_feature_status\(text, text, text\) to authenticated;/,
    );
  });

  it("test_436_ac1_a_status_change_writes_its_history_row_in_the_same_function", () => {
    const set = fn("public.set_ai_feature_status");
    expect(set).toMatch(/from public\.ai_features\s+where slug = target_feature\s+for update;/);
    expect(set).toMatch(
      /update public\.ai_features set status = new_status where slug = target_feature;/,
    );
    expect(set).toMatch(
      /insert into public\.ai_feature_status_history \(feature_slug, from_status, to_status, note, changed_by\)\s+values \(target_feature, old_status, new_status, nullif\(btrim\(change_note\), ''\), auth\.uid\(\)\);/,
    );
    expect(set).toMatch(/if old_status = new_status then/);
  });

  it("test_436_ac1_editors_save_the_sections_but_never_the_status", () => {
    const save = fn("public.save_ai_feature_sections");
    expect(save).toMatch(/security definer/);
    expect(save).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(save).toMatch(/errcode = '42501'/);
    expect(save).not.toMatch(/\bstatus\b/);
    expect(save).toMatch(/sections_updated_by = auth\.uid\(\)/);
    expect(code()).toMatch(
      /grant execute on function public\.save_ai_feature_sections\(text, jsonb, jsonb, jsonb\)\s+to authenticated;/,
    );
  });

  it("test_436_the_migration_seeds_nothing_and_leaves_other_tables_alone", () => {
    // The rows come from scripts/ai-features/seed.mjs (a human step), not from this file.
    expect(code()).not.toMatch(/insert into public\.ai_features/);
    expect(code()).not.toMatch(/public\.prompts|public\.publish_history/);
  });
});
