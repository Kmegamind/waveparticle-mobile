import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("docs/ai/DIFFERENCES.md follows docs/DECISIONS.md", () => {
  const differences = read("docs/ai/DIFFERENCES.md");

  it("does not ask for introduction phrases in later cards (M2)", () => {
    expect(differences).not.toMatch(/carries a short phrase of about 12 words/);
    expect(differences).toMatch(/M2/);
  });

  it("does not leave the time-up card open (T8)", () => {
    expect(differences).not.toMatch(/whether a time-up card exists is not decided/i);
    expect(differences).not.toMatch(/Whether a time-up card exists at 00:00/);
    expect(differences).toMatch(/T8/);
  });
});

describe("docs/ai/base-v1 holds the version 1 base text", () => {
  for (const name of ["AI_03_v1.md", "AI_04_v1.md", "AI_05_v1.md"]) {
    it(`${name} exists, explains itself and has no broken relative links`, () => {
      const file = path.join("docs/ai/base-v1", name);
      expect(existsSync(path.join(root, file))).toBe(true);
      const text = read(file);
      expect(text).toMatch(/version 1 base text/);
      expect(text).toMatch(/docs\/DECISIONS\.md/);
      const links = [...text.matchAll(/\]\(([^)#\s]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !/^[a-z]+:/i.test(target));
      for (const target of links) {
        expect(
          existsSync(path.join(root, path.dirname(file), target)),
          `${name} links to ${target}`,
        ).toBe(true);
      }
    });
  }
});

describe("prototype version 2 is in the repository", () => {
  it("keeps the version 2 diff note and points the design README to it", () => {
    expect(
      existsSync(path.join(root, "docs/design/prototype/wp-prototype_2026-11-05_v2_diff.md")),
    ).toBe(true);
    const readme = read("docs/design/README.md");
    expect(readme).toMatch(/wp-prototype_2026-11-05_v2/);
    expect(readme).toMatch(/version 1 \(published version 8\) is replaced/i);
  });
});
