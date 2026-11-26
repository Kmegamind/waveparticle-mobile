import { test } from "@playwright/test";
import { baseUrlOf, signIn, useSeededPublishHistory } from "./support/account";
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

// #447: Publish history (ADM-12) against the prototype's `history` screen, read on the gate
// account's fixed, seeded history. Part of the admin visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  history: { hash: "history" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // #447: Publish history (ADM-12), the prototype's `history` screen. The gate's account reads a
  // fixed, seeded history (useSeededPublishHistory), never the shared one other tests write (#460).
  history: { path: "/admin/publish-history" },
};

const COMPONENTS: Gate["components"] = [
  // #447: Publish history (ADM-12), read on the gate account's fixed, seeded history: three
  // one-line rows, the first two with Roll back (the gate signs in as an admin).
  {
    name: "history: menu row, current",
    prototype: { page: "history", selector: ".rail a.on" },
    live: { page: "history", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "history: breadcrumb",
    prototype: { page: "history", selector: ".crumb" },
    live: { page: "history", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "history: header row",
    prototype: { page: "history", selector: ".head" },
    live: { page: "history", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "history: page title",
    prototype: { page: "history", selector: ".head h1" },
    live: { page: "history", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "history: lede",
    prototype: { page: "history", selector: ".head .lede" },
    live: { page: "history", selector: ".admin-head .admin-lede" },
  },
  {
    name: "history: panel",
    prototype: { page: "history", selector: ".panel.scroll" },
    live: { page: "history", selector: ".admin-panel.admin-scroll" },
    properties: [...STYLE, "overflow-x"],
    box: ["x", "width"],
  },
  {
    name: "history: table",
    prototype: { page: "history", selector: "table" },
    live: { page: "history", selector: ".admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "history: table head cell",
    prototype: { page: "history", selector: "th" },
    live: { page: "history", selector: ".admin-table th" },
    box: ["height"],
  },
  {
    name: "history: When cell",
    prototype: { page: "history", selector: "td.note" },
    live: { page: "history", selector: ".admin-table td.admin-cell-note" },
  },
  {
    name: "history: Who cell",
    prototype: { page: "history", selector: "td:nth-child(2)" },
    live: { page: "history", selector: ".admin-table td:nth-child(2)" },
  },
  {
    name: "history: What cell",
    prototype: { page: "history", selector: "td:nth-child(3)" },
    live: { page: "history", selector: ".admin-table td:nth-child(3)" },
  },
  {
    name: "history: What id chip",
    prototype: { page: "history", selector: "td:nth-child(3) .key" },
    live: { page: "history", selector: ".admin-table td:nth-child(3) .admin-chip" },
    box: ["height"],
  },
  {
    name: "history: version chip",
    prototype: { page: "history", selector: "td:nth-child(4) .key" },
    live: { page: "history", selector: ".admin-table td:nth-child(4) .admin-chip" },
    box: ["height"],
  },
  {
    // Its height is the row's, which the What text sets (seed data, not compared). That an empty
    // status line adds no height is tested in e2e/publish-history.spec.ts (test_447_ac1).
    name: "history: Roll back cell",
    prototype: { page: "history", selector: "td:last-child" },
    live: { page: "history", selector: ".admin-table td:last-child" },
  },
  {
    name: "history: Roll back button",
    prototype: { page: "history", selector: "td button.small" },
    live: { page: "history", selector: ".admin-table td .button-gray.button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
];

const WORD_BREAK_NORMAL = [
  // #447: the Publish history table, also self-sized in a scrolling panel (.panel.scroll).
  "history: table head cell",
  "history: When cell",
  "history: Who cell",
  "history: What cell",
  "history: What id chip",
  "history: version chip",
  "history: Roll back cell",
  "history: Roll back button",
];

const EXCEPTIONS: Gate["exceptions"] = [
  // #447: Publish history.
  {
    component: "history: Roll back button",
    properties: ["min-width", "min-height", "display", "white-space"],
    reason:
      "As `small secondary button`: live sets min-width and min-height 0 to switch off the phone " +
      "app's 44 px tap minimum (ADMIN-DESKTOP); the prototype has none (auto); the height is " +
      "compared. Both buttons are inline-flex; the live one sits in a grid " +
      "(.admin-history-action, which also holds its status line and the story card warning), " +
      "where the browser computes a grid item's inline-flex as flex. white-space: the " +
      "prototype's label is 'Roll back' and fits its column; the live label names the version " +
      "('Roll back to v2', which the e2e tests and screen readers use), and the self-sized table " +
      "wrapped it to two lines at 1024 px (measured: 44 px against 26 px), so it is nowrap. The " +
      "result, one line, is compared: the button's and the cell's box height.",
  },
  {
    component: "history: panel (box y, not measured)",
    properties: ["box y"],
    reason:
      "The panel's x and width are compared, not its y: it depends on the lede's length. The " +
      "prototype's lede says 'Any entry can be rolled back.', which is not true live (the version " +
      "published now has no Roll back, and story cards, Companion and story fields, prompts and " +
      "hotlines roll back for an admin only, #289); the live lede says what Roll back does and " +
      "that times are in UTC, and wraps to two lines. The header row itself is compared.",
  },
  {
    component: "history: header action row (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The prototype's history screen has an empty .btns slot in its header: the page has no " +
      "page-level action. Live draws no empty slot (PageHead renders none without actions).",
  },
  {
    component: "history: Published now and Rolled back notes (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The prototype offers Roll back on every row. Live keeps decision #289: the version " +
      "published now has no Roll back and shows 'Published now' (the prototype's 12.5 px muted " +
      ".note), and a roll back row says 'Rolled back' after its version chip. The prototype has " +
      "no such row to compare with; the When cell compares the same note style.",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
  wordBreakNormal: WORD_BREAK_NORMAL,
};

gateTests(GATE, (width) => `test_447_publish_history_matches_the_prototype_at_${width}_px`);

// #447: the Publish history pictures for its pull request (prototype `history` vs live, on the
// account's fixed, seeded history), written as publish-history-<width>-{prototype,live,side-by-side}.png.
test("test_447_publish_history_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await useSeededPublishHistory(account);
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, [
    {
      name: "publish-history",
      prototype: PROTOTYPE_PAGES.history,
      live: LIVE_PAGES.history,
      fullPage: false,
      alignTop: true,
    },
  ]);
});
