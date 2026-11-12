import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

describe("CI configuration", () => {
  it("exempts Dependabot from the issue-link check", () => {
    const ci = read(".github/workflows/ci.yml");
    // The exemption follows who opened the pull request, not who pushed last (#206).
    expect(ci).toMatch(/github\.event\.pull_request\.user\.login != 'dependabot\[bot\]'/);
    expect(ci).not.toMatch(/github\.actor != 'dependabot\[bot\]'/);
  });

  it("ignores major updates that conflict with recorded decisions", () => {
    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toMatch(/dependency-name: "typescript"/);
    expect(dependabot).toMatch(/dependency-name: "@types\/node"/);
    expect(dependabot).toMatch(/semver-major/);
  });
});
