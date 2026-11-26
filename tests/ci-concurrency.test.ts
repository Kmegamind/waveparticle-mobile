import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// #481: a new push to a pull request cancels its older CI run; runs on main are never cancelled.
const ci = readFileSync(".github/workflows/ci.yml", "utf8");

const topLevel = (key: string) => {
  const match = ci.match(new RegExp(`^${key}:\\n((?:(?:[ \\t]+.*)?\\n)+?)(?=^\\S)`, "m"));
  return match ? match[1] : "";
};

describe("CI concurrency (#481)", () => {
  const concurrency = topLevel("concurrency");

  it("groups runs per pull request and keeps body edits apart from code pushes", () => {
    expect(concurrency).toMatch(/group: ci-\$\{\{.*github\.event\.pull_request\.number/);
    expect(concurrency).toContain("github.event.action == 'edited' && 'body' || 'code'");
  });

  it("gives every push to main its own group, so a main run is never cancelled or replaced", () => {
    expect(concurrency).toContain("format('push-{0}', github.run_id)");
  });

  it("cancels in progress for pull requests only", () => {
    expect(concurrency).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it("keeps every job and check name", () => {
    const jobs = (ci.split(/^jobs:\n/m)[1] ?? "")
      .split("\n")
      .filter((line) => /^ {2}[\w-]+:\s*$/.test(line))
      .map((line) => line.trim().replace(/:$/, ""));
    expect(jobs).toEqual(["check", "pr-closes-issue", "pr-human-steps"]);
    expect(ci).toMatch(/types: \[opened, edited, synchronize, reopened\]/);
  });
});
