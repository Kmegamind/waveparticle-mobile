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

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.()]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("#240 C2 C3 C4 buttons", () => {
  it("#240 C2 C3 C4 button tokens follow the prototype skins", async () => {
    const css = await read("src/app/tokens.css");
    const day = block(css, ":root");
    expect(day).toContain("--tag-fill: #c3e0c8");
    expect(day).toContain("--tag-ink: #050b06");
    expect(day).toContain("--tag-edge: #517e5a");
    expect(day).toContain("--control: #426f4c");
    expect(day).toContain("--button-height: 3.5rem");
    expect(day).toContain("--button-padding: 1.125rem");
    expect(day).toContain("--button-small-padding: 0.875rem");
    expect(day).toContain("--text-button-small-size: 0.875rem");
    for (const selector of [".theme-dark", ".skin-opp", ".theme-shell:not(.theme-light)"]) {
      const dark = block(css, selector);
      expect(dark, selector).toContain("--tag-fill: #a1caa8");
      expect(dark, selector).toContain("--tag-ink: #050b06");
      expect(dark, selector).toContain("--tag-edge: #6e9876");
    }
  });

  it("#240 C2 a disabled button stays at 35% opacity", async () => {
    const css = await read("src/app/globals.css");
    expect(css).toMatch(/\.button-filled:disabled,[^{]*\{[^}]*opacity: 0\.35/);
  });
});

describe("#240 C9 C10 links and labels", () => {
  it("#240 C10 small labels are capitals", async () => {
    const [css, tokens] = await Promise.all([
      read("src/app/globals.css"),
      read("src/app/tokens.css"),
    ]);
    const label = block(css, ".focus-label");
    expect(label).toContain("text-transform: uppercase");
    expect(label).toContain("font-size: var(--text-overline-size)");
    expect(label).toContain("letter-spacing: var(--overline-tracking)");
    expect(label).toContain("font-weight: 700");
    expect(tokens).toContain("--text-overline-size: 0.78125rem");
    expect(tokens).toContain("--overline-tracking: 0.09em");
  });

  it("#240 C9 text links use ink at the link size", async () => {
    const [css, tokens] = await Promise.all([
      read("src/app/globals.css"),
      read("src/app/tokens.css"),
    ]);
    for (const selector of ["\na", ".try-link"]) {
      const rule =
        selector === "\na" ? (css.match(/\na \{([^}]*)\}/)?.[1] ?? "") : block(css, selector);
      expect(rule, selector).toContain("color: var(--ink)");
      expect(rule, selector).toContain("font-size: var(--text-link-size)");
      expect(rule, selector).toContain("font-weight: 700");
    }
    expect(tokens).toContain("--text-link-size: 0.9375rem");
  });
});

describe("#240 C5 C6 session skin and glow", () => {
  it("#240 C5 session paths use the Oppenheimer skin", async () => {
    const { isSessionPath } = await import("../src/app/try/session-paths");
    for (const path of ["/try/goal", "/try/focus", "/try/rest", "/try/end", "/try/rest/x"]) {
      expect(isSessionPath(path), path).toBe(true);
    }
    for (const path of ["/try", "/try/", "/try/goals", "/", "/safety"]) {
      expect(isSessionPath(path), path).toBe(false);
    }
  });

  it("#240 C5 the page behind a session uses the same Oppenheimer values", async () => {
    const css = await read("src/app/tokens.css");
    const skin = block(css, ".skin-opp");
    const root = block(css, ":root");
    const value = (body: string, name: string) =>
      body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    expect(value(root, "--skin-opp-bg")).toBe(value(skin, "--bg"));
    expect(value(root, "--skin-opp-glow-1")).toBe(value(skin, "--glow-1"));
    expect(value(root, "--skin-opp-glow-2")).toBe(value(skin, "--glow-2"));
  });

  it("#240 C6 the page background carries the two prototype glows", async () => {
    const css = await read("src/app/globals.css");
    const body = css.match(/\nbody \{([^}]*)\}/)?.[1] ?? "";
    expect(body).toContain("radial-gradient(60% 34% at 92% 4%, var(--glow-1), transparent 70%)");
    expect(body).toContain("radial-gradient(70% 44% at 2% 104%, var(--glow-2), transparent 70%)");
    expect(css).toMatch(
      /html:has\(\.skin-opp\) body \{[^}]*var\(--skin-opp-glow-1\)[^}]*var\(--skin-opp-bg\)/,
    );
  });
});

describe("#240 C7 C8 header and tab bar", () => {
  it("#240 C8 the tab bar follows the prototype table", async () => {
    const { showsTabBar } = await import("../src/app/shell-rules");
    for (const path of [
      "/",
      "/goals",
      "/companions",
      "/companions/oppenheimer",
      "/me",
      "/me/signals",
    ]) {
      expect(showsTabBar(path), path).toBe(true);
    }
    for (const path of [
      "/goals/12",
      "/me/delete-account",
      "/auth/sign-in",
      "/auth/update-password",
      "/safety",
      "/try",
      "/try/goal",
    ]) {
      expect(showsTabBar(path), path).toBe(false);
    }
  });

  it("#240 C7 no header on account and safety pages", async () => {
    const { showsHeader } = await import("../src/app/shell-rules");
    for (const path of ["/auth/sign-in", "/auth/sign-up", "/auth/update-password", "/safety"]) {
      expect(showsHeader(path), path).toBe(false);
    }
    for (const path of ["/", "/me", "/goals"]) {
      expect(showsHeader(path), path).toBe(true);
    }
  });

  it("#240 C8 tabs are in prototype order with icons", async () => {
    const shell = await read("src/app/shell.tsx");
    const order = ["Home", "Goals", "Companions", "Me"].map((label) =>
      shell.indexOf(`label: "${label}"`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(shell).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(shell).toContain("M4 11l8-7 8 7v9H4z");
    expect(shell).toContain("M5 6h14M5 12h14M5 18h9");
  });

  it("#240 C8 the selected tab has the mark bar and the prototype sizes", async () => {
    const [css, tokens] = await Promise.all([
      read("src/app/globals.css"),
      read("src/app/tokens.css"),
    ]);
    const current = css.match(/\.app-tab\[aria-current="page"\]::before\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(current).toContain("background: var(--mark)");
    expect(current).toContain("width: 48%");
    expect(block(css, ".app-tab")).toContain("font-size: var(--text-tab-size)");
    expect(block(css, ".app-tab-bar")).toContain("background: var(--bg)");
    expect(tokens).toContain("--text-tab-size: 0.78125rem");
    expect(tokens).toContain("--tab-item-height: 3.25rem");
    expect(tokens).toContain("--tab-icon: 1.5rem");
  });
});

describe("#240 C11 tape", () => {
  it("#240 C11 tape matches the prototype", async () => {
    const [css, tokens] = await Promise.all([
      read("src/app/globals.css"),
      read("src/app/tokens.css"),
    ]);
    for (const selector of [".focus-tape", ".try-slip::before"]) {
      const rule = block(css, selector);
      expect(rule, selector).toContain("background: var(--tape)");
      expect(rule, selector).toContain("rotate(-4deg)");
      expect(rule, selector).toContain("width: var(--tape-width)");
      expect(rule, selector).toContain("height: var(--tape-height)");
      expect(rule, selector).toContain("box-shadow: 0 0 0 1px var(--tape-ring)");
      expect(rule, selector).not.toContain("translateX(-50%)");
    }
    expect(block(tokens, ":root")).toContain("--tape-width: 3.625rem");
    expect(block(tokens, ":root")).toContain("--tape-height: 1.0625rem");
    expect(block(tokens, ":root")).toMatch(
      /--tape: color-mix\(in srgb, #c3e0c8 75%, transparent\)/,
    );
    for (const selector of [".theme-dark", ".skin-opp", ".theme-shell:not(.theme-light)"]) {
      expect(block(tokens, selector), selector).toMatch(
        /--tape: color-mix\(in srgb, #a1caa8 55%, transparent\)/,
      );
    }
  });

  it("#240 C11 in a chat thread only his first slip has tape", async () => {
    const css = await read("src/app/globals.css");
    const thread = css.match(/([^{}]*)\{\s*display: none;\s*\}/g) ?? [];
    const rule = thread.find((text) =>
      text.includes(".try-dialogue .try-slip ~ .try-slip::before"),
    );
    expect(rule).toBeDefined();
    expect(rule).toContain(".rest-log .rest-slip ~ .rest-slip .focus-tape");
    // Slips outside a thread (the focus page, the return pop-up) always keep their tape.
    expect(css).not.toMatch(/\.focus-slip[^{,]*\.focus-tape\s*\{[^}]*display: none/);
  });
});
