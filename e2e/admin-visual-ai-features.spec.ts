import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  FONT,
  type Gate,
  type Picture,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #453: the editors of the Pause message (status, pass standard, purpose and approach) against the
// drawing (docs/design/prototype/admin-ai-features.html). Part of the admin visual gate
// (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  // #474: the index (AIF-1) and the feature page (AIF-2) are now the registry screens, compared in
  // e2e/admin-visual-ai-registry.spec.ts against #reg-registry and #reg-feature.
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

const EXCEPTIONS: Gate["exceptions"] = [
  // #453: the AI feature editors.
  ...[
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
      "The drawing's history table sizes its own columns (table-layout auto) and " +
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
};

gateTests(GATE, (width) => `test_439_ai_features_match_the_prototype_at_${width}_px`);

const PICTURES: Picture[] = (
  [
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

// #453: the editors (status as an admin and as a writer, pass standard, purpose and approach),
// written as ai-<status|status-writer|pass|purpose>-<width>-{prototype,live,side-by-side}.png. The
// writer's picture is last: its live page signs the browser in again as a writer.
test("test_453_ai_editor_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(240_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, PICTURES);
});
