import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

async function readRootFile(name: string): Promise<string> {
  return readFile(`${root}${name}`, "utf8");
}

describe("deployment documentation", () => {
  it("records the verified Node 24 deployment requirement", async () => {
    const deploy = await readRootFile("docs/deploy.md");

    expect(deploy).toContain("Node 24");
    expect(deploy).toContain("Node 26");
    expect(deploy).toMatch(/Node 26[\s\S]*not\s+verified/);
  });

  it("documents deployment environments and recovery steps", async () => {
    const deploy = await readRootFile("docs/deploy.md");

    expect(deploy).toContain("pull request");
    expect(deploy).toContain("main");
    expect(deploy).toContain("project environment settings");
    expect(deploy).toMatch(/open the deployed home page/);
    expect(deploy).toMatch(/rollback/i);
  });

  it("labels the live URL as pending human deployment", async () => {
    const readme = await readRootFile("README.md");

    expect(readme).toContain("Live URL: TODO(human): add after the Vercel production deployment.");
  });
});
