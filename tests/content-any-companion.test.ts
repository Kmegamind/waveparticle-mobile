import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTENT_FILES,
  exportDocument,
  readContentRows,
  writeContentFiles,
} from "../scripts/content/content-files.mjs";
import { importSql } from "../scripts/content/import.mjs";
import { cardKey, readCompanionKeyCode, storyCardRows } from "../scripts/story-cards/import.mjs";

// #302: the content import works for any Companion. The second character's files are in the shape
// the book-to-story pipeline exports (`storydb.py export`): `<id>/stories.json`, `<id>/periods.json`
// and a companion entry, plus the stage 0 file of each story.

const root = path.join(import.meta.dirname, "..");
const temporary: string[] = [];

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const readJson = (directory: string, file: string) =>
  JSON.parse(readFileSync(path.join(directory, file), "utf8"));
const writeJson = (directory: string, file: string, value: unknown) => {
  mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
  writeFileSync(path.join(directory, file), `${JSON.stringify(value, null, 2)}\n`);
};

/** A story record exactly as `storydb.py export` writes it. */
function pipelineStory(id: string, sequence: number) {
  return {
    id,
    sequence,
    title: `The ${id} story`,
    date: "",
    goal: "Keep the letter from reaching the inspector.",
    facts: [
      { id: "take_the_letter.happened-1", taskId: "take_the_letter", text: "I took the letter." },
      { id: "burn_it.happened-1", taskId: "burn_it", text: "I burned it in the grate." },
    ],
    forbiddenTerms: ["Reichenbach"],
    keySlices: [
      {
        id: "take_the_letter",
        factIds: ["take_the_letter.happened-1"],
        keyLine: "",
        confirmed: false,
      },
    ],
    provenance: {
      entry: `characters/testchar/entries/${id}.plan.json`,
      keySlices: "added_later markers first, then the first tasks until there are two",
    },
  };
}

/** A stage 0 file with the three screen lines filled in (a person writes these). */
function stageZero(id: string) {
  return {
    story: {
      id,
      title: `The ${id} story`,
      date: "",
      place: "a study in London",
      goalShort: "I want the letter gone before morning.",
      forbidTerms: ["Reichenbach"],
    },
    who: "I'm a professor of mathematics with other interests.",
    whereNow: { s1: "I'm in my study, with a letter I should not have." },
  };
}

/** The seed plus a second character, "testchar", in a temporary folder. */
function seedWithSecondCharacter(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "any-companion-"));
  temporary.push(directory);
  cpSync(path.join(root, "src", "content"), path.join(directory, "src", "content"), {
    recursive: true,
  });
  cpSync(path.join(root, "docs", "demo"), path.join(directory, "docs", "demo"), {
    recursive: true,
  });
  const companions = readJson(directory, CONTENT_FILES.companions);
  // The pipeline's companion.json, with the key code a person adds (NAMING).
  companions.push({
    id: "testchar",
    name: "Professor Testchar",
    shortName: "Testchar",
    tags: "",
    line: "",
    portrait: "/companions/testchar.png",
    enterHref: null,
    mode: "fictional",
    keyCode: "tst",
  });
  writeJson(directory, CONTENT_FILES.companions, companions);
  writeJson(directory, "src/content/testchar/stories.json", [
    pipelineStory("tst-letter", 1),
    pipelineStory("tst-falls", 2),
  ]);
  writeJson(directory, "src/content/testchar/periods.json", [
    { name: "London", storyIds: ["tst-letter", "tst-falls"] },
  ]);
  for (const id of ["tst-letter", "tst-falls"]) {
    writeJson(directory, `docs/demo/${id}.stage0.json`, stageZero(id));
  }
  return directory;
}

describe("content import for any Companion (#302)", () => {
  it("test_302_ac1_reads_a_second_character_from_its_own_folder", () => {
    const rows = readContentRows(seedWithSecondCharacter());
    const testchar = rows.stories.filter((row) => row.companion_id === "testchar");
    expect(testchar.map((row) => row.id)).toEqual(["tst-letter", "tst-falls"]);
    expect(testchar[0]).toMatchObject({
      period: "London",
      goal_short: "I want the letter gone before morning.",
      who: "I'm a professor of mathematics with other interests.",
      opening: "I'm in my study, with a letter I should not have. What are you working on?",
    });
    expect(rows.stories.filter((row) => row.companion_id === "oppenheimer")).toHaveLength(26);
    expect(rows.storyInputs).toHaveLength(28);
  });

  it("test_302_ac7_imports_the_pipeline_shape_with_no_code_change", () => {
    const sql = importSql(readContentRows(seedWithSecondCharacter()));
    expect(sql.match(/insert into public\.companions /g)).toHaveLength(3);
    expect(sql.match(/insert into public\.stories /g)).toHaveLength(28);
    expect(sql).toMatch(/insert into public\.stories .*'tst-letter', 'testchar'/);
  });

  it("test_302_ac1_companion_option_prints_only_that_companions_stories", () => {
    const rows = readContentRows(seedWithSecondCharacter(), { companion: "testchar" });
    expect(rows.companions).toHaveLength(3);
    expect(rows.stories.map((row) => row.id)).toEqual(["tst-letter", "tst-falls"]);
    expect(rows.storyInputs.map((row) => row.story_id)).toEqual(["tst-letter", "tst-falls"]);
    expect(() => readContentRows(root, { companion: "nobody" })).toThrow(/nobody/);
  });

  it("test_302_ac3_a_story_without_its_screen_lines_stops_the_import_and_is_listed", () => {
    const directory = seedWithSecondCharacter();
    rmSync(path.join(directory, "docs/demo/tst-letter.stage0.json"));
    const falls = stageZero("tst-falls");
    falls.who = "";
    delete (falls.whereNow as { s1?: string }).s1;
    writeJson(directory, "docs/demo/tst-falls.stage0.json", falls);
    let message = "";
    try {
      readContentRows(directory);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/tst-letter: no docs\/demo\/tst-letter\.stage0\.json/);
    expect(message).toMatch(/tst-falls: no "Who I am" line \(who\), no opening place/);
    expect(message.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(2);
  });

  it("test_302_ac4_companions_carry_mode_and_key_code", () => {
    const rows = readContentRows(root);
    expect(
      rows.companions.map((row: { id: string; mode: string; key_code: string }) => [
        row.id,
        row.mode,
        row.key_code,
      ]),
    ).toEqual([
      ["oppenheimer", "historical", "opp"],
      ["moriarty", "fictional", "mor"],
    ]);
    const sql = importSql(rows);
    expect(sql).toMatch(/insert into public\.companions \(.*mode, key_code.*\)/);
  });

  it("test_302_ac4_a_companion_without_mode_or_key_code_is_refused_by_name", () => {
    const directory = seedWithSecondCharacter();
    const companions = readJson(directory, CONTENT_FILES.companions);
    delete companions[2].keyCode;
    companions[1].mode = "legend";
    writeJson(directory, CONTENT_FILES.companions, companions);
    expect(() => readContentRows(directory)).toThrow(/moriarty: mode/);
    companions[1].mode = "fictional";
    writeJson(directory, CONTENT_FILES.companions, companions);
    expect(() => readContentRows(directory)).toThrow(/testchar: keyCode/);
  });

  it("test_302_ac2_export_writes_each_companions_stories_to_its_own_folder", () => {
    const source = seedWithSecondCharacter();
    const target = mkdtempSync(path.join(tmpdir(), "any-companion-out-"));
    temporary.push(target);
    writeContentFiles(exportDocument(readContentRows(source)), target);
    for (const file of [
      CONTENT_FILES.companions,
      "src/content/testchar/stories.json",
      "src/content/testchar/periods.json",
      "src/content/oppenheimer/stories.json",
      "docs/demo/tst-letter.stage0.json",
    ]) {
      expect(readJson(target, file), file).toEqual(readJson(source, file));
    }
    // Unchanged data writes nothing.
    expect(writeContentFiles(exportDocument(readContentRows(source)), source)).toEqual([]);
  });

  it("test_302_ac5_story_card_keys_use_the_companions_key_code", () => {
    expect(readCompanionKeyCode("oppenheimer")).toBe("opp");
    expect(readCompanionKeyCode("moriarty")).toBe("mor");
    expect(cardKey("x", undefined, undefined, "mor")).toBe("crd.mor.x.bg");
    const deck = { x: { id: "x", background: "B.", parts: [] } };
    expect(storyCardRows(deck, ["x"], "mor").cards[0].key).toBe("crd.mor.x.bg");
  });
});
