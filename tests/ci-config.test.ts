import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

describe("CI configuration", () => {
  it("exempts Dependabot from the issue-link check", () => {
    expect(read(".github/workflows/ci.yml")).toMatch(/github\.actor != 'dependabot\[bot\]'/);
  });

  it("ignores major updates that conflict with recorded decisions", () => {
    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toMatch(/dependency-name: "typescript"/);
    expect(dependabot).toMatch(/dependency-name: "@types\/node"/);
    expect(dependabot).toMatch(/semver-major/);
  });
});
