import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { quote, sourceTextMatches } from "../scripts/content/import-drafts.mjs";
import {
  contentFilesOf,
  exportDocument,
  readContentRows,
} from "../scripts/content/content-files.mjs";

// #502: a Companion's stories, parts and cards imported as DRAFTS from the owner's export folder,
// which stays outside the repository. Every story and card text in this file is short and
// invented: no text of the owner's files is ever committed (the repository is public).

const root = path.join(import.meta.dirname, "..");
const script = path.join(root, "scripts", "content", "import-drafts.mjs");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

type Json = Record<string, unknown>;
const repoCompanion = () =>
  (JSON.parse(read("src/content/companions.json")) as Json[]).find((row) => row.id === "snape")!;

const STORIES = ["inv-first-door", "inv-second-room"];

/** An invented export folder in the pipeline's shape (export/app and export/<id>). */
function exportFolder(base: string, change: (files: Record<string, unknown>) => void = () => {}) {
  const companion = repoCompanion();
  const cards = (story: string) => [
    {
      key: `crd.snp.${story}.bg`,
      kind: "background",
      part: null,
      slice: null,
      position: 1,
      body: `Invented background for ${story}, with a quote ' and $draft$ inside.`,
    },
    ...[1, 2, 3, 4, 5].flatMap((part) =>
      [1, 2].map((position) => ({
        key: `crd.snp.${story}.p${part}.c${position}`,
        kind: "part",
        part,
        slice: `s${part}`,
        position,
        body: `Invented card ${position} of part ${part} in ${story}.`,
      })),
    ),
  ];
  const files: Record<string, unknown> = {
    "app/companion.json": {
      id: "snape",
      name: companion.name,
      shortName: companion.shortName,
      tags: companion.tags,
      line: companion.line,
      portrait: "/companions/snape.png",
      enterHref: "/companions/snape",
      mode: "fictional",
      keyCode: "snp",
    },
    "app/parts_and_cards.json": {
      key_code: "snp",
      stories: STORIES.map((story) => ({
        id: story,
        title: `Invented title ${story}`,
        goal: "Invented goal.",
        parts: [1, 2, 3, 4, 5].map((part) => ({ part, title: `Invented aim ${part}` })),
        merged_titles: [{ from: 1, to: 2, title: "Invented merged title" }],
        cards: cards(story),
      })),
    },
    "app/stories.json": STORIES.map((story, index) => ({
      id: story,
      sequence: index + 1,
      title: `Invented title ${story}`,
      date: "1900",
      goal: "Invented goal.",
      facts: [{ id: `${story}-f1`, taskId: "invented_task", text: "Invented fact." }],
      forbiddenTerms: ["inventedword"],
      keySlices: [
        {
          id: "invented_task",
          factIds: [`${story}-f1`],
          keyLine: "I did an invented thing.",
          confirmed: true,
        },
      ],
      provenance: { entry: "invented/entry.json" },
    })),
    "snape/periods.json": [
      { name: "Invented period one", storyIds: [STORIES[0]] },
      { name: "Invented period two", storyIds: [STORIES[1]] },
    ],
  };
  for (const story of STORIES) {
    files[`app/stage0/${story}.stage0.json`] = {
      story: {
        id: story,
        title: `Invented title ${story}`,
        goalShort: `Invented goal sentence for ${story}.`,
        goalFull: "Invented full goal.",
      },
      who: `Invented who line for ${story}.`,
      whereNow: { s1: `Invented place for ${story}.` },
      _note: "Invented note.",
    };
  }
  change(files);
  rmSync(base, { recursive: true, force: true });
  for (const [file, content] of Object.entries(files)) {
    if (content === undefined) continue;
    mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
    writeFileSync(path.join(base, file), JSON.stringify(content));
  }
  return base;
}

const work = mkdtempSync(path.join(tmpdir(), "wp-502-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));
const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
const gitStatus = () =>
  spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout;

/** The SQL a statement list holds for one table. */
const inserts = (sql: string, table: string) =>
  sql
    .split(";\n")
    .filter((statement) => statement.trimStart().startsWith(`insert into public.${table} `));

describe("#502 the draft import script prints SQL and connects to nothing", () => {
  it("test_502_ac1_prints_the_stories_parts_and_cards_as_drafts_and_writes_nothing", () => {
    const dir = exportFolder(path.join(work, "good"));
    const before = gitStatus();
    const result = run(dir);
    expect(result.status, result.stderr).toBe(0);
    expect(gitStatus()).toBe(before);
    const sql = result.stdout;
    expect(sql).toMatch(/^-- Draft import/);
    expect(sql).toMatch(/^begin;$/m);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);

    expect(inserts(sql, "stories")).toHaveLength(2);
    expect(inserts(sql, "story_inputs")).toHaveLength(2);
    expect(inserts(sql, "story_parts")).toHaveLength(10);
    const cards = inserts(sql, "story_cards");
    expect(cards).toHaveLength(22);
    for (const card of cards) {
      // Version 1, never published, no published_at.
      expect(card).toMatch(/, false, null, null\)/);
    }
    expect(sql).not.toMatch(/published = true|, true, now\(\)/);
    // The quote tag of a text that holds it changes, so no text can close it early.
    expect(sql).toContain(
      "$draft_1$Invented background for inv-first-door, with a quote ' and $draft$ inside.$draft_1$",
    );
  });

  it("test_502_ac3_the_companion_cannot_be_entered_and_the_screen_lines_are_drafts", () => {
    const sql = run(exportFolder(path.join(work, "screen"))).stdout;
    const [companion] = inserts(sql, "companions");
    // The export's enterHref is ignored: the repository's null wins (users do not see Snape yet).
    expect(companion).toMatch(/'snape', 3, /);
    expect(companion).toContain("enter_href = null");
    expect(companion).not.toContain("/companions/snape'");
    // The stories' screen lines stay empty ("Not written yet") until an admin publishes the drafts.
    for (const story of inserts(sql, "stories")) {
      expect(story).toMatch(/, '', '', ''\)/);
    }
    const fields = inserts(sql, "content_fields");
    expect(fields).toHaveLength(6);
    for (const field of fields) expect(field).toMatch(/, false, null, null\)/);
    expect(sql).toContain("'snp.inv-first-door.goal'");
    expect(sql).toContain("'snp.inv-first-door.who'");
    expect(sql).toContain(
      "'snp.inv-first-door.opening', 1, 'snape', 'inv-first-door', 'opening', $draft$Invented place for inv-first-door. What are you working on?$draft$",
    );
    // Key moments stay unconfirmed (KEY-UNCONFIRMED); the export never comes back into the files.
    const [inputs] = inserts(sql, "story_inputs");
    expect(inputs).toContain('"confirmed":false');
    expect(inputs).not.toContain('"confirmed":true');
    expect(inputs).toContain('"outsideRepository":true');
    expect(inputs).toContain('"who":null');
    // Merged titles are for the plan page (out of scope) and are not stored.
    expect(sql).not.toContain("Invented merged title");
  });

  it("test_502_ac1_a_slice_is_the_part_s_part", () => {
    const sql = run(exportFolder(path.join(work, "slice"))).stdout;
    expect(sql).toContain(
      "'crd.snp.inv-first-door.p3.c2', 1, 'inv-first-door', 'part', 3, 's3', 2,",
    );
    const wrong = run(
      exportFolder(path.join(work, "wrong-slice"), (files) => {
        const data = files["app/parts_and_cards.json"] as { stories: { cards: Json[] }[] };
        data.stories[0].cards[3].slice = "s9";
      }),
    );
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toContain("slice s9 is not s2");
    expect(wrong.stdout).toBe("");
  });

  it("test_502_ac1_running_again_refuses_once_anything_is_published", () => {
    const sql = run(exportFolder(path.join(work, "guard"))).stdout;
    // A guard before any write: published cards or fields, or a story id of another Companion.
    const guard = sql.indexOf("do $guard$");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(sql.indexOf("insert into"));
    expect(guard).toBeLessThan(sql.indexOf("delete from"));
    // The same published condition as the undo, for cards and fields alike (review M3).
    expect(sql).toMatch(/c\.published or c\.published_at is not null/);
    expect(sql).toMatch(/f\.published or f\.published_at is not null/);
    expect(sql).toMatch(/companion_id <> 'snape'/);
  });

  it("test_502_fix1_a_rerun_removes_this_companions_drafts_the_export_no_longer_has", () => {
    // The export shrinks between runs: the second story and the second card of part 5 go.
    const shrunk = run(
      exportFolder(path.join(work, "shrunk"), (files) => {
        files["app/stories.json"] = (files["app/stories.json"] as Json[]).slice(0, 1);
        files["app/stage0/inv-second-room.stage0.json"] = undefined;
        files["snape/periods.json"] = [{ name: "Invented period one", storyIds: [STORIES[0]] }];
        const data = files["app/parts_and_cards.json"] as { stories: { cards: Json[] }[] };
        data.stories = data.stories.slice(0, 1);
        data.stories[0].cards = data.stories[0].cards.filter(
          (card) => card.key !== "crd.snp.inv-first-door.p5.c2",
        );
      }),
    );
    expect(shrunk.status, shrunk.stderr).toBe(0);
    const sql = shrunk.stdout;
    // Comment lines left out, so each statement starts with its own verb.
    const statements = sql.replace(/^--.*\n/gm, "").split(";\n");
    const deletes = statements.filter((statement) =>
      statement.trimStart().startsWith("delete from"),
    );
    // Every removal is scoped to this Companion; the guard has already stopped a published row.
    expect(deletes).toHaveLength(3);
    for (const statement of deletes) expect(statement).toContain("companion_id = 'snape'");
    const [stories, parts, cards] = deletes;
    expect(stories).toContain(
      "delete from public.stories where companion_id = 'snape' and id not in ('inv-first-door')",
    );
    expect(parts).toContain(
      "not in ('inv-first-door.p1', 'inv-first-door.p2', 'inv-first-door.p3', 'inv-first-door.p4', 'inv-first-door.p5')",
    );
    expect(cards).toContain("k.key not in (");
    expect(cards).not.toContain("'crd.snp.inv-first-door.p5.c2'");
    expect(cards).toContain("'crd.snp.inv-first-door.p5.c1'");
    expect(cards).not.toContain("inv-second-room");
    // Removals come before the writes, after the guard.
    expect(sql.indexOf("delete from")).toBeLessThan(sql.indexOf("insert into"));
  });

  it("test_502_fix1_dry_run_lists_what_the_run_adds_changes_and_removes", () => {
    const dry = run(exportFolder(path.join(work, "dry")), "--dry-run");
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.stdout).toContain("DRY RUN");
    expect(dry.stdout.trimEnd().endsWith("rollback;")).toBe(true);
    expect(dry.stdout).not.toMatch(/^commit;$/m);
    // A snapshot of this Companion's rows before any write, compared with them after the run.
    const snapshot = dry.stdout.indexOf("create temporary table draft_import_before");
    expect(snapshot).toBeGreaterThan(dry.stdout.indexOf("$guard$;"));
    expect(snapshot).toBeLessThan(dry.stdout.indexOf("delete from"));
    for (const column of ["added", "changed", "removed", "unchanged"]) {
      expect(dry.stdout).toMatch(new RegExp(`as ${column}`));
    }
    expect(dry.stdout).toContain("full join draft_import_before");
  });

  it("test_502_ac1_check_compares_by_md5_both_ways_and_prints_no_text", () => {
    const check = run(exportFolder(path.join(work, "check")), "--check");
    expect(check.status, check.stderr).toBe(0);
    expect(check.stdout).toContain("'ok'");
    expect(check.stdout).toMatch(/md5\(/);
    expect(check.stdout).not.toContain("Invented");
    expect(check.stdout).not.toMatch(/\b(insert|update|delete|begin|commit)\b/i);
    // Every card, part and draft field of the file is compared ...
    expect(check.stdout.match(/\('card', /g)).toHaveLength(22);
    expect(check.stdout.match(/\('part', /g)).toHaveLength(10);
    expect(check.stdout.match(/\('field', /g)).toHaveLength(6);
    // ... and every row of this Companion in the database, so a row the file lost is reported.
    expect(check.stdout).toContain("full join stored");
    expect(check.stdout).toContain("'only in the database, not in the file'");
    expect(check.stdout).toMatch(
      /from public\.story_cards k join public\.stories s on s\.id = k\.story_id where s\.companion_id = 'snape'/,
    );
    // A published field differs, as a published card does (review M2).
    expect(check.stdout).toMatch(/f\.published or f\.published_at is not null then 'published'/);
  });

  it("test_502_fix1_undo_removes_every_story_of_the_companion_and_keeps_his_row", () => {
    const undo = run(exportFolder(path.join(work, "undo")), "--undo");
    expect(undo.status, undo.stderr).toBe(0);
    const sql = undo.stdout;
    expect(sql).not.toContain("Invented");
    const guard = sql.indexOf("raise exception");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(sql.indexOf("delete from"));
    expect(sql).toMatch(/c\.published or c\.published_at is not null/);
    // Every story of his, not only the ids of the current export.
    expect(sql).toContain("delete from public.stories where companion_id = 'snape';");
    expect(sql).not.toMatch(/id in \(/);
    // His Companion row stays: it may have been there before the run.
    expect(sql).not.toMatch(/delete from public\.companions/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("test_502_ac1_the_quote_tag_never_closes_early", () => {
    const unquote = (sql: string) => {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql)?.[0] ?? "";
      const close = sql.indexOf(tag, tag.length);
      expect(close + tag.length, sql).toBe(sql.length);
      return sql.slice(tag.length, close);
    };
    for (const text of [
      "",
      "Invented.",
      "ends in $draft",
      "has $draft$ in",
      "$draft_1$ and $draft",
      "$",
    ]) {
      expect(unquote(quote(text)), text).toBe(text);
    }
  });
});

describe("#502 the import refuses folders in the repository and gaps it would have to invent", () => {
  it("test_502_refuses_a_folder_inside_the_repository_and_needs_one_folder", () => {
    const inside = run(path.join(root, "tests", "fixtures"));
    expect(inside.status).toBe(1);
    expect(inside.stderr).toContain("outside the repository");
    const none = run();
    expect(none.status).toBe(2);
    expect(none.stderr).toContain("Usage:");
    expect(read("scripts/content/import-drafts.mjs")).not.toMatch(/\/Users\/|Documents|2_Areas/);
  });

  it("test_502_fix2_refuses_a_link_into_the_repository_and_a_different_letter_case", () => {
    // A symbolic link outside the repository that points into it.
    const link = path.join(work, "link-into-repo");
    symlinkSync(path.join(root, "tests", "fixtures"), link);
    const linked = run(link);
    expect(linked.status).toBe(1);
    expect(linked.stderr).toContain("outside the repository");
    // A link to a real export folder outside the repository is fine.
    const real = exportFolder(path.join(work, "real-export"));
    const outside = path.join(work, "link-outside");
    symlinkSync(real, outside);
    expect(run(outside).status).toBe(0);
    // The same folder in other letters, on a disk that ignores case (macOS by default).
    const upper = path.join(root, "tests", "fixtures").toUpperCase();
    const caseless = existsSync(upper);
    const cased = run(upper);
    expect(cased.status).toBe(1);
    expect(cased.stderr).toContain(caseless ? "outside the repository" : "no folder");
    expect(cased.stdout).toBe("");
  });

  it("test_502_ac5_refuses_to_run_when_a_gap_would_have_to_be_invented", () => {
    type Files = Record<string, unknown>;
    const stories = (files: Files) => files["app/stories.json"] as Json[];
    const decks = (files: Files) =>
      (files["app/parts_and_cards.json"] as { stories: { parts: Json[]; cards: Json[] }[] })
        .stories;
    const cases: [string, (files: Files) => void, string][] = [
      ["no-line", (f) => ((f["app/companion.json"] as Json).line = ""), "line"],
      [
        "no-stage0",
        (f) => (f["app/stage0/inv-first-door.stage0.json"] = undefined),
        "no stage 0 file",
      ],
      ["no-who", (f) => ((f["app/stage0/inv-first-door.stage0.json"] as Json).who = " "), "who"],
      [
        "no-place",
        (f) => ((f["app/stage0/inv-second-room.stage0.json"] as Json).whereNow = {}),
        "whereNow.s1",
      ],
      [
        "no-goal",
        (f) =>
          (((f["app/stage0/inv-first-door.stage0.json"] as Json).story as Json).goalShort = ""),
        "goalShort",
      ],
      ["no-key-line", (f) => ((stories(f)[1].keySlices as Json[])[0].keyLine = ""), "keyLine"],
      [
        "no-period",
        (f) =>
          (f["snape/periods.json"] = [{ name: "Invented period", storyIds: ["inv-first-door"] }]),
        "no period",
      ],
      ["no-part-title", (f) => (decks(f)[0].parts[2].title = ""), "part 3 has no title"],
      [
        "no-background",
        (f) => (decks(f)[0].cards = decks(f)[0].cards.filter((card) => card.kind !== "background")),
        "no background card",
      ],
      [
        "empty-part",
        (f) => (decks(f)[1].cards = decks(f)[1].cards.filter((card) => card.part !== 4)),
        "part 4 has no card",
      ],
      ["wrong-key", (f) => (decks(f)[0].cards[1].key = "crd.snp.inv-first-door.p1.c7"), "key"],
      ["empty-card", (f) => (decks(f)[0].cards[2].body = ""), "empty"],
      ["long-card", (f) => (decks(f)[0].cards[2].body = "x".repeat(2001)), "2000"],
      ["other-code", (f) => ((f["app/companion.json"] as Json).keyCode = "sev"), "keyCode"],
      [
        "other-name",
        (f) => ((f["app/companion.json"] as Json).name = "Invented Name"),
        "name differs",
      ],
      ["unknown", (f) => ((f["app/companion.json"] as Json).id = "nobody"), "companions.json"],
      [
        "story-sets-differ",
        (f) => (f["app/stories.json"] = stories(f).slice(0, 1)),
        "inv-second-room",
      ],
    ];
    for (const [name, change, message] of cases) {
      const result = run(exportFolder(path.join(work, name), change));
      expect(result.status, `${name}: ${result.stderr}`).toBe(1);
      expect(result.stderr, name).toContain(message);
      expect(result.stdout, name).toBe("");
    }
  });
});

describe("#502 AC4 no text of the owner's files in the changed files", () => {
  it("test_502_ac4_finds_40_character_windows_and_skips_the_allowed_companion_fields", () => {
    const source = [
      "An invented card text that is long enough to have several windows.",
      "The allowed companion line, which may be committed on purpose here.",
    ];
    const allowed = ["The allowed companion line, which may be committed on purpose here."];
    const clean = { "a.ts": "nothing from the source", "b.json": allowed[0] };
    expect(sourceTextMatches(source, clean, allowed)).toEqual([]);
    const leaked = { "c.md": `prefix ${source[0].slice(10, 55)} suffix` };
    expect(sourceTextMatches(source, leaked, allowed)).toEqual(["c.md"]);
    // Spacing and line breaks do not hide a match.
    const wrapped = { "d.md": source[0].slice(0, 50).replace(/ /g, "\n  ") };
    expect(sourceTextMatches(source, wrapped, allowed)).toEqual(["d.md"]);
  });

  it("test_502_ac4_no_tracked_file_holds_a_draft_export", () => {
    const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .stdout.split("\n")
      .filter((file) => file.endsWith(".json"));
    for (const file of tracked) {
      const text = read(file);
      expect(/"merged_titles"\s*:/.test(text), `${file} looks like parts_and_cards.json`).toBe(
        false,
      );
    }
    expect(tracked.some((file) => /src\/content\/snape\//.test(file))).toBe(false);
    expect(tracked.some((file) => /docs\/demo\/ch\d+-/.test(file))).toBe(false);
  });
});

describe("#502 the content export never writes a draft-imported story into the repository", () => {
  it("test_502_ac4_export_skips_stories_stored_outside_the_repository", () => {
    const rows = readContentRows(root);
    const document = exportDocument(rows) as {
      companions: Json[];
      stories: Json[];
      story_inputs: Json[];
    };
    document.stories.push({
      id: "inv-first-door",
      companion_id: "snape",
      sequence: 1,
      title: "Invented title",
      period: "Invented period",
      goal_short: "",
      who: "",
      opening: "",
    });
    document.story_inputs.push({
      story_id: "inv-first-door",
      date: "",
      goal: "Invented goal.",
      facts: [],
      forbidden_terms: [],
      key_moments: [],
      provenance: { outsideRepository: true },
      stage_zero: { story: {}, whereNow: {} },
    });
    const files = [...contentFilesOf(document).keys()];
    expect(files.some((file) => file.includes("snape"))).toBe(false);
    expect(files.some((file) => file.includes("inv-first-door"))).toBe(false);
    expect(files).toContain(path.join("src", "content", "oppenheimer", "stories.json"));
  });
});
