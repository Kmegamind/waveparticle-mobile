import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
// The stub helpers are named use...; aliased so the React hook lint rule does not take them for
// hooks.
import { baseUrlOf, signIn, useSeededPublishHistory as seededPublishHistoryView } from "./account";
import { useSeededPrompts as seededPromptsView } from "./prompts";
import { useOwnHotlines as ownHotlinesView } from "./hotlines";
import { recordInventory } from "./admin-visual-inventory";

// #435: the admin visual gate. It opens the repository copy of the owner's admin prototype
// (docs/design/prototype/admin-prototype.html) and the live admin side by side, at 1024 and
// 1280 px, and compares the computed styles of the fixed components only: the frame, the rail
// and its menu rows, the page header, panels, tables, pills, chips, buttons and text fields.
// Over 1 px or a different colour fails. Text and sample or seed data are never compared.
//
// The prototype is rendered in standards mode: `<!doctype html><meta charset=utf-8>` is put in
// front of the file as it is served (docs/design/README.md, "The admin prototype"). It is served
// from the app's own origin, and its Google Fonts request is answered with the app's own
// self-hosted copies of the same fonts, so both sides draw the same font files and the test
// never goes to the network.
//
// #483: the gate is split into one spec file per admin page (e2e/admin-visual*.spec.ts), so page
// pull requests do not edit the same file. This file holds what they share: the prototype
// loading, the style readers, differences(), the EXCEPTIONS handling, the picture writer, the
// gate account's seeded views, and the frame and shared component rows (compared in
// e2e/admin-visual.spec.ts). A page's own rows, pages and exceptions live in its spec file.
//
// To compare a new component, add a row to that page's `components` (and, if needed, a page to
// its `prototypePages` / `livePages`). Page pull requests extend the map; they do not loosen it.
//
// Run with ADMIN_VISUAL_SCREENSHOTS=1 to (re)write the prototype vs live pictures in
// docs/design/reference/admin/.

/** The browser settings of every gate file: `test.use(ADMIN_VISUAL_USE)`. */
export const ADMIN_VISUAL_USE = { colorScheme: "light", isMobile: false, hasTouch: false } as const;

/**
 * The owner's ruling after #465 (it failed six times on GitHub only, on font rendering): the gate
 * is judged in CI, which runs in the official Playwright image. On a developer machine it is
 * skipped unless ADMIN_GATE_LOCAL=1 (docs/testing.md).
 */
export const GATE_LOCAL_SKIP_MESSAGE =
  "admin visual gate runs in CI (Playwright image); set ADMIN_GATE_LOCAL=1 to run locally, " +
  "results may differ by font rendering";

/** Call at the top of every gate file: skips the file outside CI unless ADMIN_GATE_LOCAL=1. */
export function skipGateOutsideCi() {
  test.skip(!process.env.CI && process.env.ADMIN_GATE_LOCAL !== "1", GATE_LOCAL_SKIP_MESSAGE);
}

export const WIDTHS = [1024, 1280] as const;
export const HEIGHT = 800;
const ROOT = path.join(__dirname, "..", "..");
const PROTOTYPE_FILE = path.join(ROOT, "docs/design/prototype/admin-prototype.html");
export const REFERENCE_DIR = path.join(ROOT, "docs/design/reference/admin");
const PROTOTYPE_PATH = "/__admin-visual/admin-prototype.html";
const STANDARDS_MODE = "<!doctype html><meta charset=utf-8>";
// #439: the AI feature screens drawn in the prototype's look (#432). The file starts with its own
// doctype and charset, so it is served as it is.
const AI_FEATURES_FILE = path.join(ROOT, "docs/design/prototype/admin-ai-features.html");
const AI_FEATURES_PATH = "/__admin-visual/admin-ai-features.html";
// #448: ADM-14 Hotlines and ADM-15 Hotline entry are drawn in their own file (decision
// ADMIN-DESKTOP). Like the owner's file it has no doctype, so it is served in standards mode too.
const HOTLINES_FILE = path.join(ROOT, "docs/design/prototype/admin-hotlines_2026-11-23_v1.html");
const HOTLINES_PATH = "/__admin-visual/admin-hotlines.html";

// ---------------------------------------------------------------------------------------------
// The shape of a gate: pages first, then the components compared on them.
// ---------------------------------------------------------------------------------------------

export type PageSetup = (page: Page) => Promise<void>;

/**
 * A prototype screen by hash, with any step needed to show a component. `file: "aiFeatures"` is a
 * screen of docs/design/prototype/admin-ai-features.html, `"hotlines"` of the hotlines file; the
 * others are admin-prototype.html.
 */
export type PrototypePage = { hash: string; file?: "aiFeatures" | "hotlines"; prepare?: PageSetup };

/** A live admin page by path, with any step needed to show a component. */
export type LivePage = { path: string; prepare?: PageSetup };

type Side = { page: string; selector: string };
export type Metric = "x" | "y" | "width" | "height" | "contentWidth";
export type Component = {
  name: string;
  prototype: Side;
  live: Side;
  /** Computed style properties; STYLE when not given. Exceptions go in EXCEPTIONS, not here. */
  properties?: readonly string[];
  /** Read the styles of a pseudo-element instead (the pill's dot). */
  pseudo?: "::before";
  /** Box measurements in px (rounded); "contentWidth" is the width inside padding and border. */
  box?: readonly Metric[];
};

/**
 * A deliberate gap in the comparison, with its reason. A property listed here is not compared for
 * that component; nothing else is skipped. Content-dependent sizes (the width of a pill, chip,
 * button or menu label; the height of a cell, panel, lede or text box) are never measured: only
 * the sizes named in a component's `box` are.
 */
export type Exception = { component: string; properties: string[]; reason: string };

/**
 * One page's gate. `livePages` are opened in the order the components first name them, so a page
 * that signs the browser in again (the writer's status editor) goes last in `components`.
 */
export type Gate = {
  prototypePages: Record<string, PrototypePage>;
  livePages: Record<string, LivePage>;
  components: Component[];
  /** This page's exceptions; SHARED_EXCEPTIONS apply to every gate as well. */
  exceptions: Exception[];
  /**
   * #439: the components whose live text keeps the prototype's word breaking (overflow-wrap
   * normal). Every other component is in the overflow-wrap exception of SHARED_EXCEPTIONS.
   */
  wordBreakNormal?: readonly string[];
};

export const FONT = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "color",
] as const;
export const SIDES = ["top", "right", "bottom", "left"] as const;
const BOX = [
  ...SIDES.map((side) => `padding-${side}`),
  ...SIDES.flatMap((side) => [
    `border-${side}-width`,
    `border-${side}-style`,
    `border-${side}-color`,
  ]),
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "background-color",
] as const;
const LAYOUT = [
  ...SIDES.map((side) => `margin-${side}`),
  "display",
  "align-items",
  "justify-content",
  "flex-wrap",
  "row-gap",
  "column-gap",
  "min-width",
  "max-width",
  "min-height",
  "text-align",
  "vertical-align",
  "white-space",
  "text-decoration-line",
  "box-shadow",
  // #439: how a long word breaks (the app's body breaks anywhere; the prototype does not).
  "overflow-wrap",
  "word-break",
] as const;
export const STYLE = [...FONT, ...LAYOUT, ...BOX] as const;

// ---------------------------------------------------------------------------------------------
// The exceptions every gate shares.
// ---------------------------------------------------------------------------------------------

/**
 * The component name of an exception that applies to every compared component except the
 * WORD_BREAK_NORMAL ones, decided when a component is compared (differences), so rows added to
 * a gate later, and components compared in their own test, are covered too.
 */
export const EVERY_COMPONENT_BUT_WORD_BREAK_NORMAL = "(every component not in WORD_BREAK_NORMAL)";

export const SHARED_EXCEPTIONS: Exception[] = [
  {
    component: EVERY_COMPONENT_BUT_WORD_BREAK_NORMAL,
    properties: ["overflow-wrap"],
    reason:
      "Live text breaks a word longer than its line anywhere (the app's body, issue 100, and " +
      ".admin-code for the prompt text and retry_hints blocks); the prototype computes normal. " +
      "Real prompt and table text holds long unbroken tokens (JSON, keys, emails) and the " +
      "prototype's sample text does not: with normal they run out of their box and the page " +
      "clips them (#439 review round 3: a 200-character token was 1313 px wide in a 348 px " +
      "box). word-break is still compared everywhere, and overflow-wrap on the index table " +
      "cells (WORD_BREAK_NORMAL), which keep normal inside their scrolling panel.",
  },
];

// ---------------------------------------------------------------------------------------------
// The frame and the shared components (compared in e2e/admin-visual.spec.ts).
// ---------------------------------------------------------------------------------------------

export const FRAME_PROTOTYPE_PAGES: Record<string, PrototypePage> = {
  characters: { hash: "characters" },
  character: { hash: "character" },
  uitext: { hash: "uitext" },
  history: { hash: "history" },
  prompts: { hash: "prompts" },
  // The only text fields in the prototype are in the Regenerate dialog of Story cards.
  regenerate: {
    hash: "cards",
    prepare: async (page) => {
      await page.evaluate(() =>
        (window as unknown as { openRegen: (s: string, t: string) => void }).openRegen(
          "part",
          "p1",
        ),
      );
      await expect(page.locator("dialog.sheet textarea")).toBeVisible();
    },
  },
};

export const FRAME_LIVE_PAGES: Record<string, LivePage> = {
  companions: { path: "/admin/companions" },
  // No live page puts a full-size button in the header action row yet (pages adopt the row in
  // later pull requests). Until one does, the row's slot is filled with one main and one
  // secondary button of the admin's own button classes; replace this with the real page then.
  actions: {
    path: "/admin/companions",
    prepare: async (page) => {
      await page.locator(".admin-head").evaluate((head) => {
        const actions = document.createElement("div");
        actions.className = "admin-actions";
        actions.innerHTML =
          '<button class="button-gray" type="button">Save draft</button>' +
          '<button class="button-filled" type="button">Publish</button>';
        head.append(actions);
      });
    },
  },
  // #445: App text with one text typed into (in the browser only, nothing is saved), so its Save
  // draft and Cancel show.
  appTextEditing: {
    path: "/admin/app-text",
    prepare: async (page) => {
      const text = page.locator(".admin-table [contenteditable]").first();
      await expect(text).toHaveAttribute("contenteditable", "true");
      await text.click();
      await page.keyboard.press("End");
      await page.keyboard.type(" x");
      await expect(page.locator(".admin-table .button-gray.button-small").first()).toBeVisible();
    },
  },
  // #445: App text no longer has a text box (its texts are edited in place, as the prototype's),
  // and the pages that still have one are being rebuilt. The row checks the shared field class, so
  // a stand-in field of that class is put into a panel of a page that no test writes, as `actions`
  // does for the header buttons. It sits in the admin's form grid (.admin-text-form), as every live
  // field does, the way the prototype's sits in its .form label grid. A page that builds a form
  // like the prototype's adds its own row.
  textField: {
    path: "/admin/companions",
    prepare: async (page) => {
      await page
        .locator(".admin-panel")
        .first()
        .evaluate((panel) => {
          const form = document.createElement("div");
          form.className = "admin-text-form";
          const field = document.createElement("textarea");
          field.className = "admin-text-field";
          field.rows = 3;
          form.append(field);
          panel.append(form);
        });
    },
  },
  // A detail page: its menu row (Prompts) is marked as current.
  prompt: { path: "/admin/prompts/plan_split" },
};

export const FRAME_COMPONENTS: Component[] = [
  {
    name: "page (body / frame)",
    prototype: { page: "characters", selector: "body" },
    live: { page: "companions", selector: ".admin-shell" },
  },
  {
    name: "rail",
    prototype: { page: "characters", selector: ".rail" },
    live: { page: "companions", selector: ".admin-rail" },
    // x and y carry the 8 px page margin.
    box: ["x", "y", "width"],
  },
  {
    name: "brand block",
    prototype: { page: "characters", selector: ".brand" },
    live: { page: "companions", selector: ".admin-brand" },
    properties: [
      ...SIDES.map((side) => `margin-${side}`),
      ...SIDES.map((side) => `padding-${side}`),
    ],
    box: ["x", "y", "width"],
  },
  {
    name: "brand",
    prototype: { page: "characters", selector: ".brand" },
    live: { page: "companions", selector: ".admin-brand-name" },
  },
  {
    name: "brand line (Content admin)",
    prototype: { page: "characters", selector: ".brand small" },
    live: { page: "companions", selector: ".admin-brand-sub" },
  },
  {
    name: "menu group heading",
    prototype: { page: "characters", selector: ".navgroup" },
    live: { page: "companions", selector: ".admin-group-heading" },
    box: ["height"],
  },
  {
    name: "menu row",
    prototype: { page: "characters", selector: ".rail a:not(.on)" },
    live: { page: "companions", selector: ".admin-menu-link:not([aria-current])" },
    box: ["width", "height"],
  },
  {
    name: "menu row, current",
    prototype: { page: "characters", selector: ".rail a.on" },
    live: { page: "companions", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "menu row, current on a detail page",
    prototype: { page: "prompts", selector: ".rail a.on" },
    live: { page: "prompt", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "menu page id",
    prototype: { page: "characters", selector: ".rail a:not(.on) .k" },
    live: { page: "companions", selector: ".admin-menu-link:not([aria-current]) .admin-page-id" },
  },
  {
    name: "content column",
    prototype: { page: "characters", selector: "main" },
    live: { page: "companions", selector: ".admin-main" },
    box: ["x", "y", "width", "contentWidth"],
  },
  {
    name: "breadcrumb",
    prototype: { page: "characters", selector: ".crumb" },
    live: { page: "companions", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "header row",
    prototype: { page: "characters", selector: ".head" },
    live: { page: "companions", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "page title",
    prototype: { page: "characters", selector: ".head h1" },
    live: { page: "companions", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "lede",
    prototype: { page: "characters", selector: ".head .lede" },
    live: { page: "companions", selector: ".admin-head .admin-lede" },
  },
  {
    name: "header action row",
    prototype: { page: "uitext", selector: ".head .btns" },
    live: { page: "actions", selector: ".admin-head .admin-actions" },
  },
  {
    name: "panel",
    prototype: { page: "characters", selector: ".panel" },
    live: { page: "companions", selector: ".admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "table",
    prototype: { page: "characters", selector: "table" },
    live: { page: "companions", selector: ".admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "table head cell",
    prototype: { page: "characters", selector: "th" },
    live: { page: "companions", selector: ".admin-table th" },
    box: ["height"],
  },
  {
    name: "table cell",
    prototype: { page: "characters", selector: "td" },
    live: { page: "companions", selector: ".admin-table td" },
  },
  {
    name: "id chip",
    prototype: { page: "characters", selector: "td .key" },
    live: { page: "companions", selector: ".admin-table .admin-chip" },
    box: ["height"],
  },
  {
    name: "pill (Published)",
    prototype: { page: "characters", selector: ".pill.s-pub" },
    live: { page: "companions", selector: ".admin-pill-published" },
    box: ["height"],
  },
  {
    name: "pill dot",
    prototype: { page: "characters", selector: ".pill.s-pub" },
    live: { page: "companions", selector: ".admin-pill-published" },
    pseudo: "::before",
    properties: [...STYLE, "width", "height", "content"],
  },
  {
    name: "main button",
    prototype: { page: "uitext", selector: ".head button.primary" },
    live: { page: "actions", selector: ".admin-actions .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "secondary button",
    prototype: { page: "character", selector: ".head .btns button:not(.primary)" },
    live: { page: "actions", selector: ".admin-actions .button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "small secondary button",
    prototype: { page: "history", selector: "td button.small" },
    live: { page: "appTextEditing", selector: ".admin-table .button-gray.button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "text field",
    prototype: { page: "regenerate", selector: "dialog.sheet textarea" },
    live: { page: "textField", selector: ".admin-panel textarea.admin-text-field" },
    properties: [...STYLE, "resize"],
  },
];

export const FRAME_EXCEPTIONS: Exception[] = [
  {
    component: "page (body / frame)",
    properties: [
      ...SIDES.map((side) => `margin-${side}`),
      ...SIDES.map((side) => `padding-${side}`),
      "display",
      "min-width",
      "min-height",
    ],
    reason:
      "Same result, built differently. The prototype's 8 px is the browser's default body margin " +
      "around a .app grid; the admin has no body of its own, so .admin-shell is the grid and " +
      "carries the 8 px as padding, with the 1024 px minimum (ADMIN-DESKTOP). The result is " +
      "compared: rail x/y/width, content column x/y/width and header row x/y.",
  },
  {
    component: "rail",
    properties: ["display"],
    reason:
      "The live rail is a flex column so Sign out (not in the prototype) sits at its foot. Its " +
      "parts (brand, group headings, rows) are compared one by one, with their heights and widths.",
  },
  {
    component: "brand",
    properties: [...SIDES.map((side) => `padding-${side}`), "min-width", "min-height"],
    reason:
      "The prototype's .brand is one block; live splits it into the brand link (.admin-brand, " +
      "which carries the padding, compared as `brand block`) and the name inside it, a flex item " +
      "whose minimum size computes to auto instead of 0px. No minimum binds on either side.",
  },
  {
    component: "brand line (Content admin)",
    properties: ["min-width", "min-height"],
    reason: "A flex item on live (auto) and a block in the prototype (0px); no minimum binds.",
  },
  ...["main button", "secondary button", "small secondary button"].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the prototype has none (auto). Neither draws a minimum: the button's " +
      "height is compared as `box height`.",
  })),
  {
    component: "text field",
    properties: ["font-weight"],
    reason:
      "Both fields inherit the weight (font: inherit). The prototype's only field sits inside a " +
      ".form label (600); the live stand-in field sits in a panel (400). The page pull request " +
      "that builds a form like the prototype's compares the weight there.",
  },
];

export const FRAME_GATE: Gate = {
  prototypePages: FRAME_PROTOTYPE_PAGES,
  livePages: FRAME_LIVE_PAGES,
  components: FRAME_COMPONENTS,
  exceptions: FRAME_EXCEPTIONS,
};

// ---------------------------------------------------------------------------------------------
// Reading and comparing.
// ---------------------------------------------------------------------------------------------

export type Reading = Record<string, string | number>;

export async function read(page: Page, component: Component, side: "prototype" | "live") {
  const { selector } = component[side];
  const properties = component.properties ?? STYLE;
  const element = page.locator(selector).first();
  await expect(element, `${component.name}: ${side} ${selector}`).toBeAttached();
  return element.evaluate(
    (node, { properties, box, pseudo }) => {
      const computed = getComputedStyle(node, pseudo);
      const values: Record<string, string | number> = {};
      for (const name of properties) {
        let value = computed.getPropertyValue(name);
        // The first family is the font the page asks for; the rest are fallbacks.
        if (name === "font-family")
          value = value
            .split(",")[0]
            .trim()
            .replace(/^["']|["']$/g, "");
        values[name] = value;
      }
      // A side with no border width draws nothing, whatever its style and colour say (the app's
      // base styles give every element a solid hairline colour of width 0).
      for (const side of ["top", "right", "bottom", "left"]) {
        if (computed.getPropertyValue(`border-${side}-width`) !== "0px") continue;
        for (const part of ["style", "color"]) {
          if (`border-${side}-${part}` in values) values[`border-${side}-${part}`] = "no border";
        }
      }
      const rect = node.getBoundingClientRect();
      const px = (name: string) => parseFloat(computed.getPropertyValue(name)) || 0;
      const measures: Record<string, number> = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        contentWidth:
          rect.width -
          px("padding-left") -
          px("padding-right") -
          px("border-left-width") -
          px("border-right-width"),
      };
      for (const metric of box) values[`box ${metric}`] = Math.round(measures[metric] * 100) / 100;
      return values;
    },
    {
      properties: [...properties],
      box: [...(component.box ?? [])],
      pseudo: component.pseudo ?? null,
    },
  );
}

const PX = /^-?\d+(\.\d+)?px$/;

/**
 * Differences between two readings of one gate's component: over 1 px, any other value (colours
 * included) not equal. The gate's exceptions and SHARED_EXCEPTIONS are skipped.
 */
export function differences(gate: Gate, name: string, prototype: Reading, live: Reading): string[] {
  const found: string[] = [];
  const wordBreakNormal = new Set(gate.wordBreakNormal ?? []);
  const skipped = new Set(
    [...SHARED_EXCEPTIONS, ...gate.exceptions]
      .filter(
        (item) =>
          item.component === name ||
          (item.component === EVERY_COMPONENT_BUT_WORD_BREAK_NORMAL && !wordBreakNormal.has(name)),
      )
      .flatMap((item) => item.properties),
  );
  for (const key of Object.keys(prototype)) {
    if (skipped.has(key)) continue;
    const a = prototype[key];
    const b = live[key];
    if (typeof a === "number" && typeof b === "number") {
      if (Math.abs(a - b) > 1) found.push(`${name} · ${key}: prototype ${a} px, live ${b} px`);
    } else if (typeof a === "string" && typeof b === "string" && PX.test(a) && PX.test(b)) {
      if (Math.abs(parseFloat(a) - parseFloat(b)) > 1) {
        found.push(`${name} · ${key}: prototype ${a}, live ${b}`);
      }
    } else if (a !== b) {
      found.push(`${name} · ${key}: prototype ${String(a)}, live ${String(b)}`);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Opening both sides.
// ---------------------------------------------------------------------------------------------

/**
 * The app's own @font-face rules for the three admin fonts, with absolute URLs. They answer the
 * prototype's Google Fonts request, so the prototype draws the same files without the network.
 */
async function adminFontFaces(page: Page): Promise<string> {
  return page.evaluate(() => {
    const families = new Set(["Fraunces", "IBM Plex Sans", "IBM Plex Mono"]);
    const rules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(list)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
        if (!families.has(family)) continue;
        rules.push(
          rule.cssText.replace(
            /url\((["']?)([^"')]+)\1\)/g,
            (_match, _quote, url: string) =>
              `url("${new URL(url, sheet.href ?? location.href).href}")`,
          ),
        );
      }
    }
    return rules.join("\n");
  });
}

async function servePrototype(page: Page, fontFaces: string) {
  const html = STANDARDS_MODE + readFileSync(PROTOTYPE_FILE, "utf8");
  await page.route(`**${PROTOTYPE_PATH}`, (route) =>
    route.fulfill({ body: html, contentType: "text/html; charset=utf-8" }),
  );
  const aiFeatures = readFileSync(AI_FEATURES_FILE, "utf8");
  await page.route(`**${AI_FEATURES_PATH}`, (route) =>
    route.fulfill({ body: aiFeatures, contentType: "text/html; charset=utf-8" }),
  );
  const hotlines = STANDARDS_MODE + readFileSync(HOTLINES_FILE, "utf8");
  await page.route(`**${HOTLINES_PATH}`, (route) =>
    route.fulfill({ body: hotlines, contentType: "text/html; charset=utf-8" }),
  );
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ body: fontFaces, contentType: "text/css; charset=utf-8" }),
  );
  // Nothing else leaves the machine.
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
}

/**
 * Opens `start` (an admin path) and serves the prototype files from the app's origin, with the
 * app's own admin fonts. Returns that origin.
 */
export async function startPrototypeServing(page: Page, start = "/admin/companions") {
  await page.goto(start);
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  return origin;
}

export async function openPrototype(page: Page, origin: string, target: PrototypePage) {
  // A fresh load per screen, so one screen's dialog or state never leaks into the next.
  const file =
    target.file === "aiFeatures"
      ? AI_FEATURES_PATH
      : target.file === "hotlines"
        ? HOTLINES_PATH
        : PROTOTYPE_PATH;
  await page.goto(`${origin}${file}#${target.hash}`);
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await target.prepare?.(page);
}

export async function openLive(page: Page, target: LivePage) {
  await page.goto(target.path);
  await expect(page.locator(".admin-main h1")).toBeVisible();
  // Wait until React has hydrated the shell and the page has settled: an element added before
  // that (the stand-in buttons) can be thrown away by a late render.
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const shell = document.querySelector(".admin-shell");
    return !!shell && Object.keys(shell).some((key) => key.startsWith("__reactFiber"));
  });
  await page.evaluate(() => document.fonts.ready);
  await target.prepare?.(page);
}

function pageOf<T>(pages: Record<string, T>, key: string): T {
  const target = pages[key];
  if (!target) throw new Error(`the gate names a page it does not define: ${key}`);
  return target;
}

async function collect(
  page: Page,
  gate: Gate,
  side: "prototype" | "live",
  open: (key: string) => Promise<void>,
): Promise<Map<string, Reading>> {
  const readings = new Map<string, Reading>();
  const pages = [...new Set(gate.components.map((component) => component[side].page))];
  for (const key of pages) {
    await open(key);
    for (const component of gate.components.filter((item) => item[side].page === key)) {
      readings.set(component.name, await read(page, component, side));
    }
  }
  return readings;
}

/**
 * Signs the browser in as an admin whose views do not depend on other tests' writes: #446 the
 * seeded prompts only (drafts other tests save never change the prompt pages), #448 its own
 * read-only copy of the seed hotline list, and #447 a fixed, seeded publish history (#460).
 */
export async function signInGateAccount(page: Page, context: BrowserContext) {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await seededPromptsView(account.token);
  await ownHotlinesView(account.token, "seeded");
  await seededPublishHistoryView(account);
  return account;
}

/**
 * Reads every component of the gate on both sides at one width, as the gate account, and returns
 * the differences (empty when the page matches the prototype).
 */
export async function compareGate(
  page: Page,
  context: BrowserContext,
  gate: Gate,
  width: number,
): Promise<string[]> {
  await page.setViewportSize({ width, height: HEIGHT });
  await signInGateAccount(page, context);
  const origin = await startPrototypeServing(page);
  const live = await collect(page, gate, "live", (key) =>
    openLive(page, pageOf(gate.livePages, key)),
  );
  const prototype = await collect(page, gate, "prototype", (key) =>
    openPrototype(page, origin, pageOf(gate.prototypePages, key)),
  );
  return gate.components.flatMap((component) =>
    differences(
      gate,
      component.name,
      prototype.get(component.name) ?? {},
      live.get(component.name) ?? {},
    ),
  );
}

/** Records the gate for the inventory (scripts/admin-visual-inventory.mjs). */
export function registerGate(gate: Gate): Gate {
  recordInventory({
    components: gate.components,
    exceptions: [...SHARED_EXCEPTIONS, ...gate.exceptions],
    wordBreakNormal: new Set(gate.wordBreakNormal ?? []),
    everyComponentKey: EVERY_COMPONENT_BUT_WORD_BREAK_NORMAL,
    defaultProperties: STYLE,
    prototypePages: gate.prototypePages,
    livePages: gate.livePages,
  });
  return gate;
}

/** The gate test of one page at each width: `title(width)` names it. */
export function gateTests(gate: Gate, title: (width: number) => string) {
  registerGate(gate);
  for (const width of WIDTHS) {
    test(title(width), async ({ page, context }) => {
      test.setTimeout(120_000);
      const found = await compareGate(page, context, gate, width);
      expect(found, `differences from the prototype at ${width} px`).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// The pictures for pull requests (written only with ADMIN_VISUAL_SCREENSHOTS=1).
// ---------------------------------------------------------------------------------------------

/** Skips the test unless ADMIN_VISUAL_SCREENSHOTS is set, and makes the reference folder. */
export function picturesOnRequest(timeout: number) {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(timeout);
  mkdirSync(REFERENCE_DIR, { recursive: true });
}

/**
 * Writes <name>-<width>-prototype.png, -live.png and -side-by-side.png (prototype on the left).
 * `alignTop` keeps two pictures of different heights at the top of the side-by-side picture.
 */
export async function writePicturePair(
  page: Page,
  picture: {
    name: string;
    width: number;
    height: number;
    prototype: Buffer;
    live: Buffer;
    alignTop?: boolean;
    prototypeCaption?: string;
    liveCaption?: string;
  },
) {
  const { name, width, height, prototype, live } = picture;
  writeFileSync(path.join(REFERENCE_DIR, `${name}-${width}-prototype.png`), prototype);
  writeFileSync(path.join(REFERENCE_DIR, `${name}-${width}-live.png`), live);

  const image = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
  const align = picture.alignTop ? "align-items:flex-start;" : "";
  const prototypeCaption = picture.prototypeCaption ?? "Prototype (standards mode)";
  const liveCaption = picture.liveCaption ?? "Live admin";
  await page.setViewportSize({ width: width * 2 + 48, height: height + 56 });
  await page.setContent(
    `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#888;display:flex;${align}gap:16px;font:14px system-ui;color:#fff">` +
      `<figure style="margin:0"><figcaption>${prototypeCaption}, ${width} px</figcaption><img src="${image(prototype)}"></figure>` +
      `<figure style="margin:0"><figcaption>${liveCaption}, ${width} px</figcaption><img src="${image(live)}"></figure></body>`,
  );
  writeFileSync(
    path.join(REFERENCE_DIR, `${name}-${width}-side-by-side.png`),
    await page.screenshot({ fullPage: true }),
  );
}

export type Picture = {
  name: string;
  prototype: PrototypePage;
  live: LivePage;
  fullPage: boolean;
  /** The viewport height; HEIGHT when not given. */
  height?: number;
  alignTop?: boolean;
  prototypeCaption?: string;
  liveCaption?: string;
};

/** Writes each picture at each width. */
export async function writePictures(page: Page, origin: string, pictures: readonly Picture[]) {
  for (const picture of pictures) {
    const height = picture.height ?? HEIGHT;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height });
      await openPrototype(page, origin, picture.prototype);
      const prototype = await page.screenshot({ fullPage: picture.fullPage });
      await openLive(page, picture.live);
      const live = await page.screenshot({ fullPage: picture.fullPage });
      await writePicturePair(page, { ...picture, width, height, prototype, live });
    }
  }
}
