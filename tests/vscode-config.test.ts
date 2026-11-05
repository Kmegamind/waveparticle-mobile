import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

async function readJson<T>(fileName: string): Promise<T> {
  const file = await readFile(`${workspaceRoot}.vscode/${fileName}`, "utf8");
  return JSON.parse(file) as T;
}

async function readPackageJson(): Promise<{
  devDependencies?: { typescript?: string };
}> {
  const file = await readFile(`${workspaceRoot}package.json`, "utf8");
  return JSON.parse(file) as {
    devDependencies?: { typescript?: string };
  };
}

describe("VS Code workspace configuration", () => {
  it("formats on save and uses the workspace TypeScript version", async () => {
    const settings = await readJson<Record<string, unknown>>("settings.json");
    const packageJson = await readPackageJson();

    expect(settings["editor.defaultFormatter"]).toBe("esbenp.prettier-vscode");
    expect(settings["editor.formatOnSave"]).toBe(true);
    expect(settings["typescript.tsdk"]).toBe("node_modules/typescript/lib");
    expect(packageJson.devDependencies?.typescript).toBe("6.0.3");
  });

  it("recommends the repository's development extensions", async () => {
    const extensions = await readJson<{ recommendations?: string[] }>("extensions.json");

    expect(extensions.recommendations).toEqual(
      expect.arrayContaining([
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "vitest.explorer",
        "ms-playwright.playwright",
        "github.vscode-pull-request-github",
        "anthropic.claude-code",
      ]),
    );
  });
});
