import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

async function readWorkspaceFile(fileName: string): Promise<string> {
  return readFile(`${workspaceRoot}${fileName}`, "utf8");
}

describe("app shell", () => {
  it("defines the four top-level routes", async () => {
    const routeFiles = await Promise.all(
      [
        "src/app/page.tsx",
        "src/app/companions/page.tsx",
        "src/app/goals/page.tsx",
        "src/app/me/page.tsx",
      ].map(readWorkspaceFile),
    );

    for (const route of routeFiles) {
      expect(route).toContain("<h1");
    }
  });

  it("uses safe-area insets for the shell and tab bar", async () => {
    const css = await readWorkspaceFile("src/app/globals.css");

    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("defines a primary navigation with all four top-level links", async () => {
    const shell = await readWorkspaceFile("src/app/shell.tsx");

    expect(shell).toContain('aria-label="Primary"');
    for (const label of ["Home", "Companions", "Goals", "Me"]) {
      expect(shell).toContain(`label: "${label}"`);
    }
  });
});
