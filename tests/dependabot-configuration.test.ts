import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dependabot = readFileSync(".github/dependabot.yml", "utf8");

describe("Dependabot configuration", () => {
  it("checks npm and GitHub Actions weekly", () => {
    expect(dependabot).toContain("package-ecosystem: npm");
    expect(dependabot).toContain("package-ecosystem: github-actions");
    expect(dependabot).toMatch(/schedule:\s*\n\s+interval: weekly/);
  });

  it("groups updates for each ecosystem", () => {
    expect(dependabot).toMatch(/groups:\s*\n\s+all-npm-dependencies:/);
    expect(dependabot).toMatch(/groups:\s*\n\s+all-github-actions:/);
  });
});
