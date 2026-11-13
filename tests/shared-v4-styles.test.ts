import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Shared styling from prototype version 4, issue #240. Values: docs/design/prototype/TOKENS_FROM_V4.md.
const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (fileName: string) => readFile(`${workspaceRoot}${fileName}`, "utf8");

describe("#240 shared styling from prototype v4", () => {
  it("#240 C1 loads the four typefaces with next/font and swap", async () => {
    const [fonts, layout, tokens] = await Promise.all([
      read("src/app/fonts.ts"),
      read("src/app/layout.tsx"),
      read("src/app/tokens.css"),
    ]);

    for (const loader of [
      "Atkinson_Hyperlegible_Next",
      "Atkinson_Hyperlegible_Mono",
      "Bricolage_Grotesque",
      "Newsreader",
    ]) {
      expect(fonts).toMatch(new RegExp(`import[^;]*\\b${loader}\\b[^;]*from "next/font/google"`));
    }
    expect(fonts.match(/display: "swap"/g)).toHaveLength(4);
    expect(fonts.match(/subsets: \["latin"\]/g)).toHaveLength(4);
    expect(fonts.match(/axes: \["opsz"\]/g)).toHaveLength(2);
    expect(fonts).toContain('style: ["normal", "italic"]');
    for (const variable of [
      "--font-atkinson-next",
      "--font-atkinson-mono",
      "--font-bricolage",
      "--font-newsreader",
    ]) {
      expect(fonts).toContain(`variable: "${variable}"`);
    }
    expect(layout).toContain("fontVariables");
    expect(tokens).toMatch(/--type-sans:\s*var\(--font-atkinson-next\)/);
    expect(tokens).toMatch(/--type-mono:\s*var\(--font-atkinson-mono\)/);
    expect(tokens).toMatch(/--type-display:\s*var\(--font-bricolage\)/);
    expect(tokens).toMatch(/--type-voice:\s*var\(--font-newsreader\)/);
    expect(tokens).toMatch(/--type-shell:\s*var\(--type-sans\)/);
  });
});
