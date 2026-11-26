import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  HEIGHT,
  WIDTHS,
  type Component,
  type Gate,
  STYLE,
  differences,
  gateTests,
  openLive,
  openPrototype,
  picturesOnRequest,
  read,
  startPrototypeServing,
  writePictures,
} from "./support/admin-visual";

// #441: the Companions list (ADM-03) against the prototype's Characters screen. Part of the admin
// visual gate (e2e/support/admin-visual.ts, #483). The frame rows read on this page (table, head
// cell, pills) are compared in e2e/admin-visual.spec.ts.

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const PROTOTYPE_PAGES: Gate["prototypePages"] = {
  characters: { hash: "characters" },
};

const LIVE_PAGES: Gate["livePages"] = {
  companions: { path: "/admin/companions" },
};

const COMPONENTS: Gate["components"] = [
  // #441: the Companions list (the prototype's Characters).
  {
    name: "Companion name",
    prototype: { page: "characters", selector: "tr.click td b" },
    live: { page: "companions", selector: ".admin-table .admin-row-link" },
    properties: [...STYLE, "cursor"],
  },
  {
    name: "clickable row",
    prototype: { page: "characters", selector: "tr.click" },
    live: { page: "companions", selector: ".admin-table tr.admin-row-click" },
    properties: ["cursor", "background-color"],
  },
  {
    name: "pill (Draft)",
    prototype: { page: "characters", selector: ".pill.s-draft" },
    live: { page: "companions", selector: ".admin-table .admin-pill-draft" },
    box: ["height"],
  },
  {
    name: "panel that scrolls sideways",
    prototype: { page: "characters", selector: ".panel.scroll" },
    live: { page: "companions", selector: ".admin-panel.admin-panel-scroll" },
    properties: [...STYLE, "overflow-x", "overflow-y"],
  },
];

const EXCEPTIONS: Gate["exceptions"] = [];

const GATE: Gate = {
  prototypePages: PROTOTYPE_PAGES,
  livePages: LIVE_PAGES,
  components: COMPONENTS,
  exceptions: EXCEPTIONS,
};

gateTests(GATE, (width) => `test_441_companions_match_the_prototype_at_${width}_px`);

// #441: a Companions row under the mouse (the prototype's `tr.click:hover td`). Compared in its own
// test so the mouse left over a row never changes a reading of the main gate.
for (const width of WIDTHS) {
  test(`test_441_hovered_companion_row_matches_the_prototype_at_${width}_px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: HEIGHT });
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    const origin = await startPrototypeServing(page);
    const hovered: Component = {
      name: "clickable row cell, hovered",
      prototype: { page: "characters", selector: "tr.click:hover td" },
      live: { page: "companions", selector: ".admin-table tr.admin-row-click:hover td" },
      properties: [...STYLE, "cursor"],
    };

    // force: the name's link is stretched over its row, so it, not the cell, takes the pointer.
    await openLive(page, LIVE_PAGES.companions);
    await page.locator(".admin-table tr.admin-row-click td").nth(1).hover({ force: true });
    const live = await read(page, hovered, "live");
    await openPrototype(page, origin, PROTOTYPE_PAGES.characters);
    await page.locator("tr.click td").nth(1).hover({ force: true });
    const prototype = await read(page, hovered, "prototype");

    expect(differences(GATE, hovered.name, prototype, live), `hovered row at ${width} px`).toEqual(
      [],
    );
  });
}

// #441: the Companions pictures for the pull request, prototype (Characters) on the left and live
// on the right, at each width. Written only on request (ADMIN_VISUAL_SCREENSHOTS=1).
test("test_441_companions_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(120_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  await writePictures(page, origin, [
    {
      name: "companions",
      prototype: PROTOTYPE_PAGES.characters,
      live: LIVE_PAGES.companions,
      fullPage: false,
    },
  ]);
});
