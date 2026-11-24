import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HandLabel, HandMark } from "@/app/hand-layer";
import { applyPrefs, DEFAULT_PREFS } from "@/lib/me/prefs";

// #83 (US-GM-9): Appearance, Plain text and reduced motion. The Me screen and the first paint are
// in e2e/me-appearance.spec.ts.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file: string) => readFile(`${root}${file}`, "utf8");

/** The declarations of one CSS rule, by its exact selector list. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`No rule for ${selector}`);
  return match[1];
}

function fakeRoot() {
  const classes = new Set<string>();
  return {
    classes,
    root: {
      classList: {
        add: (name: string) => classes.add(name),
        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
    } as unknown as HTMLElement,
  };
}

describe("#83 AC1 Appearance: Day, Night or System, System by default", () => {
  it("System is the default and sets no class, so the device decides", () => {
    expect(DEFAULT_PREFS.appearance).toBe("system");
    const { classes, root } = fakeRoot();
    applyPrefs(root, DEFAULT_PREFS);
    expect([...classes]).toEqual([]);
  });

  it("Day and Night replace each other; going back to System removes both", () => {
    const { classes, root } = fakeRoot();
    applyPrefs(root, { ...DEFAULT_PREFS, appearance: "night" });
    expect([...classes]).toEqual(["theme-dark"]);
    applyPrefs(root, { ...DEFAULT_PREFS, appearance: "day" });
    expect([...classes]).toEqual(["theme-light"]);
    applyPrefs(root, DEFAULT_PREFS);
    expect([...classes]).toEqual([]);
  });

  it("the stored choice is applied by a script in <head>, before the page paints", async () => {
    const layout = await read("src/app/layout.tsx");
    expect(layout).toMatch(
      /<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: PREFS_SCRIPT \}\} \/>/,
    );
    const tokens = await read("src/app/tokens.css");
    // System follows the device unless Day is chosen; Night overrides a light device.
    expect(tokens).toContain(".theme-shell:not(.theme-light) {");
    expect(tokens).toMatch(/\n\.theme-dark \{/);
  });
});

describe("#83 AC2 Plain text replaces the hand font and the hand-drawn marks", () => {
  it("the hand label uses the hand face, and the body face under Plain text", async () => {
    const css = await read("src/app/globals.css");
    expect(rule(css, ".hand")).toContain("font-family: var(--type-hand)");
    const plain = rule(css, ".plain-text .hand");
    expect(plain).toContain("font-family: var(--type-sans)");
    expect(plain).toContain("font-variation-settings: normal");
  });

  it("a mark has a hand stroke and a straight line in one box; Plain text shows the line", async () => {
    const css = await read("src/app/globals.css");
    expect(rule(css, ".mark-svg .mark-straight,\n.plain-text .mark-svg .mark-hand")).toContain(
      "display: none",
    );
    expect(rule(css, ".plain-text .mark-svg .mark-straight")).toContain("display: inline");
    expect(rule(css, ".mark-svg")).toContain("stroke: var(--mark)");

    const svg = renderToStaticMarkup(createElement(HandMark));
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('class="mark-hand"');
    expect(svg).toMatch(/class="mark-straight" d="M2 4 H 98"/);
  });

  it("the plain-text class is toggled on <html> by the switch and by the first-paint script", () => {
    const { classes, root } = fakeRoot();
    applyPrefs(root, { ...DEFAULT_PREFS, plainText: true });
    expect(classes.has("plain-text")).toBe(true);
    applyPrefs(root, DEFAULT_PREFS);
    expect(classes.has("plain-text")).toBe(false);
  });

  it("a hand label that repeats visible text is hidden from screen readers", () => {
    expect(
      renderToStaticMarkup(createElement(HandLabel, { repeatsVisibleText: true, children: "Now" })),
    ).toBe('<span aria-hidden="true" class="hand">Now</span>');
    expect(renderToStaticMarkup(createElement(HandLabel, { children: "Now" }))).toBe(
      '<span class="hand">Now</span>',
    );
  });
});

describe("#83 AC3 reduced motion stops animations and transitions everywhere", () => {
  it("one rule under prefers-reduced-motion covers every element and pseudo-element", async () => {
    const css = await read("src/app/globals.css");
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\*,\s*\*::before,\s*\*::after,\s*::backdrop \{([^}]*)\}/,
    );
    expect(block).not.toBeNull();
    expect(block![1]).toContain("animation-duration: 0.01ms !important");
    expect(block![1]).toContain("transition-duration: 0.01ms !important");
    expect(block![1]).toContain("scroll-behavior: auto !important");
  });
});
