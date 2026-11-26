import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  type Component,
  FONT,
  type Gate,
  type Picture,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #439 and #453: the AI features index, the Pause message page and its editors against the
// drawing (docs/design/prototype/admin-ai-features.html). Part of the admin visual gate
// (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
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
};

const LIVE_PAGES: Gate["livePages"] = {
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

const COMPONENTS: Gate["components"] = [
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

const WORD_BREAK_NORMAL = [
  "AI features: table head cell",
  "AI features: feature cell",
  "AI features: feature name",
  "AI features: purpose cell",
  "AI features: status pill (Exploring)",
  "AI features: status pill dot",
  "AI features: version chip",
];

const EXCEPTIONS: Gate["exceptions"] = [
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
      "clickable instead, with no link.",
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

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
  wordBreakNormal: WORD_BREAK_NORMAL,
};

gateTests(GATE, (width) => `test_439_ai_features_match_the_prototype_at_${width}_px`);

const PICTURES: Picture[] = (
  [
    ["ai-index", "aiIndex"],
    ["ai-feature", "aiFeature"],
    ["ai-status", "aiStatus"],
    ["ai-pass", "aiPass"],
    ["ai-purpose", "aiPurpose"],
    ["ai-status-writer", "aiStatusWriter"],
  ] as const
).map(([name, key]) => ({
  name,
  prototype: PROTOTYPE_PAGES[key],
  live: LIVE_PAGES[key],
  fullPage: true,
  alignTop: true,
}));

// #439: the same pictures of the AI features index and the Pause message page, full page, written
// as ai-<index|feature>-<width>-{prototype,live,side-by-side}.png.
test("test_439_ai_feature_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(180_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, PICTURES.slice(0, 2));
});

// #453: the editors (status as an admin and as a writer, pass standard, purpose and approach),
// written as ai-<status|status-writer|pass|purpose>-<width>-{prototype,live,side-by-side}.png. The
// writer's picture is last: its live page signs the browser in again as a writer.
test("test_453_ai_editor_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(240_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, PICTURES.slice(2));
});
