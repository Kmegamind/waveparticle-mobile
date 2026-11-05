import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ci = readFileSync(".github/workflows/ci.yml", "utf8");

describe("CI configuration", () => {
  it("runs production npm audit at the high severity threshold", () => {
    expect(ci).toContain("npm audit --omit=dev --audit-level=high");
  });

  it("uploads the Playwright report when end-to-end tests fail", () => {
    expect(ci).toMatch(
      /name: Upload Playwright report[\s\S]*if: \$\{\{ failure\(\) \}\}[\s\S]*path: playwright-report/,
    );
  });
});
