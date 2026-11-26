import { test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  type Gate,
  type Metric,
  SIDES,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #440 Overview (ADM-01 Status board) against the prototype's `board` screen. Part of the admin
// visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);

/** The shape of a stage dot, without its colours (which state a dot shows is data). */
const DOT_SHAPE = [
  "display",
  "vertical-align",
  "width",
  "height",
  ...SIDES.map((side) => `border-${side}-width`),
  ...SIDES.map((side) => `border-${side}-style`),
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
] as const;

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  // #440 Overview: the Status board (ADM-01).
  board: { hash: "board" },
};

const LIVE_PAGES: Gate["livePages"] = {
  // #440 Overview: the Status board (ADM-01).
  overview: { path: "/admin" },
};

const COMPONENTS: Gate["components"] = [
  // #440 Overview (ADM-01 Status board): the count tiles, the Companion panels and the story table
  // with its stage cells, dots and legend. The legend draws one dot of every state, so each state's
  // colours are compared there whatever the seed holds.
  {
    name: "count tile row",
    prototype: { page: "board", selector: ".tiles" },
    live: { page: "overview", selector: ".admin-tiles" },
    box: ["x", "width"],
  },
  {
    name: "count tile",
    prototype: { page: "board", selector: ".tile" },
    live: { page: "overview", selector: ".admin-tile" },
    box: ["x", "width"],
  },
  {
    name: "count tile, last",
    prototype: { page: "board", selector: ".tile:last-child" },
    live: { page: "overview", selector: ".admin-tile:last-child" },
    box: ["x", "width"],
  },
  {
    name: "count tile number",
    prototype: { page: "board", selector: ".tile b" },
    live: { page: "overview", selector: ".admin-tile-number" },
    properties: [...STYLE, "font-variant-numeric"],
    box: ["height"],
  },
  {
    name: "count tile label",
    prototype: { page: "board", selector: ".tile span" },
    live: { page: "overview", selector: ".admin-tile-label" },
  },
  {
    name: "Companion panel row",
    prototype: { page: "board", selector: "main .grid3" },
    live: { page: "overview", selector: ".admin-grid3" },
    box: ["x", "width"],
  },
  {
    name: "Companion panel",
    prototype: { page: "board", selector: ".grid3 .panel" },
    live: { page: "overview", selector: ".admin-grid3 .admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "Companion panel title",
    prototype: { page: "board", selector: ".grid3 .panel h2" },
    live: { page: "overview", selector: ".admin-grid3 .admin-panel > h2" },
  },
  {
    name: "Companion panel note",
    prototype: { page: "board", selector: ".grid3 .panel .note" },
    live: { page: "overview", selector: ".admin-grid3 .admin-note" },
  },
  {
    name: "story table panel",
    prototype: { page: "board", selector: ".panel:has(> .board)" },
    live: { page: "overview", selector: ".admin-panel:has(> .admin-board)" },
    box: ["x", "width"],
  },
  {
    name: "story table title",
    prototype: { page: "board", selector: ".panel:has(> .board) > h2" },
    live: { page: "overview", selector: ".admin-panel:has(> .admin-board) > h2" },
  },
  {
    name: "story table scroll",
    prototype: { page: "board", selector: ".scroll.board" },
    live: { page: "overview", selector: ".admin-board" },
    properties: [...STYLE, "overflow-x"],
    box: ["width"],
  },
  {
    name: "story table",
    prototype: { page: "board", selector: ".board table" },
    live: { page: "overview", selector: ".admin-board .admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
  },
  {
    name: "story table head cell, stage",
    prototype: { page: "board", selector: ".board th:nth-child(3)" },
    live: { page: "overview", selector: ".admin-board th.admin-stage" },
    box: ["height"],
  },
  {
    name: "story table number cell",
    prototype: { page: "board", selector: ".board td.num" },
    live: { page: "overview", selector: ".admin-board td.admin-num" },
  },
  {
    name: "story table stage cell",
    prototype: { page: "board", selector: ".board td.cell" },
    live: { page: "overview", selector: ".admin-board td.admin-stage" },
  },
  {
    name: "stage dot in a row",
    prototype: { page: "board", selector: ".board td.cell .dot" },
    live: { page: "overview", selector: ".admin-board td.admin-stage .admin-dot" },
    properties: DOT_SHAPE,
    box: ["width", "height"],
  },
  ...(
    [
      ["done", ".dot.d4"],
      ["checks passed", ".dot.d2"],
      ["a check failed", ".dot.bad"],
      ["not done yet", ".dot:not(.d1):not(.d2):not(.d3):not(.d4):not(.bad)"],
    ] as const
  ).map(([state, selector], index) => ({
    name: `legend dot (${state})`,
    prototype: { page: "board", selector: `.legend ${selector}` },
    live: {
      page: "overview",
      selector: `.admin-legend .admin-dot-${["done", "passed", "failed", "none"][index]}`,
    },
    properties: [...STYLE, "width", "height"],
    box: ["width", "height"] as Metric[],
  })),
  {
    name: "legend",
    prototype: { page: "board", selector: ".legend" },
    live: { page: "overview", selector: ".admin-legend" },
  },
  {
    name: "legend item",
    prototype: { page: "board", selector: ".legend span" },
    live: { page: "overview", selector: ".admin-legend span" },
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  {
    component: "story table head cell, stage",
    properties: ["box height"],
    reason:
      "#440: the prototype has seven stage columns, so at 1024 px a label such as CARD INPUTS " +
      "wraps to two lines (49.5 px); live has only the three stages with data today and no label " +
      "wraps (33 px; at 1280 px both sides are 33 px, checked when the row was added). The " +
      "cell's styles are compared at both widths; only its height depends on the column count.",
  },
];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_440_overview_matches_the_prototype_at_${width}_px`);

// #440: the pictures of the Overview for its pull request: the prototype's Status board and the
// live Overview, whole pages, at each width. Written only on request.
test("test_440_overview_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page, "/admin");
  await writePictures(page, origin, [
    {
      name: "overview",
      prototype: PROTOTYPE_PAGES.board,
      live: LIVE_PAGES.overview,
      fullPage: true,
      alignTop: true,
    },
  ]);
});
