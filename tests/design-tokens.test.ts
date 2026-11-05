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

function themeBlocks(css: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  for (const selector of [":root", ".theme-dark", ".skin-opp", ".theme-shell:not(.theme-light)"]) {
    const escaped = selector.replace(/[.()]/g, "\\$&");
    const body = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
    if (body) blocks.set(selector, parseTokens(body));
  }
  return blocks;
}

function mix(foreground: string, percent: number, background: string): string {
  const channel = (hex: string, index: number) =>
    Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const part = (index: number) =>
    Math.round(
      (channel(foreground, index) * percent + channel(background, index) * (100 - percent)) / 100,
    );
  return `#${[0, 1, 2].map((index) => part(index).toString(16).padStart(2, "0")).join("")}`;
}

/** Resolves a token value (hex, var(), or two-colour color-mix over srgb) to a hex colour. */
function resolve(tokens: Map<string, string>, value: string): string {
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) return resolve(tokens, tokens.get(reference[1])!);
  const blend = value.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/);
  if (blend) return mix(resolve(tokens, blend[1]), Number(blend[2]), resolve(tokens, blend[3]));
  return value;
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
      "--control",
      "--on-control",
      "--accent-text",
      "--tint",
      "--gray",
      "--mark",
      "--fill-soft",
      "--glow-1",
      "--glow-2",
      "--type-display",
      "--type-sans",
      "--type-mono",
      "--type-voice",
      "--type-hand",
      "--r-field",
      "--r-capsule",
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
    const [layout, shell, css, globals] = await Promise.all([
      readWorkspaceFile("src/app/layout.tsx"),
      readWorkspaceFile("src/app/shell.tsx"),
      readWorkspaceFile("src/app/tokens.css"),
      readWorkspaceFile("src/app/globals.css"),
    ]);

    expect(`${layout}\n${shell}`).toContain('src="/logo.svg"');
    expect(`${layout}\n${shell}`).toContain('aria-label="WaveParticle"');
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

  it("removes the version 6 token names", async () => {
    const files = await Promise.all(
      ["src/app/tokens.css", "src/app/globals.css", "src/app/layout.tsx", "src/app/page.tsx"].map(
        readWorkspaceFile,
      ),
    );
    for (const name of [
      "--accent",
      "--fill",
      "--on-fill",
      "--fill-border",
      "--shadow-tag",
      "--r-control",
    ]) {
      const pattern = new RegExp(`${name}(?![\\w-])`);
      for (const file of files) {
        expect(file, `${name} still used`).not.toMatch(pattern);
      }
    }
  });

  it("defines the full version 7 colour set in every theme block", async () => {
    const blocks = themeBlocks(await readWorkspaceFile("src/app/tokens.css"));
    expect(blocks.size).toBe(4);
    for (const [selector, tokens] of blocks) {
      for (const name of [
        "--control",
        "--on-control",
        "--accent-text",
        "--tint",
        "--gray",
        "--mark",
        "--fill-soft",
      ]) {
        expect(tokens.has(name), `${selector} missing ${name}`).toBe(true);
      }
      expect(tokens.get("--tint")).toContain("color-mix");
      expect(tokens.get("--gray")).toContain("color-mix");
    }
    const dark = blocks.get(".theme-dark")!;
    const media = blocks.get(".theme-shell:not(.theme-light)")!;
    for (const [name, value] of dark) {
      expect(media.get(name), `media block differs on ${name}`).toBe(value);
    }
    expect(await readWorkspaceFile("src/app/tokens.css")).toContain(
      "--color-accent: var(--control)",
    );
  });

  it("meets the documented contrast values in every theme", async () => {
    const blocks = themeBlocks(await readWorkspaceFile("src/app/tokens.css"));
    const light = blocks.get(":root")!;
    const dark = blocks.get(".theme-dark")!;
    const night = blocks.get(".skin-opp")!;

    const ratio = (tokens: Map<string, string>, fg: string, bg: string) =>
      contrastRatio(resolve(tokens, `var(${fg})`), resolve(tokens, `var(${bg})`));

    for (const tokens of [light, dark, night]) {
      expect(ratio(tokens, "--ink", "--raised")).toBeGreaterThanOrEqual(7);
      expect(ratio(tokens, "--ink-2", "--raised")).toBeGreaterThanOrEqual(7);
      expect(ratio(tokens, "--faint", "--raised")).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens, "--edge", "--bg")).toBeGreaterThanOrEqual(3);
      expect(ratio(tokens, "--control", "--bg")).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens, "--on-control", "--control")).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens, "--accent-text", "--tint")).toBeGreaterThanOrEqual(4.5);
      expect(ratio(tokens, "--ink", "--gray")).toBeGreaterThanOrEqual(7);
    }

    const documented: [Map<string, string>, string, string, number][] = [
      [light, "--control", "--bg", 4.8],
      [light, "--on-control", "--control", 5.8],
      [light, "--accent-text", "--tint", 4.9],
      [light, "--ink", "--gray", 11.7],
      [dark, "--control", "--bg", 10.5],
      [dark, "--on-control", "--control", 10.9],
      [dark, "--accent-text", "--tint", 7.3],
      [dark, "--ink", "--gray", 11.7],
    ];
    for (const [tokens, fg, bg, expected] of documented) {
      expect(ratio(tokens, fg, bg), `${fg} on ${bg}`).toBeCloseTo(expected, 0);
    }
  });

  it("defines capsule buttons without paper-tag edges", async () => {
    const css = await readWorkspaceFile("src/app/globals.css");
    const rule = (name: string) =>
      css.match(new RegExp(`\\n\\n\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

    for (const name of ["button-filled", "button-tinted", "button-gray", "button-plain"]) {
      const body = rule(name);
      expect(body, `.${name} missing`).not.toBe("");
      expect(body).not.toMatch(/box-shadow|2px/);
    }
    const shared = css.match(/\.button-filled,[^{]*\{([^}]*)\}/)?.[1] ?? "";
    expect(shared).toContain("border-radius: var(--r-capsule)");
    expect(shared).toContain("min-height: 3.125rem");
    expect(shared).not.toMatch(/box-shadow|2px/);
    expect(rule("button-filled")).toContain("background: var(--control)");
    expect(rule("button-filled")).toContain("color: var(--on-control)");
    expect(rule("button-tinted")).toContain("background: var(--tint)");
    expect(rule("button-tinted")).toContain("1px solid var(--control)");
    expect(rule("button-gray")).toContain("background: var(--gray)");
    expect(rule("button-gray")).toContain("1px solid var(--edge)");
    expect(rule("button-plain")).toContain("background: transparent");
    expect(rule("button-plain")).toContain("min-height: var(--target)");
    expect(css).toMatch(/\.button-small\s*\{[^}]*min-height:\s*2\.25rem/);
    expect(css).not.toContain("--shadow-tag");
  });
});
