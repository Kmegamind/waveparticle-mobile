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
// #439: the AI feature screens drawn in the prototype's look (#432). The file starts with its own
// doctype and charset, so it is served as it is.
const AI_FEATURES_FILE = path.join(__dirname, "..", "docs/design/prototype/admin-ai-features.html");
const AI_FEATURES_PATH = "/__admin-visual/admin-ai-features.html";

// ---------------------------------------------------------------------------------------------
// The selector map. One place: pages first, then the components compared on them.
// ---------------------------------------------------------------------------------------------

type PageSetup = (page: Page) => Promise<void>;

/**
 * Prototype screens by hash, with any step needed to show a component. `file: "aiFeatures"` is a
 * screen of docs/design/prototype/admin-ai-features.html; the others are admin-prototype.html.
 */
const PROTOTYPE_PAGES: Record<string, { hash: string; file?: "aiFeatures"; prepare?: PageSetup }> =
  {
    // #439: the AI features index (AIF-1) and the feature page (AIF-2, the Pause message).
    aiIndex: { hash: "index", file: "aiFeatures" },
    aiFeature: { hash: "feature", file: "aiFeatures" },
    // #453: the status editor (AIF-5) as an admin and as a writer, the pass standard editor
    // (AIF-6) and the purpose and approach editor (AIF-7).
    aiStatus: { hash: "status", file: "aiFeatures" },
    aiStatusWriter: {
      hash: "status",
      file: "aiFeatures",
      prepare: async (page) => {
        await page.getByRole("button", { name: "View as writer" }).click();
        await expect(page.locator(".panel.ro")).toBeVisible();
      },
    },
    aiPass: { hash: "pass", file: "aiFeatures" },
    aiPurpose: { hash: "purpose", file: "aiFeatures" },
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
  // A detail page: its menu row (Prompts) is marked as current.
  prompt: { path: "/admin/prompts/plan_split" },
  // #444: one story's cards. No test writes "site-search", so the gate reads the seed as loaded.
  storyCards: { path: "/admin/stories/site-search" },
  // #442: Companion profile (ADM-04), the prototype's `character` screen.
  companion: { path: "/admin/companions/oppenheimer" },
  // #439: the AI features index and the Pause message page, as the drawing's AIF-1 and AIF-2.
  aiIndex: { path: "/admin/ai-features" },
  aiFeature: { path: "/admin/ai-features/pause_message" },
  // #453: the editors of the Pause message, as the drawing's AIF-5, AIF-6 and AIF-7. Nothing is
  // saved: the gate only opens them.
  aiStatus: { path: "/admin/ai-features/pause_message/status" },
  aiPass: { path: "/admin/ai-features/pause_message/pass" },
  aiPurpose: { path: "/admin/ai-features/pause_message/purpose" },
  // The writer's view of the status editor: this page signs the browser in again as a writer, so
  // it is the last live page COMPONENTS names (the pages are opened in the order of the map).
  aiStatusWriter: {
    path: "/admin/ai-features/pause_message/status",
    prepare: async (page) => {
      await signIn(page.context(), new URL(page.url()).origin, undefined, {
        contentRole: "writer",
      });
      await page.reload();
      await expect(page.locator(".admin-ro")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const shell = document.querySelector(".admin-shell");
        return !!shell && Object.keys(shell).some((key) => key.startsWith("__reactFiber"));
      });
      await page.evaluate(() => document.fonts.ready);
    },
  },
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
  // #439: how a long word breaks (the app's body breaks anywhere; the prototype does not).
  "overflow-wrap",
  "word-break",
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
    live: { page: "appText", selector: ".admin-table .button-gray.button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "text field",
    prototype: { page: "regenerate", selector: "dialog.sheet textarea" },
    live: { page: "appText", selector: ".admin-table textarea.admin-text-field" },
    properties: [...STYLE, "resize"],
  },
  // #442: Companion profile (ADM-04): the real header actions, the tabs and the dl.fields rows.
  // Read on Oppenheimer's Profile tab, whose fields no other test writes.
  {
    name: "header row (Companion profile)",
    prototype: { page: "character", selector: ".head" },
    live: { page: "companion", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "header action row (Companion profile)",
    prototype: { page: "character", selector: ".head .btns" },
    live: { page: "companion", selector: ".admin-head .admin-actions" },
  },
  {
    name: "main button (Companion profile)",
    prototype: { page: "character", selector: ".head button.primary" },
    live: { page: "companion", selector: ".admin-head .admin-actions .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "secondary button (Companion profile)",
    prototype: { page: "character", selector: ".head .btns button:not(.primary)" },
    live: { page: "companion", selector: ".admin-head .admin-actions .button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "tab bar",
    prototype: { page: "character", selector: ".tabs" },
    live: { page: "companion", selector: ".admin-tabs" },
    box: ["x", "width", "height"],
  },
  {
    name: "tab",
    prototype: { page: "character", selector: ".tabs button:not(.on)" },
    live: { page: "companion", selector: '.admin-tab[aria-selected="false"]' },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "tab, current",
    prototype: { page: "character", selector: ".tabs button.on" },
    live: { page: "companion", selector: '.admin-tab[aria-selected="true"]' },
    properties: [...STYLE, "cursor"],
    box: ["x", "height"],
  },
  {
    name: "fields panel",
    prototype: { page: "character", selector: ".tabs + .panel" },
    live: { page: "companion", selector: ".admin-tabs + .admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "field list (dl.fields)",
    prototype: { page: "character", selector: "dl.fields" },
    live: { page: "companion", selector: "dl.admin-fields" },
    box: ["x", "width"],
  },
  {
    name: "field label (dt)",
    prototype: { page: "character", selector: "dl.fields dt" },
    live: { page: "companion", selector: "dl.admin-fields dt" },
    box: ["x", "width"],
  },
  {
    name: "field value (dd)",
    prototype: { page: "character", selector: "dl.fields dd" },
    live: { page: "companion", selector: "dl.admin-fields dd" },
    box: ["x", "width"],
  },
  {
    name: "field id chip",
    prototype: { page: "character", selector: "dl.fields dt .key" },
    live: { page: "companion", selector: "dl.admin-fields dt .admin-chip" },
    box: ["height"],
  },
  {
    name: "field text, edited in place",
    prototype: { page: "character", selector: "dl.fields dd [contenteditable]" },
    live: { page: "companion", selector: "dl.admin-fields dd [contenteditable]" },
  },
  {
    name: "field pill (Published)",
    prototype: { page: "character", selector: "dl.fields dd .pill.s-pub" },
    live: { page: "companion", selector: "dl.admin-fields dd .admin-pill-published" },
    box: ["height"],
  },
  {
    // The prototype's Draft pill; live draws Draft, Not written and Read only in the same grey.
    name: "field pill (grey)",
    prototype: { page: "character", selector: "dl.fields dd .pill.s-draft" },
    live: { page: "companion", selector: "dl.admin-fields dd .admin-pill-earlier" },
    box: ["height"],
  },
  {
    name: "panel note",
    prototype: { page: "character", selector: ".panel > .note" },
    live: { page: "companion", selector: ".admin-panel > .admin-fields-note" },
  },
  // #439: the AI features index (drawing AIF-1). The table's rows are seed data; only their parts
  // are compared, never their text or their heights.
  {
    name: "AI features: menu row, current",
    prototype: { page: "aiIndex", selector: ".rail a.on" },
    live: { page: "aiIndex", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "AI features: header row",
    prototype: { page: "aiIndex", selector: ".head" },
    live: { page: "aiIndex", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "AI features: lede",
    prototype: { page: "aiIndex", selector: ".head .lede" },
    live: { page: "aiIndex", selector: ".admin-head .admin-lede" },
  },
  {
    name: "AI features: panel",
    prototype: { page: "aiIndex", selector: ".panel" },
    live: { page: "aiIndex", selector: ".admin-panel" },
    box: ["x", "y", "width"],
  },
  {
    name: "AI features: table",
    prototype: { page: "aiIndex", selector: "table" },
    live: { page: "aiIndex", selector: ".admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "AI features: table head cell",
    prototype: { page: "aiIndex", selector: "th" },
    live: { page: "aiIndex", selector: ".admin-table th" },
    box: ["height"],
  },
  {
    name: "AI features: feature cell",
    prototype: { page: "aiIndex", selector: "td:first-child" },
    live: { page: "aiIndex", selector: ".admin-table td:first-child" },
  },
  {
    name: "AI features: feature name",
    prototype: { page: "aiIndex", selector: "td b" },
    live: { page: "aiIndex", selector: ".admin-table td b" },
  },
  {
    name: "AI features: purpose cell",
    prototype: { page: "aiIndex", selector: "td.note" },
    live: { page: "aiIndex", selector: ".admin-table td.admin-cell-note" },
  },
  {
    name: "AI features: status pill (Exploring)",
    prototype: { page: "aiIndex", selector: "td .pill.s-gen" },
    live: { page: "aiIndex", selector: ".admin-table .admin-pill-ai-exploring" },
    box: ["height"],
  },
  {
    name: "AI features: status pill dot",
    prototype: { page: "aiIndex", selector: "td .pill.s-gen" },
    live: { page: "aiIndex", selector: ".admin-table .admin-pill-ai-exploring" },
    pseudo: "::before",
    properties: [...STYLE, "width", "height", "content"],
  },
  {
    name: "AI features: version chip",
    prototype: { page: "aiIndex", selector: "td .key" },
    live: { page: "aiIndex", selector: ".admin-table .admin-chip" },
    box: ["height"],
  },
  {
    name: "AI features: status legend",
    prototype: { page: "aiIndex", selector: ".legend" },
    live: { page: "aiIndex", selector: ".admin-legend" },
    box: ["width"],
  },
  {
    name: "AI features: legend item",
    prototype: { page: "aiIndex", selector: ".legend span" },
    live: { page: "aiIndex", selector: ".admin-legend > span" },
  },
  ...(
    [
      ["Not started", "s-draft", "not_started"],
      ["Passed", "s-pub", "passed"],
      ["Frozen", "s-read", "frozen"],
    ] as const
  ).map(([label, prototypeClass, status]): Component => ({
    name: `AI features: status pill (${label})`,
    prototype: { page: "aiIndex", selector: `.legend .pill.${prototypeClass}` },
    live: { page: "aiIndex", selector: `.admin-legend .admin-pill-ai-${status}` },
    box: ["height"],
  })),
  // #439: one feature page (drawing AIF-2, the Pause message), sections (a) to (f) and the
  // retry_hints fix.
  {
    name: "feature: menu row, current on a detail page",
    prototype: { page: "aiFeature", selector: ".rail a.on" },
    live: { page: "aiFeature", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "feature: breadcrumb",
    prototype: { page: "aiFeature", selector: ".crumb" },
    live: { page: "aiFeature", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "feature: breadcrumb link",
    prototype: { page: "aiFeature", selector: ".crumb a" },
    live: { page: "aiFeature", selector: ".admin-crumb a" },
  },
  {
    name: "feature: page title",
    prototype: { page: "aiFeature", selector: ".head h1" },
    live: { page: "aiFeature", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "feature: lede",
    prototype: { page: "aiFeature", selector: ".head .lede" },
    live: { page: "aiFeature", selector: ".admin-head .admin-lede" },
  },
  {
    name: "feature: sections",
    prototype: { page: "aiFeature", selector: ".stack" },
    live: { page: "aiFeature", selector: ".admin-sections" },
    box: ["x", "width"],
  },
  {
    name: "feature: section panel",
    prototype: { page: "aiFeature", selector: ".stack > .panel" },
    live: { page: "aiFeature", selector: ".admin-sections > .admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "feature: section heading",
    prototype: { page: "aiFeature", selector: ".stack > .panel > h2" },
    live: { page: "aiFeature", selector: ".admin-section > h2" },
    box: ["height"],
  },
  {
    name: "feature: item text",
    prototype: { page: "aiFeature", selector: ".stack > .panel:first-child > p:not(.src)" },
    live: { page: "aiFeature", selector: ".admin-items .admin-item-text" },
  },
  {
    name: "feature: source line",
    prototype: { page: "aiFeature", selector: ".src" },
    live: { page: "aiFeature", selector: ".admin-src" },
  },
  {
    name: "feature: draft mark (Draft - owner to edit; also Fake model (stub))",
    prototype: { page: "aiFeature", selector: ".src .pill.s-checked" },
    live: { page: "aiFeature", selector: ".admin-src .admin-pill-mark" },
    box: ["height"],
  },
  {
    name: "feature: draft mark dot",
    prototype: { page: "aiFeature", selector: ".src .pill.s-checked" },
    live: { page: "aiFeature", selector: ".admin-src .admin-pill-mark" },
    pseudo: "::before",
    properties: [...STYLE, "width", "height", "content"],
  },
  {
    name: "feature: source chip",
    prototype: { page: "aiFeature", selector: ".src .key" },
    live: { page: "aiFeature", selector: ".admin-src .admin-chip" },
    box: ["height"],
  },
  {
    name: "feature: pass questions",
    prototype: { page: "aiFeature", selector: "ol.qs" },
    live: { page: "aiFeature", selector: ".admin-questions" },
  },
  {
    name: "feature: pass question",
    prototype: { page: "aiFeature", selector: "ol.qs li" },
    live: { page: "aiFeature", selector: ".admin-questions > li" },
  },
  {
    name: "feature: status pill in the heading",
    prototype: { page: "aiFeature", selector: ".panel > h2 .pill.s-gen" },
    live: { page: "aiFeature", selector: ".admin-section > h2 .admin-pill-ai-exploring" },
    box: ["height"],
  },
  {
    name: "feature: status note",
    prototype: { page: "aiFeature", selector: ".panel > p.note" },
    live: { page: "aiFeature", selector: ".admin-section > .admin-note" },
  },
  {
    name: "feature: prompt columns",
    prototype: { page: "aiFeature", selector: ".grid2" },
    live: { page: "aiFeature", selector: ".admin-grid2" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "feature: prompt line",
    prototype: { page: "aiFeature", selector: ".grid2 > div > p:first-child" },
    live: { page: "aiFeature", selector: ".admin-grid2 > section > .admin-prompt-meta" },
  },
  {
    name: "feature: prompt key chip",
    prototype: { page: "aiFeature", selector: ".grid2 > div > p:first-child .key" },
    live: { page: "aiFeature", selector: ".admin-prompt-meta .admin-chip" },
    box: ["height"],
  },
  {
    name: "feature: published pill",
    prototype: { page: "aiFeature", selector: ".grid2 .pill.s-pub" },
    live: { page: "aiFeature", selector: ".admin-prompt-meta .admin-pill-published" },
    box: ["height"],
  },
  {
    name: "feature: prompt text",
    prototype: { page: "aiFeature", selector: ".grid2 pre.code" },
    live: { page: "aiFeature", selector: ".admin-grid2 pre.admin-code" },
  },
  {
    name: "feature: retry_hints text",
    prototype: { page: "aiFeature", selector: ".stack > .panel:nth-child(6) > pre.code" },
    live: { page: "aiFeature", selector: ".admin-sections > .admin-section:nth-child(6) > pre" },
  },
  {
    name: "feature: No real run yet",
    prototype: { page: "aiFeature", selector: ".stack > .panel:last-child > .empty" },
    live: {
      page: "aiFeature",
      selector: ".admin-sections > .admin-section:last-child > .admin-empty.admin-after-table",
    },
  },
  // #453: the feature page's links to the editors, in the header action row (drawing AIF-2).
  {
    name: "feature: edit link in the header action row",
    prototype: { page: "aiFeature", selector: ".head .btns a.btn" },
    live: { page: "aiFeature", selector: ".admin-head .admin-actions a.button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "feature: header action row",
    prototype: { page: "aiFeature", selector: ".head .btns" },
    live: { page: "aiFeature", selector: ".admin-head .admin-actions" },
  },
  // #453: the status editor (drawing AIF-5), as an admin.
  {
    name: "status: page title",
    prototype: { page: "aiStatus", selector: ".head h1" },
    live: { page: "aiStatus", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "status: lede",
    prototype: { page: "aiStatus", selector: ".head .lede" },
    live: { page: "aiStatus", selector: ".admin-head .admin-lede" },
  },
  {
    name: "status: two columns",
    prototype: { page: "aiStatus", selector: ".grid2" },
    live: { page: "aiStatus", selector: ".admin-grid2" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "status: change panel",
    prototype: { page: "aiStatus", selector: ".grid2 > .panel:first-child" },
    live: { page: "aiStatus", selector: ".admin-grid2 > .admin-panel:first-child" },
    properties: [...STYLE, "opacity"],
    box: ["x", "width"],
  },
  {
    name: "status: history panel",
    prototype: { page: "aiStatus", selector: ".grid2 > .panel:last-child" },
    live: { page: "aiStatus", selector: ".admin-grid2 > .admin-panel:last-child" },
    box: ["x", "width"],
  },
  {
    name: "status: panel heading",
    prototype: { page: "aiStatus", selector: ".grid2 > .panel > h2" },
    live: { page: "aiStatus", selector: ".admin-grid2 > .admin-section > h2" },
    box: ["height"],
  },
  {
    name: "status: form",
    prototype: { page: "aiStatus", selector: ".form" },
    live: { page: "aiStatus", selector: ".admin-form" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "status: status buttons",
    prototype: { page: "aiStatus", selector: ".form .seg" },
    live: { page: "aiStatus", selector: ".admin-form .admin-seg" },
  },
  {
    name: "status: status button",
    prototype: { page: "aiStatus", selector: '.form .seg button[aria-pressed="false"]' },
    live: { page: "aiStatus", selector: '.admin-seg button[aria-pressed="false"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "status: status button, chosen",
    prototype: { page: "aiStatus", selector: '.form .seg button[aria-pressed="true"]' },
    live: { page: "aiStatus", selector: '.admin-seg button[aria-pressed="true"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "status: reason label",
    prototype: { page: "aiStatus", selector: ".form label" },
    live: { page: "aiStatus", selector: ".admin-form label" },
    properties: [...STYLE, "grid-template-columns"],
  },
  {
    name: "status: reason field",
    prototype: { page: "aiStatus", selector: ".form label input" },
    live: { page: "aiStatus", selector: ".admin-form label input" },
    box: ["height", "width"],
  },
  {
    name: "status: Save status",
    prototype: { page: "aiStatus", selector: ".form button.primary" },
    live: { page: "aiStatus", selector: ".admin-form .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "status: status pill in Now",
    prototype: { page: "aiStatus", selector: ".grid2 > .panel:last-child > h2 .pill.s-gen" },
    live: {
      page: "aiStatus",
      selector: ".admin-grid2 > .admin-panel:last-child > h2 .admin-pill-ai-exploring",
    },
    box: ["height"],
  },
  {
    name: "status: history table",
    prototype: { page: "aiStatus", selector: ".grid2 table" },
    live: { page: "aiStatus", selector: ".admin-grid2 .admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "status: history head cell",
    prototype: { page: "aiStatus", selector: ".grid2 th" },
    live: { page: "aiStatus", selector: ".admin-grid2 .admin-table th" },
    box: ["height"],
  },
  {
    name: "status: history time cell",
    prototype: { page: "aiStatus", selector: ".grid2 td.note" },
    live: { page: "aiStatus", selector: ".admin-grid2 .admin-table td.admin-cell-note" },
  },
  {
    name: "status: history who cell",
    prototype: { page: "aiStatus", selector: ".grid2 td:nth-child(2)" },
    live: { page: "aiStatus", selector: ".admin-grid2 .admin-table td:nth-child(2)" },
  },
  {
    name: "status: history pill",
    prototype: { page: "aiStatus", selector: ".grid2 td .pill.s-gen" },
    live: { page: "aiStatus", selector: ".admin-grid2 .admin-table td .admin-pill-ai-exploring" },
    box: ["height"],
  },
  // #453: the pass standard editor (drawing AIF-6).
  {
    name: "pass: header action row",
    prototype: { page: "aiPass", selector: ".head .btns" },
    live: { page: "aiPass", selector: ".admin-head .admin-actions" },
  },
  {
    name: "pass: Save",
    prototype: { page: "aiPass", selector: ".head .btns button.primary" },
    live: { page: "aiPass", selector: ".admin-head .admin-actions .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "pass: editor columns",
    prototype: { page: "aiPass", selector: ".editor" },
    live: { page: "aiPass", selector: ".admin-editor" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "pass: questions panel",
    prototype: { page: "aiPass", selector: ".editor > .panel:first-child" },
    live: { page: "aiPass", selector: ".admin-editor > .admin-panel:first-child" },
    box: ["x", "width"],
  },
  {
    name: "pass: side panel",
    prototype: { page: "aiPass", selector: ".editor > .panel:last-child" },
    live: { page: "aiPass", selector: ".admin-editor > .admin-panel:last-child" },
    box: ["x", "width"],
  },
  {
    name: "pass: panel heading",
    prototype: { page: "aiPass", selector: ".editor > .panel > h2" },
    live: { page: "aiPass", selector: ".admin-editor > .admin-panel > h2" },
    box: ["height"],
  },
  {
    name: "pass: question row",
    prototype: { page: "aiPass", selector: ".qrow" },
    live: { page: "aiPass", selector: ".admin-qrow" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "pass: question number",
    prototype: { page: "aiPass", selector: ".qrow .n" },
    live: { page: "aiPass", selector: ".admin-qrow-n" },
  },
  {
    name: "pass: question field",
    prototype: { page: "aiPass", selector: ".qrow input" },
    live: { page: "aiPass", selector: ".admin-qrow input" },
    box: ["height"],
  },
  {
    name: "pass: question buttons",
    prototype: { page: "aiPass", selector: ".qrow .btns" },
    live: { page: "aiPass", selector: ".admin-qrow .admin-actions" },
  },
  {
    name: "pass: small button",
    prototype: { page: "aiPass", selector: ".qrow button.small" },
    live: { page: "aiPass", selector: ".admin-qrow .button-small:not(:disabled)" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "pass: Add question row",
    prototype: {
      page: "aiPass",
      selector: ".editor > .panel:first-child > .qrow + div:not(.qrow)",
    },
    live: { page: "aiPass", selector: ".admin-editor > .admin-panel:first-child > .admin-add" },
  },
  {
    name: "pass: source line",
    prototype: { page: "aiPass", selector: ".editor .src" },
    live: { page: "aiPass", selector: ".admin-qrow-text .admin-src" },
  },
  {
    name: "pass: draft mark",
    prototype: { page: "aiPass", selector: ".editor .src .pill.s-checked" },
    live: { page: "aiPass", selector: ".admin-qrow-text .admin-src .admin-pill-mark" },
    box: ["height"],
  },
  {
    name: "pass: source chip",
    prototype: { page: "aiPass", selector: ".editor .src .key" },
    live: { page: "aiPass", selector: ".admin-qrow-text .admin-src .admin-chip" },
    box: ["height"],
  },
  {
    name: "pass: side panel table cell",
    prototype: { page: "aiPass", selector: ".editor > .panel:last-child td.note" },
    live: { page: "aiPass", selector: ".admin-editor > .admin-panel:last-child .admin-note" },
    properties: FONT,
  },
  // #453: the purpose and approach editor (drawing AIF-7).
  {
    name: "purpose: Save",
    prototype: { page: "aiPurpose", selector: ".head .btns button.primary" },
    live: { page: "aiPurpose", selector: ".admin-head .admin-actions .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "purpose: editor columns",
    prototype: { page: "aiPurpose", selector: ".editor" },
    live: { page: "aiPurpose", selector: ".admin-editor" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "purpose: form panel",
    prototype: { page: "aiPurpose", selector: ".editor > .panel:first-child" },
    live: { page: "aiPurpose", selector: ".admin-editor > .admin-panel:first-child" },
    box: ["x", "width"],
  },
  {
    name: "purpose: side panel",
    prototype: { page: "aiPurpose", selector: ".editor > .panel:last-child" },
    live: { page: "aiPurpose", selector: ".admin-editor > .admin-panel:last-child" },
    box: ["x", "width"],
  },
  {
    name: "purpose: form",
    prototype: { page: "aiPurpose", selector: ".editor .form" },
    live: { page: "aiPurpose", selector: ".admin-editor .admin-form" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "purpose: field label",
    prototype: { page: "aiPurpose", selector: ".form label" },
    live: { page: "aiPurpose", selector: ".admin-field-group" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "purpose: text box",
    prototype: { page: "aiPurpose", selector: ".form label textarea" },
    live: { page: "aiPurpose", selector: ".admin-field-group textarea" },
    properties: [...STYLE, "resize"],
    box: ["width"],
  },
  {
    name: "purpose: source line",
    prototype: { page: "aiPurpose", selector: ".form > p.src" },
    live: { page: "aiPurpose", selector: ".admin-field-line .admin-src" },
  },
  {
    name: "purpose: draft mark",
    prototype: { page: "aiPurpose", selector: ".form .src .pill.s-checked" },
    live: { page: "aiPurpose", selector: ".admin-field-line .admin-pill-mark" },
    box: ["height"],
  },
  {
    name: "purpose: side panel heading",
    prototype: { page: "aiPurpose", selector: ".editor > .panel:last-child > h2" },
    live: { page: "aiPurpose", selector: ".admin-editor > .admin-panel:last-child > h2" },
    box: ["height"],
  },
  // #453: the status editor as a writer sees it (the drawing's "View as writer"). Last in the map:
  // its live page signs the browser in again as a writer.
  {
    name: "status, writer: change panel (dimmed)",
    prototype: { page: "aiStatusWriter", selector: ".grid2 > .panel.ro" },
    live: { page: "aiStatusWriter", selector: ".admin-grid2 > .admin-panel.admin-ro" },
    properties: [...STYLE, "opacity"],
    box: ["x", "width"],
  },
  {
    name: "status, writer: Admin only",
    prototype: { page: "aiStatusWriter", selector: ".panel.ro h2 .lock" },
    live: { page: "aiStatusWriter", selector: ".admin-ro h2 .admin-lock" },
  },
  {
    name: "status, writer: lede",
    prototype: { page: "aiStatusWriter", selector: ".head .lede" },
    live: { page: "aiStatusWriter", selector: ".admin-head .admin-lede" },
  },
  {
    name: "status, writer: status button (disabled)",
    prototype: { page: "aiStatusWriter", selector: '.ro .seg button[aria-pressed="false"]' },
    live: { page: "aiStatusWriter", selector: '.admin-ro .admin-seg button[aria-pressed="false"]' },
    properties: [...STYLE, "opacity"],
    box: ["height"],
  },
  {
    name: "status, writer: reason field (disabled)",
    prototype: { page: "aiStatusWriter", selector: ".ro label input" },
    live: { page: "aiStatusWriter", selector: ".admin-ro label input" },
    properties: [...STYLE, "opacity"],
    box: ["height"],
  },
  {
    name: "status, writer: Save status (disabled)",
    prototype: { page: "aiStatusWriter", selector: ".ro button.primary" },
    live: { page: "aiStatusWriter", selector: ".admin-ro .button-filled" },
    properties: [...STYLE, "opacity"],
    box: ["height"],
  },
];

/**
 * Every deliberate gap in the comparison, in one place, each with its reason. A property listed
 * here is not compared for that component; nothing else is skipped. Content-dependent sizes (the
 * width of a pill, chip, button or menu label; the height of a cell, panel, lede or text box) are
 * never measured: only the sizes named in a component's `box` are.
 */
/**
 * #439: the components whose live text keeps the prototype's word breaking (overflow-wrap normal):
 * the cells of the self-sized AI features index table and what sits in them. Every other component
 * is listed in the overflow-wrap exception below.
 */
const WORD_BREAK_NORMAL = new Set([
  "AI features: table head cell",
  "AI features: feature cell",
  "AI features: feature name",
  "AI features: purpose cell",
  "AI features: status pill (Exploring)",
  "AI features: status pill dot",
  "AI features: version chip",
]);

const EXCEPTIONS: { component: string; properties: string[]; reason: string }[] = [
  ...COMPONENTS.filter((component) => !WORD_BREAK_NORMAL.has(component.name)).map((component) => ({
    component: component.name,
    properties: ["overflow-wrap"],
    reason:
      "Live text breaks a word longer than its line anywhere (the app's body, issue 100, and " +
      ".admin-code for the prompt text and retry_hints blocks); the prototype computes normal. " +
      "Real prompt and table text holds long unbroken tokens (JSON, keys, emails) and the " +
      "prototype's sample text does not: with normal they run out of their box and the page " +
      "clips them (#439 review round 3: a 200-character token was 1313 px wide in a 348 px " +
      "box). word-break is still compared everywhere, and overflow-wrap on the index table " +
      "cells (WORD_BREAK_NORMAL), which keep normal inside their scrolling panel.",
  })),
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
    component: "small secondary button",
    properties: ["display"],
    reason:
      "Both are inline-flex. The live one sits in a flex row (.admin-text-actions), where the " +
      "browser computes a flex item's inline-flex as flex; the prototype's sits in a table cell.",
  },
  {
    component: "text field",
    properties: ["font-weight"],
    reason:
      "Both fields inherit the weight (font: inherit). The prototype's only field sits inside a " +
      ".form label (600); live fields have their label beside them (400). The page pull request " +
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
  // #442: Companion profile.
  ...["main button (Companion profile)", "secondary button (Companion profile)"].map(
    (component) => ({
      component,
      properties: ["min-width", "min-height"],
      reason:
        "As `main button` and `secondary button`: live sets 0 to switch off the phone app's 44 px " +
        "tap minimum (ADMIN-DESKTOP); the prototype has none (auto). The height is compared.",
    }),
  ),
  {
    component: "field text, edited in place",
    properties: ["white-space"],
    reason:
      "Live is pre-wrap, the prototype normal: stored production text may contain line breaks " +
      "(the earlier editor was a textarea that allowed them), and they must stay visible and be " +
      "saved back unchanged.",
  },
  {
    component: "AI features: table head cell",
    properties: ["white-space"],
    reason:
      "Measured in the drawing (AIF-1, 2026-11-25): its table sizes its own columns (table-layout " +
      "auto, no col widths) and every heading is white-space normal; it stays on one line only " +
      "because its sample purposes are short and its last column holds a 'Fake model (stub)' " +
      "pill that does not wrap (147 px at 1024 and 1280). With the real purposes and no imported " +
      "run, the same table wraps 'Last offline run' to 2 or 3 lines at 1024 px, so live headings " +
      "are nowrap. The result, one line, is still compared: the heading's box height.",
  },
  {
    component: "feature: breadcrumb link",
    properties: ["align-items", "min-width", "min-height"],
    reason:
      "The live link sits in a flex list item, so it is a flex item whose minimum the admin sets " +
      "to 0 (no 44 px tap minimum, ADMIN-DESKTOP); the prototype's is an inline link (auto). " +
      "align-items comes from the app's base link style and does nothing on a link with no flex " +
      "children. Font, colour and underline are compared.",
  },
  {
    component: "AI features: feature link (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "Each feature title on the live index is an underlined link inside the bold cell text " +
      "(compared as `AI features: feature name`); the drawing (AIF-1) makes the whole row " +
      "clickable instead, with no link. As the Companion name link above.",
  },
  {
    component: "test results table (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The (f) table of a feature page has rows only once a test run is imported, which is data, " +
      "not part of the seed the gate opens. It is the same .admin-table, th, td, chip and " +
      "mark pill compared on the index and in (a); its rows are tested in e2e/ai-features.spec.ts.",
  },
  // #453: the AI feature editors.
  ...[
    "feature: edit link in the header action row",
    "status: status button",
    "status: status button, chosen",
    "status: reason field",
    "pass: Save",
    "pass: question field",
    "pass: small button",
    "purpose: Save",
    "status, writer: status button (disabled)",
    "status, writer: reason field (disabled)",
  ].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "As the buttons above: live sets 0 to switch off the phone app's 44 px tap minimum inside " +
      "the admin (ADMIN-DESKTOP); the drawing has none (auto). Neither draws a minimum: the " +
      "control's height is compared as `box height`.",
  })),
  {
    component: "status: history head cell",
    properties: ["white-space"],
    reason:
      "As `AI features: table head cell`: the drawing's history table sizes its own columns and " +
      "its one sample row keeps 'From → to' on one line; the live row has a real time and the " +
      "column is narrower at 1024 px, so live headings are nowrap. The result, one line, is " +
      "compared: the heading's box height.",
  },
  {
    component: "purpose: source line",
    properties: ["margin-top"],
    reason:
      "The drawing has one source line under each box, placed with an inline margin-top of -4px " +
      "after the form's 12 px gap: 8 px under the box. Live has a source line under every line " +
      "of a section, 8 px under its box through the line's own gap (margin 0). Same distance; " +
      "font, colour and size are compared.",
  },
  {
    component: "status, pass and purpose panels (box y, not measured)",
    properties: ["box y"],
    reason:
      "The panels' x and width are compared, not their y: it depends on the header's text. The " +
      "drawing's status header holds its demo-only 'View as admin / View as writer' switch, " +
      "which wraps to a second line at 1024 px, and its editor ledes are sample wording " +
      "(versions, a pass threshold) that the schema does not have. The header row itself is " +
      "compared on every page.",
  },
  {
    component: "pass threshold, red lines and Versions (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The drawing's pass editor has 'Passes when this many are yes', 'Red lines' and a Versions " +
      "panel, and its editors 'Save draft' and 'Publish'. public.ai_features (#437) keeps (a) to " +
      "(c) as lists of lines with a source and a draft flag: no threshold, no red lines, no " +
      "versions. Live has one Save in the same header slot, and the side panel shows the last " +
      "save (when and who); the side panel's box and heading are compared. Adding them needs an " +
      "owner decision and a migration.",
  },
  {
    component: "View as admin / View as writer (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "A switch of the drawing only, to show both roles. Live shows the writer's view to a " +
      "writer; it is compared as the `status, writer:` rows.",
  },
];

// #444 Story cards (ADM-06): the prototype's cards editor and phone preview, against
// /admin/stories/site-search. Its own block, so other page pull requests do not touch it.
PROTOTYPE_PAGES.cards = { hash: "cards" };

COMPONENTS.push(
  {
    name: "story cards: editor (cards beside the preview)",
    prototype: { page: "cards", selector: ".editor" },
    live: { page: "storyCards", selector: ".admin-cards-editor" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "story cards: part panel",
    prototype: { page: "cards", selector: ".part" },
    live: { page: "storyCards", selector: ".admin-cards-part" },
    box: ["x", "width"],
  },
  {
    name: "story cards: part header",
    prototype: { page: "cards", selector: ".part > header" },
    live: { page: "storyCards", selector: ".admin-cards-part > header" },
    box: ["width"],
  },
  {
    name: "story cards: part title",
    prototype: { page: "cards", selector: ".part > header b" },
    live: { page: "storyCards", selector: ".admin-cards-part > header h2" },
  },
  {
    name: "story cards: part key chip",
    prototype: { page: "cards", selector: ".part > header .key" },
    live: { page: "storyCards", selector: ".admin-cards-part > header .admin-chip" },
    box: ["height"],
  },
  {
    name: "story cards: card row",
    prototype: { page: "cards", selector: ".cardrow" },
    live: { page: "storyCards", selector: ".admin-cards-row" },
    box: ["x", "width"],
  },
  {
    name: "story cards: kind column",
    prototype: { page: "cards", selector: ".cardrow .kind" },
    live: { page: "storyCards", selector: ".admin-cards-kind" },
    box: ["width"],
  },
  {
    name: "story cards: kind key chip",
    prototype: { page: "cards", selector: ".cardrow .kind .key" },
    live: { page: "storyCards", selector: ".admin-cards-kind .admin-chip" },
    box: ["height"],
  },
  {
    name: "story cards: card text",
    prototype: { page: "cards", selector: ".cardrow .txt" },
    live: { page: "storyCards", selector: ".admin-cards-body" },
  },
  {
    name: "story cards: card meta",
    prototype: { page: "cards", selector: ".cardrow .meta" },
    live: { page: "storyCards", selector: ".admin-cards-meta" },
  },
  {
    name: "story cards: meta note",
    prototype: { page: "cards", selector: ".cardrow .meta .note" },
    live: { page: "storyCards", selector: ".admin-cards-meta .admin-cards-note" },
  },
  {
    name: "story cards: meta button row",
    prototype: { page: "cards", selector: ".cardrow .meta .btns" },
    live: { page: "storyCards", selector: ".admin-cards-meta .admin-cards-buttons" },
  },
  {
    name: "story cards: small button",
    prototype: { page: "cards", selector: ".cardrow .meta button.small" },
    live: { page: "storyCards", selector: ".admin-cards-meta .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "story cards: phone",
    prototype: { page: "cards", selector: ".phone" },
    live: { page: "storyCards", selector: ".admin-phone" },
    properties: [...STYLE, "position", "top"],
    box: ["width"],
  },
  {
    name: "story cards: phone top line",
    prototype: { page: "cards", selector: ".phone .ph-top" },
    live: { page: "storyCards", selector: ".admin-phone-top" },
    properties: [...STYLE, "opacity"],
  },
  {
    name: "story cards: note under the phone",
    prototype: { page: "cards", selector: "aside > p.note" },
    live: { page: "storyCards", selector: ".admin-phone-note" },
  },
);

EXCEPTIONS.push(
  {
    component: "story cards: small button",
    properties: ["min-width", "min-height"],
    reason:
      "As the other buttons: live sets 0 to switch off the phone app's 44 px tap minimum inside " +
      "the admin (ADMIN-DESKTOP); the prototype has none (auto). The height is compared.",
  },
  {
    component: "story cards: note under the phone",
    properties: ["margin-bottom"],
    reason:
      "The prototype's note keeps the browser's default paragraph margin (1em) under it; it is " +
      "the last thing in the column and draws nothing. Its top margin (8 px) is compared.",
  },
  {
    component: "story cards: phone contents (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "Inside the phone the prototype draws a sample of the focus page in its own look (My goal, " +
      "a .slip, Your step, the clock). Live shows the app's own story card (the focus page's " +
      "slip, StoryCardSlip), as phones draw it (#444 brief); the Goal, Step and clock are a " +
      "user's data the admin does not have. The phone frame and its top line are compared.",
  },
  {
    component: "story cards: failed check line (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The prototype's .fails line (11.5 px, bad colour) has its live twin in .admin-cards-fails " +
      "with the same tokens, but no card of the seed story the gate reads fails a check, and the " +
      "gate never writes rows. e2e/admin-story-cards.spec.ts checks the problems list on a card.",
  },
  {
    component: "story cards: state pills (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The prototype's card states (Generated, Checks passed, Read by a person) have no data " +
      "live (owner decisions in #444); live shows Published or Draft and Check failed, the same " +
      "pill compared as `pill (Published)` and `pill dot`.",
  },
);

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
  const aiFeatures = readFileSync(AI_FEATURES_FILE, "utf8");
  await page.route(`**${AI_FEATURES_PATH}`, (route) =>
    route.fulfill({ body: aiFeatures, contentType: "text/html; charset=utf-8" }),
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
  const file = target.file === "aiFeatures" ? AI_FEATURES_PATH : PROTOTYPE_PATH;
  await page.goto(`${origin}${file}#${target.hash}`);
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
  await writePictures(page, origin, PICTURES.slice(0, 1));
});

// #442: the Companion profile pictures for its pull request (prototype `character` vs live
// Oppenheimer, Profile tab) at each width. Written only on request.
test("test_442_companion_profile_pictures_prototype_vs_live", async ({ page, context }) => {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(120_000);
  mkdirSync(REFERENCE_DIR, { recursive: true });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    await openPrototype(page, origin, "character");
    const prototype = await page.screenshot();
    await openLive(page, "companion");
    const live = await page.screenshot();
    writeFileSync(path.join(REFERENCE_DIR, `companion-profile-${width}-prototype.png`), prototype);
    writeFileSync(path.join(REFERENCE_DIR, `companion-profile-${width}-live.png`), live);

    const image = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
    await page.setViewportSize({ width: width * 2 + 48, height: HEIGHT + 56 });
    await page.setContent(
      `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#888;display:flex;gap:16px;font:14px system-ui;color:#fff">` +
        `<figure style="margin:0"><figcaption>Prototype (standards mode), ${width} px</figcaption><img src="${image(prototype)}"></figure>` +
        `<figure style="margin:0"><figcaption>Live admin, ${width} px</figcaption><img src="${image(live)}"></figure></body>`,
    );
    writeFileSync(
      path.join(REFERENCE_DIR, `companion-profile-${width}-side-by-side.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
});

// #444: the Story cards pictures for the pull request (prototype's Story cards vs
// /admin/stories/site-search), 1400 px tall so the first parts and the phone are in view.
test("test_444_story_cards_pictures_prototype_vs_live", async ({ page, context }) => {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(120_000);
  const tall = 1400;
  mkdirSync(REFERENCE_DIR, { recursive: true });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: tall });
    await openPrototype(page, origin, "cards");
    const prototype = await page.screenshot();
    await openLive(page, "storyCards");
    const live = await page.screenshot();
    writeFileSync(path.join(REFERENCE_DIR, `story-cards-${width}-prototype.png`), prototype);
    writeFileSync(path.join(REFERENCE_DIR, `story-cards-${width}-live.png`), live);

    const image = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
    await page.setViewportSize({ width: width * 2 + 48, height: tall + 56 });
    await page.setContent(
      `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#888;display:flex;gap:16px;font:14px system-ui;color:#fff">` +
        `<figure style="margin:0"><figcaption>Prototype (standards mode), ${width} px</figcaption><img src="${image(prototype)}"></figure>` +
        `<figure style="margin:0"><figcaption>Live admin, ${width} px</figcaption><img src="${image(live)}"></figure></body>`,
    );
    writeFileSync(
      path.join(REFERENCE_DIR, `story-cards-${width}-side-by-side.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
});

// #439: the same pictures of the AI features index and the Pause message page, full page, written
// as ai-<index|feature>-<width>-{prototype,live,side-by-side}.png.
test("test_439_ai_feature_pictures_prototype_vs_live", async ({ page, context }) => {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(180_000);
  mkdirSync(REFERENCE_DIR, { recursive: true });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  await writePictures(page, origin, PICTURES.slice(1, 3));
});

// #453: the editors (status as an admin and as a writer, pass standard, purpose and approach),
// written as ai-<status|status-writer|pass|purpose>-<width>-{prototype,live,side-by-side}.png. The
// writer's picture is last: its live page signs the browser in again as a writer.
test("test_453_ai_editor_pictures_prototype_vs_live", async ({ page, context }) => {
  test.skip(!process.env.ADMIN_VISUAL_SCREENSHOTS, "Set ADMIN_VISUAL_SCREENSHOTS=1 to write them.");
  test.setTimeout(240_000);
  mkdirSync(REFERENCE_DIR, { recursive: true });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const origin = new URL(page.url()).origin;
  await servePrototype(page, await adminFontFaces(page));
  await writePictures(page, origin, PICTURES.slice(3));
});

const PICTURES = [
  { name: "frame", prototype: "characters", live: "companions", fullPage: false },
  { name: "ai-index", prototype: "aiIndex", live: "aiIndex", fullPage: true },
  { name: "ai-feature", prototype: "aiFeature", live: "aiFeature", fullPage: true },
  { name: "ai-status", prototype: "aiStatus", live: "aiStatus", fullPage: true },
  { name: "ai-pass", prototype: "aiPass", live: "aiPass", fullPage: true },
  { name: "ai-purpose", prototype: "aiPurpose", live: "aiPurpose", fullPage: true },
  { name: "ai-status-writer", prototype: "aiStatusWriter", live: "aiStatusWriter", fullPage: true },
] as const;

async function writePictures(
  page: Page,
  origin: string,
  pictures: readonly (typeof PICTURES)[number][],
) {
  for (const picture of pictures) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await openPrototype(page, origin, picture.prototype);
      const prototype = await page.screenshot({ fullPage: picture.fullPage });
      await openLive(page, picture.live);
      const live = await page.screenshot({ fullPage: picture.fullPage });
      writeFileSync(path.join(REFERENCE_DIR, `${picture.name}-${width}-prototype.png`), prototype);
      writeFileSync(path.join(REFERENCE_DIR, `${picture.name}-${width}-live.png`), live);

      const image = (png: Buffer) => `data:image/png;base64,${png.toString("base64")}`;
      await page.setViewportSize({ width: width * 2 + 48, height: HEIGHT + 56 });
      await page.setContent(
        `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#888;display:flex;align-items:flex-start;gap:16px;font:14px system-ui;color:#fff">` +
          `<figure style="margin:0"><figcaption>Prototype (standards mode), ${width} px</figcaption><img src="${image(prototype)}"></figure>` +
          `<figure style="margin:0"><figcaption>Live admin, ${width} px</figcaption><img src="${image(live)}"></figure></body>`,
      );
      writeFileSync(
        path.join(REFERENCE_DIR, `${picture.name}-${width}-side-by-side.png`),
        await page.screenshot({ fullPage: true }),
      );
    }
  }
}
