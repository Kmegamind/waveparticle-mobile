import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #309: Companion and story fields edited in the admin, with draft, publish and roll back
// (database side). The SQL is checked as text: there is no database in the test run.

const root = path.join(import.meta.dirname, "..");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261124000000_content_fields.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => readFileSync(path.join(migrations, MIGRATION), "utf8").replace(/--.*$/gm, "");
const fn = (name: string) => {
  const match = code().match(
    new RegExp(`create (or replace )?function ${name.replace(".", "\\.")}\\(`),
  );
  expect(match, name).not.toBeNull();
  const start = match!.index!;
  return code().slice(start, code().indexOf("$$;", start));
};

describe("content fields migration (#309)", () => {
  it("test_309_runs_after_the_story_card_editing_migration", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(
      names.indexOf("20261123000000_story_card_editing.sql"),
    );
  });

  it("test_309_adds_the_two_new_fields_and_the_versions_table", () => {
    expect(code()).toMatch(
      /alter table public\.companions\s+add column who text not null default ''/,
    );
    expect(code()).toMatch(/alter table public\.stories\s+add column path text not null default ''/);
    expect(code()).toMatch(/create table public\.content_fields \(/);
    expect(code()).toMatch(/primary key \(key, version\)/);
    expect(code()).toMatch(/body text not null check \(body ~ '\\S'\) check \(char_length\(body\) <= 1000\)/);
    expect(code()).toMatch(
      /create unique index content_fields_one_published_per_key\s+on public\.content_fields \(key\) where published/,
    );
    // Editors only read it; nobody writes through the table.
    expect(code()).toMatch(/alter table public\.content_fields enable row level security/);
    expect(code()).toMatch(/revoke all on public\.content_fields from public, anon, authenticated/);
    expect(code()).toMatch(
      /for select\s+to authenticated\s+using \(\(select public\.is_content_editor\(\)\)\)/,
    );
    expect(code()).not.toMatch(/grant (insert|update|delete)[^;]*content_fields/);
  });

  it("test_309_ac1_a_save_adds_a_draft_and_never_touches_the_column_the_app_reads", () => {
    const save = fn("public.save_content_field_draft");
    expect(save).toMatch(/returns integer/);
    expect(save).toMatch(/security definer/);
    expect(save).toMatch(/if not public\.is_content_editor\(\) then/);
    expect(save).toMatch(/pg_advisory_xact_lock\(hashtext\('content_field:' \|\| field_key\)\)/);
    // The first save keeps the imported text as version 1, published, when it is not blank.
    expect(save).toMatch(/current_body ~ '\\S'/);
    expect(save).toMatch(/values \(field_key, 1, [^)]*current_body, true, now\(\)/);
    // The draft itself: not published.
    expect(save).toMatch(/insert into public\.content_fields \([^)]*\)\s+values \([^;]*field_body[^;]*\);/);
    expect(save).not.toMatch(/update public\.(companions|stories)/);
    expect(save).not.toMatch(/apply_content_field/);
  });

  it("test_309_ac3_only_the_admin_role_publishes_or_rolls_back", () => {
    for (const name of ["public.publish_content_field", "public.roll_back_content_field"]) {
      const body = fn(name);
      expect(body, name).toMatch(/security definer/);
      expect(body, name).toMatch(
        /if public\.content_role\(\) is distinct from 'admin' then\s+raise exception '[^']+' using errcode = '42501'/,
      );
    }
    expect(fn("public.publish_content_field")).toMatch(
      /private\.set_published_content_field\(field_key, field_version, 'publish'\)/,
    );
    expect(fn("public.roll_back_content_field")).toMatch(
      /private\.set_published_content_field\(field_key, field_version, 'roll_back'\)/,
    );
    expect(code()).toMatch(
      /grant execute on function public\.publish_content_field\(text, integer\) to authenticated/,
    );
  });

  it("test_309_ac4_publish_writes_the_column_and_a_history_row_in_one_transaction", () => {
    const set = fn("private.set_published_content_field");
    expect(set).toMatch(/for update/);
    expect(set).toMatch(/private\.content_field_problem\(/);
    expect(set).toMatch(/private\.apply_content_field\(/);
    expect(set).toMatch(
      /insert into public\.publish_history \(kind, item_key, version, action, acted_by\)/,
    );
    expect(set).toMatch(/'companion_field'/);
    expect(set).toMatch(/'story_field'/);
    expect(set).toMatch(/auth\.uid\(\)/);
    const apply = fn("private.apply_content_field");
    for (const column of ["name", "tags", "who", "title", "goal_short", "opening", "path", "period"]) {
      expect(apply, column).toMatch(new RegExp(`set ${column} = field_body`));
    }
    // A period name renames every story of that period.
    expect(apply).toMatch(/private\.story_periods\(companion\)/);
  });

  it("test_309_ac2_the_database_re_checks_the_period_rules", () => {
    const problem = fn("private.content_field_problem");
    // A story's own period or a neighbour's, never out of a period it is alone in.
    expect(problem).toMatch(/lag\(/);
    expect(problem).toMatch(/lead\(/);
    expect(problem).toMatch(/size > 1/);
    // A period name no other period has.
    expect(problem).toMatch(/period_number <> /);
    const periods = fn("private.story_periods");
    expect(periods).toMatch(/order by s\.sequence/);
  });

  it("test_309_ac5_the_history_takes_the_two_new_kinds", () => {
    expect(code()).toMatch(
      /add constraint publish_history_kind_check check \(kind in \('app_text', 'story_card', 'companion_field', 'story_field'\)\)/,
    );
    const list = fn("public.list_publish_history");
    expect(list).toMatch(/when 'story_card' then exists/);
    for (const kind of ["companion_field", "story_field"]) {
      expect(list, kind).toMatch(
        new RegExp(`when '${kind}' then exists \\(\\s+select 1 from public\\.content_fields f`),
      );
    }
  });

  it("test_309_ac1_get_story_content_is_unchanged", () => {
    expect(code()).not.toMatch(/function public\.get_story_content/);
  });
});
