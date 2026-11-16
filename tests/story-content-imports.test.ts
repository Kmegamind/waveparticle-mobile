import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// #284 AC1: the app reads story content only through src/lib/content/repository.ts.

const source = path.join(import.meta.dirname, "..", "src");

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [full] : [];
  });
}

/** Every module path imported by one file. */
function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

const SEED = [
  /stories\.json$/,
  /companions\.json$/,
  /periods\.json$/,
  /\.stage0\.json$/,
  /^@\/content\/(companions|oppenheimer)/,
  /content\/oppenheimer(\/index)?$/,
  /story-inputs-data$/,
];

/**
 * The one exception: the labelled /try test data (chapter 8's generated lines, used only when no
 * model is configured, docs/decisions/0011). It holds generated cards, not story content; the
 * stored cards are #293.
 */
const ALLOWED: Record<string, string[]> = {
  [path.join("lib", "prototype", "test-story.ts")]: [
    "../../../docs/demo/site-search.generated.json",
  ],
};

describe("story content is read through one interface (#284)", () => {
  it("test_284_ac1_no_app_code_imports_the_seed_files_or_docs_demo", () => {
    const offending: string[] = [];
    for (const file of filesUnder(source)) {
      const relative = path.relative(source, file);
      for (const imported of importsOf(file)) {
        if ((ALLOWED[relative] ?? []).includes(imported)) continue;
        if (SEED.some((pattern) => pattern.test(imported)) || imported.includes("docs/demo")) {
          offending.push(`${relative} imports ${imported}`);
        }
      }
    }
    expect(offending).toEqual([]);
  });

  it("test_284_ac3_no_service_role_key_in_app_code", () => {
    for (const file of filesUnder(source)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/service[_-]?role/i);
    }
  });

  it("test_284_the_reader_key_is_server_only", () => {
    for (const file of filesUnder(source)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/NEXT_PUBLIC_CONTENT_READ_KEY/);
      if (text.includes("CONTENT_READ_KEY")) {
        expect(path.relative(source, file)).toBe(path.join("lib", "content", "repository.ts"));
      }
    }
  });

  it("test_284_story_content_is_read_from_the_repository_by_the_screens", () => {
    const readers = [
      path.join("app", "companions", "oppenheimer", "page.tsx"),
      path.join("app", "focus", "account-progress.ts"),
      path.join("app", "end", "page.tsx"),
      path.join("app", "end", "actions.ts"),
      path.join("app", "try", "focus", "actions.ts"),
      path.join("app", "try", "rest", "actions.ts"),
      path.join("app", "try", "goal", "page.tsx"),
    ];
    for (const file of readers) {
      expect(importsOf(path.join(source, file)), file).toContain("@/lib/content/repository");
    }
  });
});
