import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

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
// To compare a new component, add a row to COMPONENTS (and, if needed, a page to
// PROTOTYPE_PAGES / LIVE_PAGES). Page pull requests extend this map; they do not loosen it.
//
// Run with ADMIN_VISUAL_SCREENSHOTS=1 to (re)write the prototype vs live pictures of the frame in
// docs/design/reference/admin/.

test.use({ colorScheme: "light", isMobile: false, hasTouch: false });

const WIDTHS = [1024, 1280] as const;
const HEIGHT = 800;
const PROTOTYPE_FILE = path.join(__dirname, "..", "docs/design/prototype/admin-prototype.html");
const REFERENCE_DIR = path.join(__dirname, "..", "docs/design/reference/admin");
const PROTOTYPE_PATH = "/__admin-visual/admin-prototype.html";
const STANDARDS_MODE = "<!doctype html><meta charset=utf-8>";

// ---------------------------------------------------------------------------------------------
// The selector map. One place: pages first, then the components compared on them.
// ---------------------------------------------------------------------------------------------

type PageSetup = (page: Page) => Promise<void>;

/** Prototype screens by hash, with any step needed to show a component. */
const PROTOTYPE_PAGES: Record<string, { hash: string; prepare?: PageSetup }> = {
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

/** Live admin pages by path, with any step needed to show a component. */
const LIVE_PAGES: Record<string, { path: string; prepare?: PageSetup }> = {
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
  appText: { path: "/admin/app-text" },
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

type Side = { page: string; selector: string };
type Metric = "x" | "y" | "width" | "height" | "contentWidth";
type Component = {
  name: string;
  prototype: Side & { page: keyof typeof PROTOTYPE_PAGES };
  live: Side & { page: keyof typeof LIVE_PAGES };
  /** Computed style properties; STYLE when not given. Exceptions go in EXCEPTIONS, not here. */
  properties?: readonly string[];
  /** Read the styles of a pseudo-element instead (the pill's dot). */
  pseudo?: "::before";
  /** Box measurements in px (rounded); "contentWidth" is the width inside padding and border. */
  box?: readonly Metric[];
};

const FONT = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "color",
] as const;
const SIDES = ["top", "right", "bottom", "left"] as const;
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
] as const;
const STYLE = [...FONT, ...LAYOUT, ...BOX] as const;

const COMPONENTS: Component[] = [
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
  // #445: App text (ADM-07), the prototype's `uitext` screen: the header with Publish changes, and
  // one line per key with its text edited in place. Rows read the first line (ui.F3.fail.body), which no test writes.
  {
    name: "header row (App text)",
    prototype: { page: "uitext", selector: ".head" },
    live: { page: "appText", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "header action row (App text)",
    prototype: { page: "uitext", selector: ".head .btns" },
    live: { page: "appText", selector: ".admin-head .admin-actions" },
  },
  {
    name: "panel (App text)",
    prototype: { page: "uitext", selector: ".panel" },
    live: { page: "appText", selector: ".admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "table (App text)",
    prototype: { page: "uitext", selector: "table" },
    live: { page: "appText", selector: ".admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "table head cell (App text)",
    prototype: { page: "uitext", selector: "th" },
    live: { page: "appText", selector: ".admin-table th" },
    box: ["height"],
  },
  {
    name: "table cell (App text)",
    prototype: { page: "uitext", selector: "td" },
    live: { page: "appText", selector: ".admin-table td" },
  },
  {
    // The issue's finding: a line was 241 px tall live against 39.6 px in the prototype.
    name: "table line (App text)",
    prototype: { page: "uitext", selector: "tbody tr" },
    live: { page: "appText", selector: ".admin-table tbody tr" },
    box: ["height"],
  },
  {
    name: "id chip (App text)",
    prototype: { page: "uitext", selector: "td .key" },
    live: { page: "appText", selector: ".admin-table .admin-chip" },
    box: ["height"],
  },
  {
    name: "text, edited in place (App text)",
    prototype: { page: "uitext", selector: "td [contenteditable]" },
    live: { page: "appText", selector: ".admin-table [contenteditable]" },
  },
  {
    name: "pill (App text, Published)",
    prototype: { page: "uitext", selector: "td .pill.s-pub" },
    live: { page: "appText", selector: ".admin-table .admin-pill-published" },
    box: ["height"],
  },
];

/**
 * Every deliberate gap in the comparison, in one place, each with its reason. A property listed
 * here is not compared for that component; nothing else is skipped. Content-dependent sizes (the
 * width of a pill, chip, button or menu label; the height of a cell, panel, lede or text box) are
 * never measured: only the sizes named in a component's `box` are.
 */
const EXCEPTIONS: { component: string; properties: string[]; reason: string }[] = [
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
  {
    component: "Companion name link (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "Live Companions shows each name as an underlined link (.admin-cell-name); the prototype " +
      "shows bold text in a clickable row, so there is nothing to compare it with. Links look the " +
      "same on both sides (the prototype keeps the browser's underline too). The Companions page " +
      "pull request (#430 T8) decides the row and adds it here.",
  },
  // #445: App text.
  {
    component: "text, edited in place (App text)",
    properties: ["white-space"],
    reason:
      "Live is pre-wrap, the prototype normal: a stored text may hold a line break or a double " +
      "space (the earlier editor was a text box that allowed them); they must stay visible and be " +
      "saved back unchanged.",
  },
  {
    component: "main button (App text) (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "Publish changes is disabled while no key has a newer draft, which is the seed the gate " +
      "reads (gate tests never write drafts). A disabled button draws cursor not-allowed and 35% " +
      "opacity, so it is not compared with the prototype's enabled button. The enabled main " +
      "button is compared as `main button`; the row it sits in as `header action row (App text)`.",
  },
];

// ---------------------------------------------------------------------------------------------
// Reading and comparing.
// ---------------------------------------------------------------------------------------------

type Reading = Record<string, string | number>;

async function read(page: Page, component: Component, side: "prototype" | "live") {
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

/** Differences between two readings: over 1 px, any other value (colours included) not equal. */
function differences(name: string, prototype: Reading, live: Reading): string[] {
  const found: string[] = [];
  const skipped = new Set(
    EXCEPTIONS.filter((item) => item.component === name).flatMap((item) => item.properties),
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
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ body: fontFaces, contentType: "text/css; charset=utf-8" }),
  );
  // Nothing else leaves the machine.
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
}

async function openPrototype(page: Page, origin: string, key: string) {
  const target = PROTOTYPE_PAGES[key];
  // A fresh load per screen, so one screen's dialog or state never leaks into the next.
  await page.goto(`${origin}${PROTOTYPE_PATH}#${target.hash}`);
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await target.prepare?.(page);
}

async function openLive(page: Page, key: string) {
  const target = LIVE_PAGES[key];
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

async function collect(
  page: Page,
  side: "prototype" | "live",
  open: (key: string) => Promise<void>,
): Promise<Map<string, Reading>> {
  const readings = new Map<string, Reading>();
  const pages = [...new Set(COMPONENTS.map((component) => component[side].page))];
  for (const key of pages) {
    await open(key);
    for (const component of COMPONENTS.filter((item) => item[side].page === key)) {
      readings.set(component.name, await read(page, component, side));
    }
  }
  return readings;
}

for (const width of WIDTHS) {
  test(`test_435_ac5_fixed_components_match_the_prototype_at_${width}_px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: HEIGHT });
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    await page.goto("/admin/companions");
    const origin = new URL(page.url()).origin;
    await servePrototype(page, await adminFontFaces(page));

    const live = await collect(page, "live", (key) => openLive(page, key));
    const prototype = await collect(page, "prototype", (key) => openPrototype(page, origin, key));

    // AC1 "renders them": the live admin has drawn its three fonts at the weights it uses.
    await openLive(page, "companions");
    // fonts.load() answers the faces that serve a font; none means the browser falls back.
    const missing = await page.evaluate(async () => {
      const wanted = [
        '500 19px "Fraunces"',
        '600 26px "Fraunces"',
        '400 14px "IBM Plex Sans"',
        '500 11px "IBM Plex Sans"',
        '600 14px "IBM Plex Sans"',
        '400 10.5px "IBM Plex Mono"',
        '500 12px "IBM Plex Mono"',
      ];
      const loaded = await Promise.all(wanted.map((font) => document.fonts.load(font, "Aa")));
      return wanted.filter(
        (_font, index) =>
          loaded[index].length === 0 || loaded[index].some((face) => face.status !== "loaded"),
      );
    });
    expect(missing, "admin fonts that did not load").toEqual([]);

    const found = COMPONENTS.flatMap((component) =>
      differences(
        component.name,
        prototype.get(component.name) ?? {},
        live.get(component.name) ?? {},
      ),
    );
    expect(found, `differences from the prototype at ${width} px`).toEqual([]);
  });
}

// The pictures for the pull request: the frame (Companions vs the prototype's Characters) at each
// width, prototype on the left, live on the right. Written only on request.
test("test_435_frame_pictures_prototype_vs_live", async ({ page, context }) => {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(120_000);
  mkdirSync(REFERENCE_DIR, { recursive: true });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    await openPrototype(page, origin, "characters");
    const prototype = await page.screenshot();
    await openLive(page, "companions");
    const live = await page.screenshot();
    writeFileSync(path.join(REFERENCE_DIR, `frame-${width}-prototype.png`), prototype);
    writeFileSync(path.join(REFERENCE_DIR, `frame-${width}-live.png`), live);

    const image = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
    await page.setViewportSize({ width: width * 2 + 48, height: HEIGHT + 56 });
    await page.setContent(
      `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#888;display:flex;gap:16px;font:14px system-ui;color:#fff">` +
        `<figure style="margin:0"><figcaption>Prototype (standards mode), ${width} px</figcaption><img src="${image(prototype)}"></figure>` +
        `<figure style="margin:0"><figcaption>Live admin, ${width} px</figcaption><img src="${image(live)}"></figure></body>`,
    );
    writeFileSync(
      path.join(REFERENCE_DIR, `frame-${width}-side-by-side.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
});

// #445: the App text pictures for its pull request (prototype `uitext` vs live App text, as an
// admin) at each width. Written only on request.
test("test_445_app_text_pictures_prototype_vs_live", async ({ page, context }) => {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(120_000);
  mkdirSync(REFERENCE_DIR, { recursive: true });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/app-text");
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    await openPrototype(page, origin, "uitext");
    const prototype = await page.screenshot();
    await openLive(page, "appText");
    const live = await page.screenshot();
    writeFileSync(path.join(REFERENCE_DIR, `app-text-${width}-prototype.png`), prototype);
    writeFileSync(path.join(REFERENCE_DIR, `app-text-${width}-live.png`), live);

    const image = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
    await page.setViewportSize({ width: width * 2 + 48, height: HEIGHT + 56 });
    await page.setContent(
      `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#888;display:flex;gap:16px;font:14px system-ui;color:#fff">` +
        `<figure style="margin:0"><figcaption>Prototype (standards mode), ${width} px</figcaption><img src="${image(prototype)}"></figure>` +
        `<figure style="margin:0"><figcaption>Live admin, ${width} px</figcaption><img src="${image(live)}"></figure></body>`,
    );
    writeFileSync(
      path.join(REFERENCE_DIR, `app-text-${width}-side-by-side.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
});
