import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  chosenSample,
  librarySamples,
  readSampleLibrary,
  wordCount,
  type ExcerptRow,
  type SampleRow,
} from "@/lib/ai-samples/library";

// #479 (AI-LAB-SAMPLES, AI-SOURCE-EXCERPTS, AI-SAMPLES-LOCAL): the sample library. The migration's
// shape is read from the SQL here; its role rules were also run on Postgres (PGlite) during
// development (see the pull request). Every sample text in this file is short and invented: no
// book text is ever committed.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const migrations = path.join(root, "supabase", "migrations");
const MIGRATION = "20261205000000_ai_samples.sql";
/** The SQL without comments, so a comment cannot satisfy a check. */
const code = () => read(`supabase/migrations/${MIGRATION}`).replace(/--.*$/gm, "");
const table = (name: string) => {
  const sql = code();
  const start = sql.indexOf(`create table public.${name} (`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf(");\n", start));
};
const script = path.join(root, "scripts", "ai-samples", "import-samples.mjs");

describe("#479 the sample library migration", () => {
  it("test_479_runs_after_the_run_log", () => {
    const names = readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(names).toContain(MIGRATION);
    expect(names.indexOf(MIGRATION)).toBeGreaterThan(names.indexOf("20261203000000_ai_runs.sql"));
  });

  it("test_479_ac1_excerpts_name_their_source_and_store_no_whole_book", () => {
    const excerpts = table("ai_source_excerpts");
    expect(excerpts).toMatch(
      /source_label text not null check \(char_length\(btrim\(source_label\)\) between 1 and 300\)/,
    );
    expect(excerpts).toMatch(/body text not null check \([^\n]*char_length\(body\) <= 50000\)/);
  });

  it("test_479_ac1_samples_hold_every_input_and_point_to_their_excerpt", () => {
    const samples = table("ai_samples");
    for (const column of [
      "name text not null",
      "companion text",
      "persona text not null",
      "source_excerpt_id text references public.ai_source_excerpts (id)",
      "background text not null",
      "facts jsonb not null",
      "world_record text not null",
      "standing_task text not null",
      "plan jsonb",
      "position integer not null check (position >= 1)",
    ]) {
      expect(samples, column).toContain(column);
    }
    expect(samples).not.toMatch(/on delete cascade/);
  });

  it("test_479_ac1_only_admin_and_writer_read_and_nobody_writes_through_the_api", () => {
    const sql = code();
    for (const name of ["ai_source_excerpts", "ai_samples"]) {
      expect(sql).toContain(`alter table public.${name} enable row level security;`);
      expect(sql).toContain(`revoke all on public.${name} from public, anon, authenticated;`);
      expect(sql).toContain(`grant select on public.${name} to authenticated;`);
      expect(sql).toMatch(
        new RegExp(
          `create policy \\w+ on public\\.${name}\\s+for select to authenticated\\s+using \\(\\(select public\\.is_content_editor\\(\\)\\)\\);`,
        ),
      );
    }
    // Only select is granted, to authenticated only; anon gets nothing; no write policy.
    expect(sql.match(/grant [^;]+;/g)).toEqual([
      "grant select on public.ai_source_excerpts to authenticated;",
      "grant select on public.ai_samples to authenticated;",
    ]);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/);
    expect(sql).not.toMatch(/security definer/);
  });

  it("test_479_ai_runs_sample_id_references_the_library_without_cascade", () => {
    expect(code()).toMatch(
      /alter table public\.ai_runs\s+add constraint ai_runs_sample_fk foreign key \(sample_id\) references public\.ai_samples \(id\);/,
    );
  });

  it("test_479_ac3_no_book_text_in_the_migration", () => {
    // Nothing is inserted by the migration: the rows come only from the owner's import.
    expect(code()).not.toMatch(/insert into/i);
  });
});

const sampleRow = (over: Partial<SampleRow> = {}): SampleRow => ({
  id: "invented-a",
  position: 1,
  name: "Invented A",
  companion: "Ada Tester",
  mode: "historical",
  persona: "Invented persona.",
  source_excerpt_id: "invented-a",
  background: "",
  facts: ["One invented fact."],
  world_record: "",
  standing_task: "",
  plan: { goal: "Invented goal.", aims: [{ title: "First", note: "Invented note." }] },
  ...over,
});
const excerpt: ExcerptRow = {
  id: "invented-a",
  source_label: "Invented notebook, page 2",
  body: "  Five   invented words here now. ",
};

describe("#479 the library as the page reads it", () => {
  it("test_479_ac2_orders_by_position_and_joins_the_excerpt_with_its_source", () => {
    const samples = librarySamples(
      [
        sampleRow({ id: "invented-b", position: 2, name: "B", source_excerpt_id: null }),
        sampleRow(),
      ],
      [excerpt],
    );
    expect(samples.map((sample) => sample.id)).toEqual(["invented-a", "invented-b"]);
    expect(samples[0]).toMatchObject({
      source: "Invented notebook, page 2",
      excerpt: excerpt.body,
      words: 5,
      facts: ["One invented fact."],
      plan: { goal: "Invented goal.", aims: [{ title: "First", note: "Invented note." }] },
    });
    expect(samples[1]).toMatchObject({ source: null, excerpt: null, words: null });
  });

  it("test_479_tolerates_odd_facts_and_plans", () => {
    const [sample] = librarySamples(
      [sampleRow({ facts: { not: "a list" }, plan: { aims: "no" } })],
      [],
    );
    expect(sample.facts).toEqual([]);
    expect(sample.plan).toBeNull();
    expect(sample.source).toBeNull();
  });

  it("test_479_counts_words", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("one")).toBe(1);
    expect(wordCount("one two\nthree\tfour")).toBe(4);
  });

  it("test_479_reads_both_tables_through_the_users_client_and_null_on_error", async () => {
    const calls: string[] = [];
    const ok = await readSampleLibrary(async (name, order) => {
      calls.push(`${name}:${order}`);
      return { data: name === "ai_samples" ? [sampleRow()] : [excerpt], error: null };
    });
    expect(calls.sort()).toEqual(["ai_samples:position", "ai_source_excerpts:id"]);
    expect(ok?.[0].source).toBe("Invented notebook, page 2");

    expect(
      await readSampleLibrary(async (name) => ({
        data: null,
        error: name === "ai_source_excerpts" ? { message: "no" } : null,
      })),
    ).toBeNull();
    expect(
      await readSampleLibrary(async () => {
        throw new Error("down");
      }),
    ).toBeNull();
  });

  it("test_479_ac2_the_chosen_sample_is_the_named_one_or_the_first", () => {
    const samples = librarySamples([sampleRow(), sampleRow({ id: "invented-b", position: 2 })], []);
    expect(chosenSample(samples, "invented-b")?.id).toBe("invented-b");
    expect(chosenSample(samples, "nope")?.id).toBe("invented-a");
    expect(chosenSample(samples, ["invented-b"])?.id).toBe("invented-a");
    expect(chosenSample([], undefined)).toBeNull();
  });

  it("test_479_ac2_the_page_reads_through_the_users_client_and_has_no_dead_button", () => {
    const page = read("src/app/admin/ai-samples/page.tsx");
    expect(page).toContain("createSupabaseServerClient");
    expect(page).not.toMatch(/service_role|SERVICE_ROLE/);
    // "Add a finished story as a sample" waits for an owner decision: no button without a feature.
    expect(page).not.toMatch(/<button/);
    expect(page).toContain('"Not written yet"');
  });

  it("test_479_ac2_the_menu_has_samples_in_ai_rules", () => {
    const shell = read("src/app/admin/admin-shell.tsx");
    const group = shell.slice(shell.indexOf('heading: "AI rules"'));
    expect(
      group.indexOf('{ href: "/admin/ai-samples", id: "AIR-6", label: "Samples" }'),
    ).toBeGreaterThan(group.indexOf('label: "AI features"'));
    expect(read("src/app/admin/styles.ts")).toContain('import "./ai-samples/ai-samples.css";');
  });
});

describe("#479 the import script (AI-SAMPLES-LOCAL)", () => {
  const work = mkdtempSync(path.join(tmpdir(), "wp-479-"));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  const invented = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    name: `Invented ${id}`,
    companion: "Ada Tester",
    mode: "fictional",
    persona: "An invented persona with a quote ' and $sample$ inside.",
    source_label: "Invented notebook, page 3",
    source_excerpt: `Invented excerpt text for ${id}.`,
    background: "",
    facts: ["Invented fact one.", "Invented fact two."],
    world_record: "",
    standing_task: "Invented standing task.",
    plan: { goal: "Invented goal.", aims: [{ title: "Invented aim", note: "Invented note." }] },
    _import_note: "Not stored.",
    ...over,
  });

  const folder = (name: string, files: Record<string, unknown>) => {
    const dir = path.join(work, name);
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(path.join(dir, file), JSON.stringify(content));
    }
    return dir;
  };

  const run = (...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });

  const gitStatus = () =>
    spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout;

  it("test_479_ac3_prints_sql_from_a_folder_given_on_the_command_line_and_writes_nothing", () => {
    const dir = folder("good", {
      "b.json": invented("invented-b"),
      "a.json": invented("invented-a"),
      "notes.txt": "ignored",
    });
    const before = gitStatus();
    const filesBefore = readdirSync(dir).sort();
    const result = run(dir);
    expect(result.status, result.stderr).toBe(0);
    expect(gitStatus()).toBe(before);
    expect(readdirSync(dir).sort()).toEqual(filesBefore);

    const sql = result.stdout;
    expect(sql).toMatch(/^-- The sample library/);
    expect(sql).toContain("begin;");
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    // File name order is the library's order.
    expect(sql.indexOf("values ('invented-a', 1,")).toBeGreaterThan(-1);
    expect(sql.indexOf("values ('invented-b', 2,")).toBeGreaterThan(-1);
    expect(sql).toContain("insert into public.ai_source_excerpts (id, source_label, body)");
    expect(sql).toContain("on conflict (id) do update");
    // A text that holds the quote tag gets another one.
    expect(sql).toContain(
      "$sample_1$An invented persona with a quote ' and $sample$ inside.$sample_1$",
    );
    expect(sql).not.toContain("Not stored.");
  });

  it("test_479_ac3_the_folder_is_an_argument_never_a_path_in_the_code", () => {
    const text = read("scripts/ai-samples/import-samples.mjs");
    expect(text).not.toMatch(/\/Users\/|Documents|2_Areas/);
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
    expect(result.stdout).toBe("");
  });

  it("test_479_ac3_dry_run_ends_in_rollback_check_prints_no_text_undo_deletes", () => {
    const dir = folder("modes", { "a.json": invented("invented-a") });
    const dry = run(dir, "--dry-run");
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("DRY RUN");
    expect(dry.stdout.trimEnd().endsWith("rollback;")).toBe(true);
    expect(dry.stdout).not.toContain("commit;");

    const check = run(dir, "--check");
    expect(check.status).toBe(0);
    expect(check.stdout).toContain("'ok'");
    expect(check.stdout).not.toContain("Invented excerpt text");
    expect(check.stdout).not.toContain("Invented notebook");
    expect(check.stdout).not.toMatch(/insert|update|delete/i);

    const undo = run(dir, "--undo");
    expect(undo.status).toBe(0);
    expect(undo.stdout).toContain("delete from public.ai_samples where id in ('invented-a');");
    expect(undo.stdout).toContain(
      "delete from public.ai_source_excerpts where id in ('invented-a');",
    );
  });

  it("test_479_ac3_refuses_a_folder_inside_the_repository_or_proposed4", () => {
    const inside = run(path.join(root, "tests", "fixtures"));
    expect(inside.status).toBe(1);
    expect(inside.stderr).toContain("outside the repository");
    const held = folder(path.join("story", "proposed4"), { "a.json": invented("invented-a") });
    const proposed = run(held);
    expect(proposed.status).toBe(1);
    expect(proposed.stderr).toContain("proposed4");
    expect(proposed.stdout).toBe("");
  });

  it("test_479_ac1_refuses_an_excerpt_without_its_source_named_and_bad_shapes", () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ["nosource", { source_label: "" }, "needs its source named"],
      ["badid", { id: "Not A Slug" }, "is not a slug"],
      ["badmode", { mode: "poem" }, "historical or fictional"],
      ["badfacts", { facts: "one" }, "facts is a list"],
      ["extra", { surprise: "x" }, "unknown field surprise"],
      ["long", { source_excerpt: "x".repeat(50_001) }, "longer than 50000"],
    ];
    for (const [name, over, message] of cases) {
      const result = run(folder(name, { "a.json": invented("invented-a", over) }));
      expect(result.status, name).toBe(1);
      expect(result.stderr, name).toContain(message);
      expect(result.stdout, name).toBe("");
    }
    const twice = run(
      folder("twice", { "a.json": invented("invented-a"), "b.json": invented("invented-a") }),
    );
    expect(twice.stderr).toContain("two files have the id invented-a");
  });

  it("test_479_ac3_no_sample_file_is_committed", () => {
    const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .stdout.split("\n")
      .filter((file) => file.endsWith(".json"));
    for (const file of tracked) {
      const text = read(file);
      expect(
        /"source_excerpt"\s*:/.test(text) && /"persona"\s*:/.test(text),
        `${file} looks like a sample file`,
      ).toBe(false);
    }
  });
});
