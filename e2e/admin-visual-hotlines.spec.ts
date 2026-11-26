import { test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import { useOwnHotlines } from "./support/hotlines";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  type Gate,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #448: ADM-14 Hotlines and ADM-15 Hotline entry against the hotlines file's screens. Part of the
// admin visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  // #448: the Hotlines list (ADM-14) and the Hotline entry (ADM-15) of the hotlines file.
  hotlines: { hash: "", file: "hotlines" },
  hotline: { hash: "hotline", file: "hotlines" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // #448: Hotlines and the United States entry. Other tests save and publish hotlines while the
  // gate runs, so the gate's account reads its own read-only copy of the seed list
  // (useOwnHotlines "seeded"): a draft another test saves never shows here.
  hotlines: { path: "/admin/hotlines" },
  hotline: { path: "/admin/hotlines/US" },
};

const COMPONENTS: Gate["components"] = [
  // #448: ADM-14 Hotlines against the hotlines file's list screen. The one row is the seed entry
  // (the gate's own read-only copy); only its parts are compared, not its text.
  {
    name: "hotlines: header row",
    prototype: { page: "hotlines", selector: ".head" },
    live: { page: "hotlines", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "hotlines: header action row",
    prototype: { page: "hotlines", selector: ".head .btns" },
    live: { page: "hotlines", selector: ".admin-head .admin-actions" },
    // Beside the lede, not wrapped under it (the same lede text on both sides).
    box: ["x", "y"],
  },
  {
    // The issue's finding: a small main button (12 px, 3 x 9 px) where the drawing has a full one.
    name: "hotlines: Add an entry (main button)",
    prototype: { page: "hotlines", selector: ".head .btns button.primary" },
    live: { page: "hotlines", selector: ".admin-actions .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "hotlines: panel",
    prototype: { page: "hotlines", selector: ".panel" },
    live: { page: "hotlines", selector: ".admin-panel" },
    properties: [...STYLE, "overflow-x"],
    box: ["x", "width"],
  },
  {
    name: "hotlines: table",
    prototype: { page: "hotlines", selector: "table" },
    live: { page: "hotlines", selector: ".admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "hotlines: head cell",
    prototype: { page: "hotlines", selector: "th" },
    live: { page: "hotlines", selector: ".admin-table th" },
    box: ["height"],
  },
  {
    name: "hotlines: cell (Main contact)",
    prototype: { page: "hotlines", selector: "td:nth-child(3)" },
    live: { page: "hotlines", selector: ".admin-table td:nth-child(3)" },
  },
  {
    name: "hotlines: muted cell (Last checked)",
    prototype: { page: "hotlines", selector: "td.note" },
    live: { page: "hotlines", selector: ".admin-table td.admin-note" },
  },
  {
    name: "hotlines: None (optional)",
    prototype: { page: "hotlines", selector: "td span.note" },
    live: { page: "hotlines", selector: ".admin-table td span.admin-note" },
  },
  {
    name: "hotlines: id chip",
    prototype: { page: "hotlines", selector: "td .key" },
    live: { page: "hotlines", selector: ".admin-table .admin-chip" },
    box: ["height"],
  },
  {
    name: "hotlines: pill (Published)",
    prototype: { page: "hotlines", selector: "td .pill.s-pub" },
    live: { page: "hotlines", selector: ".admin-table .admin-pill-published" },
    box: ["height"],
  },
  {
    name: "hotlines: note under the table",
    prototype: { page: "hotlines", selector: ".panel > p.note" },
    live: { page: "hotlines", selector: ".admin-panel > .admin-hotline-list-note" },
  },
  // #448: ADM-15 Hotline entry (United States) against the hotlines file's entry screen.
  {
    name: "hotline: menu row, current on a detail page",
    prototype: { page: "hotline", selector: ".rail a.on" },
    live: { page: "hotline", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "hotline: header row",
    prototype: { page: "hotline", selector: ".head" },
    live: { page: "hotline", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "hotline: page title",
    prototype: { page: "hotline", selector: ".head h1" },
    live: { page: "hotline", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "hotline: title chip",
    prototype: { page: "hotline", selector: ".head h1 .key" },
    live: { page: "hotline", selector: ".admin-head h1 .admin-chip" },
    box: ["height"],
  },
  {
    name: "hotline: header action row",
    prototype: { page: "hotline", selector: ".head .btns" },
    live: { page: "hotline", selector: ".admin-head .admin-actions" },
  },
  {
    name: "hotline: Save draft (secondary button)",
    prototype: { page: "hotline", selector: ".head .btns button:not(.primary)" },
    live: { page: "hotline", selector: ".admin-actions .button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "hotline: legal review note",
    prototype: { page: "hotline", selector: "main > .est" },
    live: { page: "hotline", selector: ".admin-hotline-legal" },
    box: ["x", "width", "height"],
  },
  {
    name: "hotline: two panels",
    prototype: { page: "hotline", selector: ".grid2" },
    live: { page: "hotline", selector: ".admin-hotline-grid" },
    box: ["x", "width"],
  },
  {
    name: "hotline: Entry panel",
    prototype: { page: "hotline", selector: ".grid2 > .panel:first-child" },
    live: { page: "hotline", selector: ".admin-hotline-grid > .admin-panel:first-child" },
    box: ["x", "width"],
  },
  {
    name: "hotline: Preview panel",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child" },
    live: { page: "hotline", selector: ".admin-hotline-grid > .admin-panel:last-child" },
    box: ["x", "width"],
  },
  {
    name: "hotline: panel heading",
    prototype: { page: "hotline", selector: ".grid2 > .panel:first-child > h2" },
    live: { page: "hotline", selector: ".admin-hotline-grid > .admin-panel:first-child > h2" },
    box: ["height"],
  },
  {
    name: "hotline: form",
    prototype: { page: "hotline", selector: ".form" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-form" },
  },
  {
    name: "hotline: field label (Service name)",
    prototype: { page: "hotline", selector: ".form > label:nth-child(2)" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-form > label:nth-child(2)" },
  },
  {
    name: "hotline: field group (Main contact)",
    prototype: { page: "hotline", selector: ".form > label:nth-child(3)" },
    live: {
      page: "hotline",
      selector: ".admin-hotline-grid .admin-form > .admin-field-group:nth-child(3)",
    },
  },
  {
    name: "hotline: text field",
    prototype: { page: "hotline", selector: ".form > label:nth-child(2) input" },
    live: { page: "hotline", selector: ".admin-hotline-grid input[name=serviceName]" },
    properties: [...STYLE, "width"],
    box: ["height"],
  },
  {
    name: "hotline: read-only field (Country)",
    prototype: { page: "hotline", selector: ".form > label:first-child input" },
    live: {
      page: "hotline",
      selector: ".admin-hotline-grid .admin-form > .admin-field-group:first-child input",
    },
    box: ["height"],
  },
  {
    name: "hotline: list field (Main contact)",
    prototype: { page: "hotline", selector: "#mk" },
    live: { page: "hotline", selector: ".admin-hotline-grid select[name=primaryKind]" },
    box: ["height"],
  },
  {
    name: "hotline: field note (Fixed once saved)",
    prototype: { page: "hotline", selector: "#cn" },
    live: {
      page: "hotline",
      selector: ".admin-hotline-grid .admin-form > .admin-field-group:first-child .admin-note",
    },
  },
  {
    name: "hotline: form note",
    prototype: { page: "hotline", selector: ".form > p.note" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-form > p.admin-note" },
  },
  {
    name: "hotline: preview note",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child > p:nth-of-type(1)" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-hotline-preview-note" },
  },
  {
    name: "hotline: preview, Help in",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child > p:nth-of-type(2)" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-hotline-country" },
  },
  {
    name: "hotline: preview, contact line",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child > p:nth-of-type(3)" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-hotline-contact" },
  },
  {
    name: "hotline: preview, link line",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child > p:nth-of-type(4)" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-hotline-link" },
  },
  {
    name: "hotline: Versions heading",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child > h2:nth-of-type(2)" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-hotline-versions" },
    box: ["height"],
  },
  {
    name: "hotline: Versions table",
    prototype: { page: "hotline", selector: ".grid2 table" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "hotline: Versions head cell",
    prototype: { page: "hotline", selector: ".grid2 th" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-table th" },
    box: ["height"],
  },
  {
    name: "hotline: Versions cell",
    prototype: { page: "hotline", selector: ".grid2 td" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-table td" },
  },
  {
    name: "hotline: Versions muted cell (Saved)",
    prototype: { page: "hotline", selector: ".grid2 td.note" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-table td.admin-note" },
  },
  {
    name: "hotline: Versions chip",
    prototype: { page: "hotline", selector: ".grid2 td .key" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-table .admin-chip" },
    box: ["height"],
  },
  {
    name: "hotline: Versions pill (Published)",
    prototype: { page: "hotline", selector: ".grid2 .pill.s-pub" },
    live: { page: "hotline", selector: ".admin-hotline-grid .admin-pill-published" },
    box: ["height"],
  },
  {
    name: "hotline: note under Versions",
    prototype: { page: "hotline", selector: ".grid2 > .panel:last-child > p.note:last-child" },
    live: {
      page: "hotline",
      selector:
        ".admin-hotline-grid > .admin-panel:last-child > .admin-hotline-preview-note:last-child",
    },
  },
];

const WORD_BREAK_NORMAL = [
  // #448: the Versions and list headings keep whole words (normal on both sides).
  "hotline: Versions head cell",
  "hotlines: head cell",
];

const EXCEPTIONS: Gate["exceptions"] = [
  // #448: Hotlines and the Hotline entry.
  ...[
    "hotlines: Add an entry (main button)",
    "hotline: Save draft (secondary button)",
    "hotline: text field",
    "hotline: read-only field (Country)",
    "hotline: list field (Main contact)",
  ].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin (ADMIN-" +
      "DESKTOP; a one-line field also drops the text box's 64 px); the drawing has none (auto). " +
      "Neither draws a minimum: the control's height is compared as `box height`.",
  })),
  {
    component: "hotlines: country list for Add an entry (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The drawing's Add an entry opens an empty entry whose Country field is typed. Live keeps " +
      "its list of the countries with no entry (#118: a country is chosen from the list, and is " +
      "fixed once saved) as a labelled field under the table, which the header's Add an entry " +
      "submits; in the header it made the action row wrap under the lede. It is the admin's " +
      "form field and label (compared as `hotline: list field (Main contact)` and `hotline: " +
      "field label (Service name)`).",
  },
  {
    component: "hotline: legal review note (box y, not measured)",
    properties: ["box y"],
    reason:
      "The note's x, width and height are compared, not its y: it sits under the lede, and the " +
      "drawing's lede is sample text one line longer than the live one. The header row is " +
      "compared.",
  },
  {
    component: "hotline: preview links (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The drawing's preview links have no href (a toast says what they would open), so the " +
      "browser draws them as its default link. Live links open the real tel:, sms: or https " +
      "address in the admin's link style. Their line (margin, size) is compared as " +
      "`hotline: preview, link line`.",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
  wordBreakNormal: WORD_BREAK_NORMAL,
};

gateTests(GATE, (width) => `test_448_hotlines_match_the_prototype_at_${width}_px`);

// #448: the Hotlines pictures for its pull request (the hotlines file's list and entry screens vs
// live Hotlines and the United States entry, as an admin reading the seed list) at each width,
// full page, written as hotlines-<list|entry>-<width>-{prototype,live,side-by-side}.png.
test("test_448_hotlines_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(180_000);
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await useOwnHotlines(account.token, "seeded");
  const origin = await startPrototypeServing(page, "/admin/hotlines");
  await writePictures(
    page,
    origin,
    (
      [
        ["hotlines-list", "hotlines"],
        ["hotlines-entry", "hotline"],
      ] as const
    ).map(([name, key]) => ({
      name,
      prototype: PROTOTYPE_PAGES[key],
      live: LIVE_PAGES[key],
      fullPage: true,
      alignTop: true,
    })),
  );
});
