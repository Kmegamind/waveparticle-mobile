import { test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
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

// #445: App text (ADM-07) against the prototype's `uitext` screen. Part of the admin visual gate
// (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  uitext: { hash: "uitext" },
};

const LIVE_PAGES: Gate["livePages"] = {
  appText: { path: "/admin/app-text" },
};

const COMPONENTS: Gate["components"] = [
  // #445: App text (ADM-07), the prototype's `uitext` screen: the header with Publish changes, and
  // one line per key with its text edited in place. Rows read the first line (ui.F3.fail.body),
  // which no test writes. They come before the AI feature rows: the last of those pages signs the
  // browser in again as a writer, and Publish changes shows to an admin only.
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

const EXCEPTIONS: Gate["exceptions"] = [
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

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_445_app_text_matches_the_prototype_at_${width}_px`);

// #445: the App text pictures for its pull request (prototype `uitext` vs live App text, as an
// admin) at each width. Written only on request.
test("test_445_app_text_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page, "/admin/app-text");
  await writePictures(page, origin, [
    {
      name: "app-text",
      prototype: PROTOTYPE_PAGES.uitext,
      live: LIVE_PAGES.appText,
      fullPage: false,
    },
  ]);
});
