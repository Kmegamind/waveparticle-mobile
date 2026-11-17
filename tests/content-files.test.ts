import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTENT_FILES,
  appDocument,
  exportDocument,
  readContentRows,
  writeContentFiles,
} from "../scripts/content/content-files.mjs";

// The story content seed (#284): the files the import loads and the export writes back.

const root = path.join(import.meta.dirname, "..");
const temporary: string[] = [];

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A copy of the seed files in a temporary folder, at the same relative paths. */
function copyOfSeed(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "story-content-"));
  temporary.push(directory);
  for (const file of seedFiles()) {
    cpSync(path.join(root, file), path.join(directory, file), { recursive: true });
  }
  return directory;
}

function seedFiles(): string[] {
  const stageZero = readdirSync(path.join(root, CONTENT_FILES.stageZeroDirectory))
    .filter((name) => name.endsWith(".stage0.json"))
    .map((name) => path.join(CONTENT_FILES.stageZeroDirectory, name));
  return [
    CONTENT_FILES.companions,
    CONTENT_FILES.stories("oppenheimer"),
    CONTENT_FILES.periods("oppenheimer"),
    ...stageZero,
  ];
}

/** True when some object in `value` has `key` with a value other than null. */
function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([name, inner]) => (name === key && inner !== null) || hasKey(inner, key),
  );
}

describe("story content seed (#284)", () => {
  it("test_284_reads_26_stories_and_two_companions_moriarty_without_stories", () => {
    const rows = readContentRows(root);
    expect(rows.companions.map((row: { id: string }) => row.id)).toEqual([
      "oppenheimer",
      "moriarty",
    ]);
    expect(rows.stories).toHaveLength(26);
    expect(rows.storyInputs).toHaveLength(26);
    expect(rows.stories.every((row) => row.companion_id === "oppenheimer")).toBe(true);
    expect(rows.stories.map((row) => row.sequence)).toEqual(
      Array.from({ length: 26 }, (_, index) => index + 1),
    );
    const moriarty = rows.companions.find((row: { id: string }) => row.id === "moriarty");
    expect(moriarty?.enter_href).toBeNull();
  });

  it("test_284_stores_the_text_each_screen_reads_under_the_screen_names", () => {
    const rows = readContentRows(root);
    const siteSearch = rows.stories.find((row) => row.id === "site-search");
    expect(siteSearch).toMatchObject({
      title: "The Canyon and the Mesa",
      goal_short: "I want the laboratory built where my people can live and work.",
      period: "The Manhattan Project years",
    });
    expect(siteSearch?.who).toMatch(/^I'm a physicist from Berkeley/);
    expect(siteSearch?.opening).toMatch(/ What are you working on\?$/);
    expect(Object.keys(siteSearch ?? {})).not.toContain("description");
  });

  it("test_284_keeps_each_display_text_once_not_also_inside_the_model_inputs", () => {
    const inputs = readContentRows(root).storyInputs.find((row) => row.story_id === "site-search");
    const stageZero = inputs?.stage_zero as Record<string, Record<string, unknown> | unknown>;
    expect(stageZero.who).toBeNull();
    expect((stageZero.story as Record<string, unknown>).goalShort).toBeNull();
    expect((stageZero.story as Record<string, unknown>).title).toBeNull();
    expect((stageZero.story as Record<string, unknown>).date).toBeNull();
    expect((stageZero.whereNow as Record<string, unknown>).s1).toBeNull();
    expect(inputs?.date).toBe("1942-11-16");
  });

  it("test_284_key_moments_are_stored_unconfirmed", () => {
    const rows = readContentRows(root);
    const moments = rows.storyInputs.flatMap((row) => row.key_moments as { confirmed: boolean }[]);
    expect(moments).toHaveLength(54);
    expect(moments.every((moment) => moment.confirmed === false)).toBe(true);
  });

  it("test_284_the_app_document_has_no_date_or_provenance", () => {
    const document = appDocument(readContentRows(root));
    expect(document.stories).toHaveLength(26);
    expect(hasKey(document, "date")).toBe(false);
    expect(hasKey(document, "provenance")).toBe(false);
    expect(JSON.stringify(document)).not.toMatch(/\b1[89]\d\d-\d\d-\d\d\b/);
    // The model inputs travel with each story for the server.
    expect(document.stories[0].inputs.facts.length).toBeGreaterThan(0);
  });

  it("test_284_round_trip_writes_no_file_when_nothing_changed", () => {
    const directory = copyOfSeed();
    const before = seedFiles().map((file) => statSync(path.join(directory, file)).mtimeMs);
    const written = writeContentFiles(exportDocument(readContentRows(root)), directory);
    expect(written).toEqual([]);
    expect(seedFiles().map((file) => statSync(path.join(directory, file)).mtimeMs)).toEqual(before);
  });

  it("test_284_round_trip_restores_every_file_as_the_same_json", () => {
    const directory = copyOfSeed();
    // An empty folder for the export: every file is written from the database rows alone.
    const target = mkdtempSync(path.join(tmpdir(), "story-content-out-"));
    temporary.push(target);
    const written = writeContentFiles(exportDocument(readContentRows(directory)), target);
    expect(written.sort()).toEqual(seedFiles().sort());
    for (const file of seedFiles()) {
      const original = JSON.parse(readFileSync(path.join(root, file), "utf8"));
      const exported = JSON.parse(readFileSync(path.join(target, file), "utf8"));
      expect(exported, file).toEqual(original);
    }
  });

  it("test_284_an_edit_in_the_database_is_written_to_its_file_only", () => {
    const directory = copyOfSeed();
    const document = exportDocument(readContentRows(root));
    const story = document.stories.find((row) => row.id === "trinity");
    if (!story) throw new Error("no trinity");
    story.goal_short = "An edited goal sentence.";
    const written = writeContentFiles(document, directory);
    expect(written).toEqual([path.join(CONTENT_FILES.stageZeroDirectory, "trinity.stage0.json")]);
    const file = JSON.parse(readFileSync(path.join(directory, written[0]), "utf8"));
    expect(file.story.goalShort).toBe("An edited goal sentence.");
  });
});

describe("story content export guards (#284 review)", () => {
  it("test_284_export_refuses_an_opening_without_the_question", () => {
    const document = exportDocument(readContentRows(root));
    document.stories[0].opening = "Los Alamos, late. What is on your mind?";
    expect(() => writeContentFiles(document, copyOfSeed())).toThrow(
      /bohr-difficulties: the opening must end with " What are you working on\?"/,
    );
  });

  // Changed by #302 (AC2): another Companion's story is no longer refused; it goes to its own folder.
  it("test_302_export_writes_another_companions_story_to_that_companions_folder", () => {
    const document = exportDocument(readContentRows(root));
    document.stories[0].companion_id = "moriarty";
    const written = writeContentFiles(document, copyOfSeed());
    expect(written).toContain(CONTENT_FILES.stories("moriarty"));
    expect(written).toContain(CONTENT_FILES.periods("moriarty"));
  });

  it("test_284_export_names_the_story_when_its_stage_zero_lost_a_part", () => {
    const document = exportDocument(readContentRows(root));
    delete (document.story_inputs[0].stage_zero as Record<string, unknown>).whereNow;
    expect(() => writeContentFiles(document, copyOfSeed())).toThrow(/stage_zero.*whereNow/);
  });
});
