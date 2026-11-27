import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  FONT,
  STYLE,
  gateTests,
  picturesOnRequest,
  skipGateOutsideCi,
  startPrototypeServing,
  writePictures,
  type Component,
  type Gate,
  type PageSetup,
  type Picture,
} from "./support/admin-visual";

// #475 (registry slice 3): the registry editor (/admin/ai-features/<slug>/fields) and Confirm on
// the feature page, against the drawing docs/design/prototype/admin-ai-features.html. The drawing
// has no screen of its own for the registry fields, so the editor is built from, and compared
// with, the drawing's own editor parts: the form and its side panel of AIF-7 (#purpose), the
// status control of AIR-2 (#reg-feature: its buttons, Save, Admin only, dimmed for a writer), the
// AIR-2 Version history and example history tables, and AIR-2's Confirm. Part of the admin visual
// gate (e2e/support/admin-visual.ts, #483). Text and seed data are never compared.

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

/**
 * Signs the page in again as a registry account of `role` (its own copy of the 19 rows), then
 * reloads it, or opens `then`: a Pipeline row exists only in that copy, so the gate opens a
 * Runtime row first.
 */
function asRegistryAccount(role: "admin" | "writer", then?: string): PageSetup {
  return async (page: Page) => {
    const account = await signIn(page.context(), new URL(page.url()).origin, undefined, {
      contentRole: role,
    });
    const answer = await fetch(`${STUB_SUPABASE}/__ai_features`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: account.token, registry: true }),
    });
    expect(answer.status).toBe(200);
    if (then) await page.goto(then);
    else await page.reload();
    await expect(page.locator(".admin-main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const shell = document.querySelector(".admin-shell");
      return !!shell && Object.keys(shell).some((key) => key.startsWith("__reactFiber"));
    });
    await page.evaluate(() => document.fonts.ready);
  };
}

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  // AIF-7: the editor form and its side panel.
  aiPurpose: { hash: "purpose", file: "aiFeatures" },
  // AIR-2 as an admin: R-01 has a candidate example (Confirm), the status control and the history.
  featAdmin: { hash: "reg-feature/admin/R-01", file: "aiFeatures" },
  // AIR-2 of P-02: its example history table.
  featPipeline: { hash: "reg-feature/admin/P-02", file: "aiFeatures" },
  // AIR-2 as a writer: the dimmed Admin only status panel.
  featWriter: { hash: "reg-feature/writer/R-01", file: "aiFeatures" },
  // AIF-5 as a writer: the disabled status buttons and Save.
  statusWriter: {
    hash: "status",
    file: "aiFeatures",
    prepare: async (page) => {
      await page.getByRole("button", { name: "View as writer" }).click();
      await expect(page.locator(".panel.ro")).toBeVisible();
    },
  },
};

const LIVE_PAGES: Gate["livePages"] = {
  // P-02 has an earlier example (the fixture's example history row).
  fieldsAdmin: {
    path: "/admin/ai-features/pause_message/fields",
    prepare: asRegistryAccount("admin", "/admin/ai-features/p02_select_stories/fields"),
  },
  // R-03 has a field history row (the fixture's).
  fieldsHistory: {
    path: "/admin/ai-features/pause_message/fields",
    prepare: asRegistryAccount("admin"),
  },
  // R-01 has a candidate example: Confirm.
  featAdmin: { path: "/admin/ai-features/plan_split", prepare: asRegistryAccount("admin") },
  fieldsWriter: {
    path: "/admin/ai-features/pause_message/fields",
    prepare: asRegistryAccount("writer"),
  },
};

/** The drawing's AIR-2 panel that holds `inner` (its sections carry no ids). */
const panelWith = (inner: string) => `.stack > .panel:has(${inner})`;

const COMPONENTS: Component[] = [
  // The form and its side panel, as AIF-7.
  {
    name: "fields: Save",
    prototype: { page: "aiPurpose", selector: ".head .btns button.primary" },
    live: { page: "fieldsAdmin", selector: ".admin-head .admin-actions .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "fields: header action row",
    prototype: { page: "aiPurpose", selector: ".head .btns" },
    live: { page: "fieldsAdmin", selector: ".admin-head .admin-actions" },
  },
  {
    name: "fields: editor columns",
    prototype: { page: "aiPurpose", selector: ".editor" },
    live: { page: "fieldsAdmin", selector: ".admin-editor" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "fields: form panel",
    prototype: { page: "aiPurpose", selector: ".editor > .panel:first-child" },
    live: { page: "fieldsAdmin", selector: ".admin-editor > .admin-panel:first-child" },
    box: ["x", "width"],
  },
  {
    name: "fields: side panel",
    prototype: { page: "aiPurpose", selector: ".editor > .panel:last-child" },
    live: { page: "fieldsAdmin", selector: ".admin-editor > .admin-panel:last-child" },
    box: ["x", "width"],
  },
  {
    name: "fields: side panel heading",
    prototype: { page: "aiPurpose", selector: ".editor > .panel:last-child > h2" },
    live: { page: "fieldsAdmin", selector: ".admin-editor > .admin-panel:last-child > h2" },
    box: ["height"],
  },
  {
    name: "fields: form",
    prototype: { page: "aiPurpose", selector: ".editor .form" },
    live: { page: "fieldsAdmin", selector: ".admin-editor .admin-form" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "fields: field label",
    prototype: { page: "aiPurpose", selector: ".form label" },
    live: { page: "fieldsAdmin", selector: ".admin-registry-form > label:nth-child(3)" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "fields: text box",
    prototype: { page: "aiPurpose", selector: ".form label textarea" },
    live: { page: "fieldsAdmin", selector: ".admin-registry-form textarea" },
    properties: [...STYLE, "resize"],
    box: ["width"],
  },
  {
    name: "fields: one-line field (Name)",
    prototype: { page: "featAdmin", selector: ".stack .form label input" },
    live: { page: "fieldsAdmin", selector: ".admin-registry-form input" },
    box: ["height"],
  },
  // The example, category and history panels, as AIR-2's sections.
  {
    name: "fields: section panel",
    prototype: { page: "featAdmin", selector: ".stack > .panel" },
    live: { page: "fieldsAdmin", selector: ".admin-after-editor > .admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "fields: section heading",
    prototype: { page: "featAdmin", selector: `${panelWith(".form")} > h2` },
    live: { page: "fieldsAdmin", selector: "#example > h2" },
    box: ["height"],
  },
  {
    name: "fields: example pill in the heading",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) .pill.s-pub" },
    live: { page: "fieldsAdmin", selector: "#example > h2 .admin-pill" },
    properties: FONT,
    box: ["height"],
  },
  {
    name: "fields: example and category form",
    prototype: { page: "featAdmin", selector: ".stack .form" },
    live: { page: "fieldsAdmin", selector: "#example .admin-form" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "fields: state button",
    prototype: { page: "featAdmin", selector: '.stack .form .seg button[aria-pressed="false"]' },
    live: { page: "fieldsAdmin", selector: '#example .admin-seg button[aria-pressed="false"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "fields: state button, chosen",
    prototype: { page: "featAdmin", selector: '.stack .form .seg button[aria-pressed="true"]' },
    live: { page: "fieldsAdmin", selector: '#example .admin-seg button[aria-pressed="true"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "fields: example text label",
    prototype: { page: "featAdmin", selector: ".stack .form label" },
    live: { page: "fieldsAdmin", selector: "#example .admin-form > label" },
  },
  {
    name: "fields: example text box",
    prototype: { page: "aiPurpose", selector: ".form label textarea" },
    live: { page: "fieldsAdmin", selector: "#example textarea" },
    properties: [...STYLE, "resize"],
  },
  {
    name: "fields: Save example",
    prototype: { page: "featAdmin", selector: ".stack .form button.primary" },
    live: { page: "fieldsAdmin", selector: "#example .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "fields: Save category",
    prototype: { page: "featAdmin", selector: ".stack .form button.primary" },
    live: { page: "fieldsAdmin", selector: "#category .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "fields: category button",
    prototype: { page: "featAdmin", selector: '.stack .form .seg button[aria-pressed="false"]' },
    live: { page: "fieldsAdmin", selector: '#category .admin-seg button[aria-pressed="false"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "fields: source line",
    prototype: { page: "featAdmin", selector: ".stack .src" },
    live: { page: "fieldsAdmin", selector: "#example > .admin-src" },
  },
  {
    name: "fields: example history table",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) > table" },
    live: { page: "fieldsAdmin", selector: "#example > table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "fields: example history head cell",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) > table th" },
    live: { page: "fieldsAdmin", selector: "#example > table th" },
  },
  {
    name: "fields: example history pill",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) > table .pill" },
    live: { page: "fieldsAdmin", selector: "#example > table .admin-pill" },
    box: ["height"],
  },
  {
    name: "fields: field history table",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) table" },
    live: { page: "fieldsHistory", selector: "#history .admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "fields: field history head cell",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) th" },
    live: { page: "fieldsHistory", selector: "#history .admin-table th" },
  },
  {
    name: "fields: field history time cell",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) td.note" },
    live: { page: "fieldsHistory", selector: "#history .admin-table td.admin-cell-note" },
  },
  {
    name: "fields: field history cell",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) td:nth-child(3)" },
    live: { page: "fieldsHistory", selector: "#history .admin-table td:nth-child(3)" },
  },
  // Confirm on the feature page (AIR-2, a candidate example).
  {
    name: "feature: Confirm",
    prototype: {
      page: "featAdmin",
      selector: `${panelWith("table")} > p:first-of-type button.small`,
    },
    live: { page: "featAdmin", selector: "#example .admin-example-meta .button-small" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "feature: example pill (Candidate)",
    prototype: { page: "featAdmin", selector: `${panelWith("table")} > p:first-of-type .pill` },
    live: { page: "featAdmin", selector: "#example .admin-pill-example-candidate" },
    box: ["height"],
  },
  // A writer: the category is admin only, dimmed, as AIR-2's status panel. Last: it signs in again.
  {
    name: "fields, writer: category panel (dimmed)",
    prototype: { page: "featWriter", selector: ".stack > .panel.ro" },
    live: { page: "fieldsWriter", selector: ".admin-after-editor > .admin-section.admin-ro" },
    properties: [...STYLE, "opacity"],
    box: ["x", "width"],
  },
  {
    name: "fields, writer: Admin only",
    prototype: { page: "featWriter", selector: ".panel.ro h2 .lock" },
    live: { page: "fieldsWriter", selector: ".admin-ro h2 .admin-lock" },
  },
  {
    name: "fields, writer: read-only note",
    prototype: { page: "featWriter", selector: ".panel.ro > p.note" },
    live: { page: "fieldsWriter", selector: ".admin-ro > .admin-note" },
  },
  {
    name: "fields, writer: category button (disabled)",
    prototype: { page: "statusWriter", selector: '.ro .seg button[aria-pressed="false"]' },
    live: { page: "fieldsWriter", selector: '.admin-ro .admin-seg button[aria-pressed="false"]' },
    properties: [...STYLE, "opacity"],
    box: ["height"],
  },
  {
    name: "fields, writer: Save category (disabled)",
    prototype: { page: "statusWriter", selector: ".ro button.primary" },
    live: { page: "fieldsWriter", selector: ".admin-ro .button-filled" },
    properties: [...STYLE, "opacity"],
    box: ["height"],
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  ...[
    "fields: Save",
    "fields: one-line field (Name)",
    "fields: state button",
    "fields: state button, chosen",
    "fields: Save example",
    "fields: Save category",
    "fields: category button",
    "feature: Confirm",
    "fields, writer: category button (disabled)",
    "fields, writer: Save category (disabled)",
  ].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the drawing has none (auto). Neither draws a minimum: the control's " +
      "height is compared as `box height` (as the #453 editors in admin-visual-ai-features).",
  })),
  {
    component: "No drawing of the registry editor (whole page)",
    properties: ["(page layout)"],
    reason:
      "The drawing's AIR-2 shows the registry fields read only and draws no editor for them " +
      "(docs/decisions/0035). The editor page is assembled from drawn parts only, each compared " +
      "above with the part it reuses: AIF-7's form and side panel, AIR-2's status control for the " +
      "example state and the category, AIR-2's history tables. Its own layout (which panels, in " +
      "which order) is an owner decision listed in the pull request.",
  },
  {
    component: "Field history Old and New columns (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "AIR-2's Version history has When, Who and Field; the issue asks the editors to show the " +
      "old and the new value too. The two extra cells are plain table cells of the same table " +
      "(`fields: field history cell` compares one), and keep line breaks (pre-wrap) so a list " +
      "value shows one item per line.",
  },
  {
    component: "fields: text box",
    properties: ["field-sizing"],
    reason:
      "A box grows with its text, as the #453 purpose editor's (`.admin-field-line textarea`), so " +
      "a long requirement is never cut off; the drawing's box is a fixed 64 px. Not in STYLE; " +
      "listed for the record.",
  },
];

gateTests(
  {
    prototypePages: PROTOTYPE_PAGES,
    livePages: LIVE_PAGES,
    components: COMPONENTS,
    exceptions: EXCEPTIONS,
  },
  (width) => `test_475_registry_editor_matches_the_prototype_at_${width}_px`,
);

// #475: prototype vs live pictures, full page, written as
// ai-registry-editing-<fields|fields-writer|confirm>-<width>-{prototype,live,side-by-side}.png. The
// writer's picture is last: its live page signs the browser in again as a writer.
test("test_475_registry_editor_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(240_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  const pictures: Picture[] = (
    [
      ["ai-registry-editing-fields", "aiPurpose", "fieldsAdmin"],
      ["ai-registry-editing-confirm", "featAdmin", "featAdmin"],
      ["ai-registry-editing-fields-writer", "featWriter", "fieldsWriter"],
    ] as const
  ).map(([name, prototype, live]) => ({
    name,
    prototype: PROTOTYPE_PAGES[prototype],
    live: LIVE_PAGES[live],
    fullPage: true,
    alignTop: true,
  }));
  await writePictures(page, origin, pictures);
});
