import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");
describe("CI container", () => {
  it("uses a Playwright image that matches the installed Playwright version", () => {
    const version = JSON.parse(read("package.json")).devDependencies["@playwright/test"];
    expect(read(".github/workflows/ci.yml")).toContain(
      `mcr.microsoft.com/playwright:v${version}-noble`,
    );
  });

  it("gives every job a time limit", () => {
    const ci = read(".github/workflows/ci.yml");
    // One limit per job (check, pr-closes-issue and, since #189, pr-human-steps).
    const jobs = ci.slice(ci.indexOf("\njobs:")).match(/^ {2}[a-z][a-z0-9-]*:$/gm) ?? [];
    expect(jobs.length).toBe(3);
    expect((ci.match(/timeout-minutes:/g) ?? []).length).toBe(jobs.length);
  });
});
