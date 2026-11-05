import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

async function readWorkspaceFile(fileName: string): Promise<string> {
  return readFile(`${workspaceRoot}${fileName}`, "utf8");
}

function parseTokens(css: string): Map<string, string> {
  return new Map(
    [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("design tokens", () => {
  it("defines the Shell themes and Oppenheimer skin in one token file", async () => {
    const css = await readWorkspaceFile("src/app/tokens.css");

    expect(css).toContain(":root");
    expect(css).toContain(".theme-dark");
    expect(css).toContain(".skin-opp");

    const tokens = parseTokens(css);
    for (const token of [
      "--bg",
      "--surface",
      "--raised",
      "--ink",
      "--ink-2",
      "--faint",
      "--edge",
      "--hairline",
      "--accent",
      "--mark",
      "--fill",
      "--on-fill",
      "--fill-border",
      "--glow-1",
      "--glow-2",
      "--type-display",
      "--type-sans",
      "--type-mono",
      "--type-voice",
      "--type-hand",
      "--r-control",
      "--r-card",
      "--r-note",
      "--target",
      "--logo-width",
      "--logo-height",
    ]) {
      expect(tokens.has(token), `missing token ${token}`).toBe(true);
    }

    expect(css).toContain("@theme inline");
    expect(css).toContain("--color-background: var(--bg)");
    expect(css).toContain("--font-sans: var(--type-sans)");
  });

  it("keeps named fonts paired with safe fallbacks", async () => {
    const css = await readWorkspaceFile("src/app/tokens.css");

    expect(css).toMatch(/--type-display:.*Bricolage Grotesque.*system-ui/);
    expect(css).toMatch(/--type-sans:.*Atkinson Hyperlegible Next.*system-ui/);
    expect(css).toMatch(/--type-mono:.*Atkinson Hyperlegible Mono.*ui-monospace/);
    expect(css).toMatch(/--type-voice:.*Newsreader.*Georgia/);
    expect(css).toMatch(/--type-hand:.*Shantell Sans.*Patrick Hand.*system-ui/);
  });

  it("wires a themed logo into the app header", async () => {
    const [layout, css, globals] = await Promise.all([
      readWorkspaceFile("src/app/layout.tsx"),
      readWorkspaceFile("src/app/tokens.css"),
      readWorkspaceFile("src/app/globals.css"),
    ]);

    expect(layout).toContain('src="/logo.svg"');
    expect(layout).toContain('aria-label="WaveParticle"');
    expect(globals).toMatch(/\.logo[\s\S]*filter:\s*var\(--logo-filter\)/);
    expect(css).toContain(".theme-dark");
  });

  it("uses tokens rather than literal design values in UI styles", async () => {
    const [globals, page] = await Promise.all([
      readWorkspaceFile("src/app/globals.css"),
      readWorkspaceFile("src/app/page.tsx"),
    ]);

    expect(globals).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(page).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it("meets the documented contrast pairs in every theme", async () => {
    const css = await readWorkspaceFile("src/app/tokens.css");
    const themeBlocks = [":root", ".theme-dark", ".skin-opp"].map((selector) => {
      const block = css.match(
        new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\}`),
      )?.[1];
      return parseTokens(block ?? "");
    });

    expect(themeBlocks).toHaveLength(3);

    const pairs = [
      ["--ink", "--raised", 7],
      ["--ink-2", "--raised", 7],
      ["--faint", "--raised", 4.5],
      ["--edge", "--raised", 3],
      ["--accent", "--raised", 4.5],
      ["--fill-border", "--bg", 3],
      ["--on-fill", "--fill", 4.5],
    ] as const;

    for (const tokens of themeBlocks) {
      for (const [foregroundName, backgroundName, minimum] of pairs) {
        const foreground = tokens.get(foregroundName);
        const background = tokens.get(backgroundName);

        if (
          !foreground ||
          !background ||
          !/^#[0-9a-f]{6}$/i.test(foreground) ||
          !/^#[0-9a-f]{6}$/i.test(background)
        ) {
          continue;
        }

        expect(
          contrastRatio(foreground, background),
          `${foregroundName} on ${backgroundName}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  });
});
