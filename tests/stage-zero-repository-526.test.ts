import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

// #533 review I2: a story switched over to the owner's regenerated stage 0 is marked
// outsideRepository and switchedOver. The repository's content export never writes its new stage 0
// to docs/demo (the text stays out of git), and the content import never overwrites its inputs
// (the PGlite test runs that against a switched story). Invented text only.

const root = path.join(import.meta.dirname, "..");
const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function copyOfContent(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "story-content-526-"));
  temporary.push(directory);
  for (const folder of ["src/content", CONTENT_FILES.stageZeroDirectory]) {
    cpSync(path.join(root, folder), path.join(directory, folder), { recursive: true });
  }
  return directory;
}

type Inputs = { story_id: string; stage_zero: Record<string, unknown>; provenance: object };

describe("#533 review I2 a switched story stays out of the repository's files", () => {
  it("test_533_i2_the_export_keeps_the_placeholder_stage_0_file_of_a_switched_story", () => {
    const directory = copyOfContent();
    const story = "trinity";
    const file = path.join(CONTENT_FILES.stageZeroDirectory, `${story}.stage0.json`);
    const before = readFileSync(path.join(directory, file), "utf8");
    const document = exportDocument(readContentRows(root));
    const inputs = (document.story_inputs as Inputs[]).find((row) => row.story_id === story)!;
    inputs.stage_zero.slices = [{ id: "s1", leaks: ["Inventaleakexport"] }];
    inputs.provenance = {
      ...inputs.provenance,
      outsideRepository: true,
      switchedOver: "repository",
    };
    const written = writeContentFiles(document, directory);
    // Nothing changes: the stage 0 file keeps the placeholder, the record keeps its provenance.
    expect(written).toEqual([]);
    expect(readFileSync(path.join(directory, file), "utf8")).toBe(before);
    const records = JSON.parse(
      readFileSync(path.join(directory, CONTENT_FILES.stories("oppenheimer")), "utf8"),
    ) as { id: string; provenance: Record<string, unknown> }[];
    const record = records.find((row) => row.id === story)!;
    expect(record.provenance.outsideRepository).toBeUndefined();
    expect(record.provenance.switchedOver).toBeUndefined();
  });

  it("test_533_i2_the_content_import_never_writes_over_inputs_kept_outside_the_repository", () => {
    const sql = importSql(readContentRows(root));
    const inputs = sql.split("\n").filter((line) => line.includes("public.story_inputs"));
    expect(inputs.length).toBeGreaterThan(0);
    for (const line of sql.split(";\n").filter((part) => part.includes("public.story_inputs ("))) {
      expect(line).toMatch(
        /where coalesce\(public\.story_inputs\.provenance::jsonb ->> 'outsideRepository', ''\) <> 'true'/,
      );
    }
  });

  it("test_533_r2_i1_a_story_outside_the_repository_before_its_switch_is_not_exported", () => {
    const directory = copyOfContent();
    const document = exportDocument(readContentRows(root));
    // An invented #502 story of another Companion (no src/content folder), switched over.
    const template = document.stories.find((row: { id: string }) => row.id === "trinity")!;
    const inputsOf = (document.story_inputs as Inputs[]).find((row) => row.story_id === "trinity")!;
    document.stories.push({
      ...template,
      id: "inv-outside-story",
      companion_id: "moriarty",
      sequence: 1,
    });
    document.story_inputs.push({
      ...structuredClone(inputsOf),
      story_id: "inv-outside-story",
      provenance: {
        note: "Invented draft import.",
        outsideRepository: true,
        switchedOver: "outside",
      },
    });
    const written = writeContentFiles(document, directory);
    expect(written).toEqual([]);
    expect(existsSync(path.join(directory, CONTENT_FILES.stories("moriarty")))).toBe(false);
    // The content import still prints, for every Companion.
    const sql = importSql(readContentRows(directory));
    expect(sql).toContain("insert into public.story_inputs");
    expect(sql).not.toContain("inv-outside-story");
  });
});
