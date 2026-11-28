import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANION } from "@/app/_session/companion";
import { DEFAULT_COMPANION_ID } from "@/lib/content/companions";
import { parseStoryContent } from "@/lib/content/parse";
import { cardProblems, introductionIn } from "@/lib/story-cards/checks";
import { COMPANION_ID as STORIES_PAGE_COMPANION } from "@/lib/story-cards/reader";
import { importSql } from "../scripts/content/import.mjs";
import { seedDocument } from "./support/seed-content";

// #485 (AI-CHARACTER-NEUTRAL follow-up, folded into #521): every place that was tied to one
// Companion is moved to Companion data or documented as a product default, and a blank Companion
// name is refused on import and on load. Names here are invented or the seed Companion's.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const part = (body: string) => ({ kind: "part" as const, part: 1, body });

describe("#485 the introduction check names no character", () => {
  it("test_485_ac1_checks_ts_holds_no_companion_name", () => {
    const source = read("src/lib/story-cards/checks.ts");
    expect(source).not.toMatch(/"I(?: am|'m) [^"]*Oppenheimer"/);
    expect(source).not.toContain("J. Robert");
  });

  it.each([
    "I am Severus Snape",
    "I'm Ada Inventedname",
    "I’m J. Robert Oppenheimer",
    "I am Robert Oppenheimer",
    "I am A. Ada Inventedname",
  ])("test_485_ac1_a_part_card_with_%s_fails_for_any_companion", (phrase) => {
    const found = cardProblems(part(`The door is shut. ${phrase}, and I wait.`), []);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(
      /^Introduces someone \(".+"\)\. Only the background card does that\.$/,
    );
  });

  it("test_485_ac1_ordinary_text_with_capitalised_words_passes", () => {
    expect(introductionIn("I am tired of the cold.")).toBeNull();
    expect(introductionIn("I am Professor Invented's guest tonight.")).toBeNull();
    expect(introductionIn("I'm Sure of it.")).toBeNull();
    expect(cardProblems(part('Rabi said "I am Ada Inventedname." and left.'), [])).toEqual([]);
  });
});

describe("#485 the Companion constants are one documented default", () => {
  it("test_485_ac1_run_stories_companion_is_gone_and_the_session_takes_companion_data", () => {
    expect(read("src/lib/prototype/story-inputs.ts")).not.toContain("RUN_STORIES_COMPANION");
    expect(read("src/lib/summary/run-writer.ts")).not.toContain('"oppenheimer"');
    expect(read("src/lib/summary/finish-run.ts")).not.toContain('"oppenheimer"');
    expect(read("src/lib/progress/focus-session.ts")).not.toContain('"oppenheimer"');
    expect(read("src/lib/progress/focus-session.ts")).toContain(
      "companionId: deps.companionId ?? DEFAULT_COMPANION_ID",
    );
  });

  it("test_485_ac1_the_admin_and_session_defaults_are_the_one_default_companion", () => {
    expect(DEFAULT_COMPANION_ID).toBe("oppenheimer");
    expect(STORIES_PAGE_COMPANION).toBe(DEFAULT_COMPANION_ID);
    expect(read("src/app/admin/page.tsx")).toContain(
      "const CARD_COMPANION_ID = DEFAULT_COMPANION_ID;",
    );
    // The session screens' Companion is the default only where none is passed (/try).
    expect(COMPANION.portrait).toBe("/companions/oppenheimer.png");
    expect(read("src/app/_session/companion.ts")).toMatch(/product default, not a rule/);
    expect(read("src/app/_session/focus-body.tsx")).toContain(
      "host.portrait ?? COMPANION.portrait",
    );
    expect(read("src/app/try/goal/goal-dialogue.tsx")).toContain(
      "voice?.portrait ?? COMPANION.portrait",
    );
  });
});

describe("#485 a blank Companion name is refused", () => {
  const blank = () => {
    const document = seedDocument() as { companions: Record<string, unknown>[] };
    return {
      ...document,
      companions: document.companions.map((row, index) =>
        index === 0 ? { ...row, name: "  " } : row,
      ),
    };
  };

  it("test_485_ac2_load_refuses_a_blank_companion_name", () => {
    expect(() => parseStoryContent(blank())).toThrow(/name is empty/);
    expect(() => parseStoryContent(seedDocument())).not.toThrow();
  });

  it("test_485_ac2_import_refuses_a_blank_companion_name", () => {
    const rows = {
      companions: [{ id: "invented", name: "", short_name: "Invented" }],
      stories: [],
      storyInputs: [],
    };
    expect(() => importSql(rows)).toThrow(/Companion invented: name is empty/);
    expect(() =>
      importSql({ ...rows, companions: [{ ...rows.companions[0], name: "Ada Inventedname" }] }),
    ).not.toThrow();
  });

  it("test_485_ac2_the_file_readers_refuse_a_blank_companion_name", () => {
    expect(read("scripts/content/content-files.mjs")).toMatch(/!filled\(companion\.name\)/);
    expect(read("scripts/content/import-drafts.mjs")).toMatch(/if \(!filled\(own\.name\)\)/);
  });
});
