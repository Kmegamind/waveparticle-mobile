import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  FRAME_COMPONENTS,
  FRAME_GATE,
  FRAME_PROTOTYPE_PAGES,
  HEIGHT,
  REFERENCE_DIR,
  STYLE,
  WIDTHS,
  differences,
  gateTests,
  openPrototype,
  picturesOnRequest,
  read,
  registerGate,
  startPrototypeServing,
  writePictures,
  type Component,
  type Gate,
  type PageSetup,
  type Picture,
  type Reading,
} from "./support/admin-visual";
import { writeFileSync } from "node:fs";
import path from "node:path";

// #467: the AI feature registry screens of the drawing (docs/design/prototype/admin-ai-features
// .html), every screen and state, compared with the prototype's own frame. #474: the registry and
// the feature detail are live now and compared with the drawing too (the second half of this
// file). Part of the admin visual gate (e2e/support/admin-visual.ts, #483).

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

/**
 * #467: the AI feature registry screens of admin-ai-features.html (registry, feature detail, run
 * panel, comparison lab, runs, samples), each in every state, at hash `reg-<screen>/<state>`. No
 * live page draws them yet, so no live row compares them; test_467 reads each one's frame.
 */
const REGISTRY_SCREENS = ["registry", "feature", "run", "lab", "runs", "samples"] as const;
const REGISTRY_STATES = ["admin", "writer", "empty", "loading", "error", "running"] as const;
const REGISTRY_PAGES: { key: string; picture: string; hash: string; prepare?: PageSetup }[] = [
  ...REGISTRY_SCREENS.flatMap((screen) =>
    REGISTRY_STATES.map((state) => ({
      key: `registry_${screen}_${state}`,
      picture: `ai-registry-${screen}-${state}`,
      hash: `reg-${screen}/${state}`,
    })),
  ),
  // The registry as an admin with its table scrolled to the right end: the Prompt, Status and
  // Example columns, the admin's Change buttons and the example pills, beside the sticky ID and Name.
  {
    key: "registry_registry_admin_scrolled",
    picture: "ai-registry-registry-admin-scrolled",
    hash: "reg-registry/admin",
    prepare: async (page) => {
      const panel = page.locator(".reg-scroll");
      await panel.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
      await expect(page.locator("table.reg td:nth-child(8) .pill").first()).toBeInViewport();
    },
  },
];

const PROTOTYPE_PAGES: Gate["prototypePages"] = Object.fromEntries(
  REGISTRY_PAGES.map((target) => [
    target.key,
    { hash: target.hash, file: "aiFeatures" as const, prepare: target.prepare },
  ]),
);

// No live rows: recorded so the inventory (scripts/admin-visual-inventory.mjs) lists the screens.
registerGate({ prototypePages: PROTOTYPE_PAGES, livePages: {}, components: [], exceptions: [] });

// #467: the registry screens have no live page yet. In every state, at both widths, each one's
// frame (page, rail, menu rows, header, title, lede) must match the prototype's own Characters
// screen with the same tolerance as a live page: over 1 px or a different colour fails.
const REGISTRY_FRAME = [
  "page (body / frame)",
  "rail",
  "brand block",
  "brand",
  "brand line (Content admin)",
  "menu group heading",
  "menu row",
  "menu row, current",
  "menu page id",
  "content column",
  "breadcrumb",
  "header row",
  "page title",
  "lede",
];

for (const width of WIDTHS) {
  test(`test_467_registry_prototype_screens_keep_the_prototype_frame_at_${width}_px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: HEIGHT });
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    const origin = await startPrototypeServing(page);
    const frame = FRAME_COMPONENTS.filter((component) => REGISTRY_FRAME.includes(component.name));
    expect(frame.map((component) => component.name)).toEqual(REGISTRY_FRAME);

    await openPrototype(page, origin, FRAME_PROTOTYPE_PAGES.characters);
    const reference = new Map<string, Reading>();
    for (const component of frame) {
      reference.set(component.name, await read(page, component, "prototype"));
    }
    const found: string[] = [];
    for (const target of REGISTRY_PAGES) {
      await openPrototype(page, origin, PROTOTYPE_PAGES[target.key]);
      for (const component of frame) {
        found.push(
          ...differences(
            FRAME_GATE,
            `${target.key}: ${component.name}`,
            reference.get(component.name) ?? {},
            await read(page, component, "prototype"),
          ),
        );
      }
    }
    expect(found, `registry screens that leave the prototype frame at ${width} px`).toEqual([]);
  });
}

// #467: the reference pictures of the registry screens, every state, at each width, written as
// ai-registry-<screen>-<state>-<width>.png. Written only on request.
test("test_467_registry_reference_pictures", async ({ page, context }) => {
  picturesOnRequest(600_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    for (const target of REGISTRY_PAGES) {
      await openPrototype(page, origin, PROTOTYPE_PAGES[target.key]);
      writeFileSync(
        path.join(REFERENCE_DIR, `${target.picture}-${width}.png`),
        await page.screenshot({ fullPage: true }),
      );
    }
  }
});

// ---------------------------------------------------------------------------------------------
// #474: the live registry (/admin/ai-features) and feature detail (/admin/ai-features/<slug>)
// against the drawing's #reg-registry and #reg-feature, as an admin and as a writer, at 1024 and
// 1280 px. Each live page signs the browser in again as a fresh account that reads its own copy
// of the 19 registry rows and a fixed prompt list (POST /__ai_features { token, registry: true },
// made from the invented fixtures of #473), so the gate never reads a row another test writes.
// Text and seed data are never compared, only the fixed components.
// ---------------------------------------------------------------------------------------------

/** Signs the page in again as a registry account of `role`, then reloads it. */
function asRegistryAccount(
  role: "admin" | "writer",
  setup?: (token: string, page: Page) => Promise<void>,
): PageSetup {
  return async (page) => {
    const account = await signIn(page.context(), new URL(page.url()).origin, undefined, {
      contentRole: role,
    });
    const answer = await fetch(`${STUB_SUPABASE}/__ai_features`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: account.token, registry: true }),
    });
    expect(answer.status).toBe(200);
    if (setup) await setup(account.token, page);
    await page.reload();
    await expect(page.locator(".admin-main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const shell = document.querySelector(".admin-shell");
      return !!shell && Object.keys(shell).some((key) => key.startsWith("__reactFiber"));
    });
    await page.evaluate(() => document.fonts.ready);
  };
}

const LIVE_REGISTRY_PROTOTYPE: Gate["prototypePages"] = {
  regAdmin: { hash: "reg-registry/admin", file: "aiFeatures" },
  regWriter: { hash: "reg-registry/writer", file: "aiFeatures" },
  regEmpty: { hash: "reg-registry/empty", file: "aiFeatures" },
  regError: { hash: "reg-registry/error", file: "aiFeatures" },
  featAdmin: { hash: "reg-feature/admin/R-03", file: "aiFeatures" },
  featWriter: { hash: "reg-feature/writer/R-03", file: "aiFeatures" },
  featPipeline: { hash: "reg-feature/admin/P-02", file: "aiFeatures" },
};

const LIVE_REGISTRY_PAGES: Gate["livePages"] = {
  regAdmin: { path: "/admin/ai-features", prepare: asRegistryAccount("admin") },
  regWriter: { path: "/admin/ai-features", prepare: asRegistryAccount("writer") },
  // No row matches the search: the table's empty row, as the drawing's empty state.
  regEmpty: {
    path: "/admin/ai-features",
    prepare: async (page) => {
      await asRegistryAccount("admin")(page);
      await page.getByRole("textbox", { name: "Search" }).fill("no row says this");
      await expect(page.locator(".admin-reg td .admin-empty")).toBeVisible();
    },
  },
  // The registry read fails for this account only (POST /__fail_reads).
  regError: {
    path: "/admin/ai-features",
    prepare: asRegistryAccount("admin", async (token) => {
      const answer = await fetch(`${STUB_SUPABASE}/__fail_reads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, tables: ["ai_features"] }),
      });
      expect(answer.status).toBe(200);
    }),
  },
  featAdmin: { path: "/admin/ai-features/pause_message", prepare: asRegistryAccount("admin") },
  featWriter: { path: "/admin/ai-features/pause_message", prepare: asRegistryAccount("writer") },
  featPipeline: {
    path: "/admin/ai-features/p02_select_stories",
    prepare: asRegistryAccount("admin"),
  },
};

/** The drawing's feature panel that holds `inner` (its sections carry no ids). */
const panelWith = (inner: string) => `.stack > .panel:has(${inner})`;

const LIVE_REGISTRY_COMPONENTS: Component[] = [
  // The registry as an admin (drawing AIR-1).
  {
    name: "registry: menu row, current",
    prototype: { page: "regAdmin", selector: ".rail a.on" },
    live: { page: "regAdmin", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "registry: breadcrumb",
    prototype: { page: "regAdmin", selector: ".crumb" },
    live: { page: "regAdmin", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "registry: header row",
    prototype: { page: "regAdmin", selector: ".head" },
    live: { page: "regAdmin", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "registry: page title",
    prototype: { page: "regAdmin", selector: ".head h1" },
    live: { page: "regAdmin", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "registry: lede",
    prototype: { page: "regAdmin", selector: ".head .lede" },
    live: { page: "regAdmin", selector: ".admin-head .admin-lede" },
  },
  {
    name: "registry: header action row",
    prototype: { page: "regAdmin", selector: ".head .btns" },
    live: { page: "regAdmin", selector: ".admin-head .admin-actions" },
  },
  {
    name: "registry: role pill (admin)",
    prototype: { page: "regAdmin", selector: ".head .btns .pill.s-read" },
    live: { page: "regAdmin", selector: ".admin-head .admin-pill-role-admin" },
    box: ["height"],
  },
  {
    name: "registry: role pill dot",
    prototype: { page: "regAdmin", selector: ".head .btns .pill.s-read" },
    live: { page: "regAdmin", selector: ".admin-head .admin-pill-role-admin" },
    pseudo: "::before",
    properties: [...STYLE, "width", "height", "content"],
  },
  {
    name: "registry: filter row",
    prototype: { page: "regAdmin", selector: ".filters" },
    live: { page: "regAdmin", selector: ".admin-filters" },
    box: ["x", "y", "width", "height"],
  },
  {
    name: "registry: filter label",
    prototype: { page: "regAdmin", selector: ".filters label" },
    live: { page: "regAdmin", selector: ".admin-filters label" },
    properties: [...STYLE, "grid-template-columns"],
  },
  {
    name: "registry: category select",
    prototype: { page: "regAdmin", selector: ".filters select" },
    live: { page: "regAdmin", selector: ".admin-filters select" },
    box: ["height"],
  },
  {
    name: "registry: search field",
    prototype: { page: "regAdmin", selector: ".filters input[type=text]" },
    live: { page: "regAdmin", selector: ".admin-filters input" },
    box: ["width", "height"],
  },
  {
    name: "registry: Sort by ID",
    prototype: { page: "regAdmin", selector: ".filters > button" },
    live: { page: "regAdmin", selector: ".admin-filters > button" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "registry: panel",
    prototype: { page: "regAdmin", selector: ".panel:has(table.reg)" },
    live: { page: "regAdmin", selector: ".admin-panel:has(.admin-reg)" },
    box: ["x", "y", "width"],
  },
  {
    name: "registry: scroll area",
    prototype: { page: "regAdmin", selector: ".reg-scroll" },
    live: { page: "regAdmin", selector: ".admin-reg-scroll" },
    properties: [...STYLE, "overflow-x"],
    box: ["width"],
  },
  {
    name: "registry: table",
    prototype: { page: "regAdmin", selector: "table.reg" },
    live: { page: "regAdmin", selector: "table.admin-reg" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "registry: head cell",
    prototype: { page: "regAdmin", selector: "table.reg th:nth-child(3)" },
    live: { page: "regAdmin", selector: "table.admin-reg th:nth-child(3)" },
    box: ["height"],
  },
  ...(["ID", "Name"] as const).flatMap((column, index): Component[] => [
    {
      name: `registry: sticky head cell (${column})`,
      prototype: { page: "regAdmin", selector: `table.reg th:nth-child(${index + 1})` },
      live: { page: "regAdmin", selector: `table.admin-reg th:nth-child(${index + 1})` },
      properties: [...STYLE, "position", "left", "z-index"],
      box: ["x", ...(index === 0 ? (["width"] as const) : [])],
    },
    {
      name: `registry: sticky cell (${column})`,
      prototype: { page: "regAdmin", selector: `table.reg td:nth-child(${index + 1})` },
      live: { page: "regAdmin", selector: `table.admin-reg td:nth-child(${index + 1})` },
      properties: [...STYLE, "position", "left", "z-index"],
      box: ["x", ...(index === 0 ? (["width"] as const) : [])],
    },
  ]),
  {
    name: "registry: ID chip",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(1) .key" },
    live: { page: "regAdmin", selector: "table.admin-reg td:nth-child(1) .admin-chip" },
    box: ["height"],
  },
  {
    name: "registry: name",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(2) b" },
    live: { page: "regAdmin", selector: "table.admin-reg td:nth-child(2) b" },
  },
  {
    name: "registry: category cell",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(3)" },
    live: { page: "regAdmin", selector: "table.admin-reg td:nth-child(3)" },
  },
  {
    name: "registry: where cell",
    prototype: { page: "regAdmin", selector: "table.reg td.note" },
    live: { page: "regAdmin", selector: "table.admin-reg td.admin-cell-note" },
  },
  {
    name: "registry: requirement cell",
    prototype: { page: "regAdmin", selector: "table.reg td.wide" },
    live: { page: "regAdmin", selector: "table.admin-reg td.admin-reg-wide" },
  },
  {
    name: "registry: prompt chip",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(6) .key" },
    live: { page: "regAdmin", selector: "table.admin-reg td:nth-child(6) .admin-chip" },
    box: ["height"],
  },
  {
    name: "registry: view link",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(6) a" },
    live: { page: "regAdmin", selector: "table.admin-reg td:nth-child(6) > a" },
  },
  {
    name: "registry: status pill (Exploring)",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(7) .pill.s-gen" },
    live: {
      page: "regAdmin",
      selector: "table.admin-reg td:nth-child(7) .admin-pill-ai-exploring",
    },
    box: ["height"],
  },
  {
    name: "registry: Change",
    prototype: { page: "regAdmin", selector: "table.reg td:nth-child(7) button.small" },
    live: { page: "regAdmin", selector: "table.admin-reg td:nth-child(7) .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  ...(
    [
      ["Candidate", "s-checked", "candidate"],
      ["Confirmed", "s-pub", "confirmed"],
      ["None", "s-draft", "none"],
    ] as const
  ).map(([label, prototypeClass, state]): Component => ({
    name: `registry: example pill (${label})`,
    prototype: { page: "regAdmin", selector: `table.reg td:nth-child(8) .pill.${prototypeClass}` },
    live: {
      page: "regAdmin",
      selector: `table.admin-reg td:nth-child(8) .admin-pill-example-${state}`,
    },
    box: ["height"],
  })),
  {
    name: "registry: legend",
    prototype: { page: "regAdmin", selector: ".legend" },
    live: { page: "regAdmin", selector: ".admin-legend" },
    box: ["width"],
  },
  {
    name: "registry: legend item",
    prototype: { page: "regAdmin", selector: ".legend span" },
    live: { page: "regAdmin", selector: ".admin-legend > span" },
  },
  ...(
    [
      ["Not started", "s-draft", "not_started"],
      ["Passed", "s-pub", "passed"],
      ["Frozen", "s-read", "frozen"],
    ] as const
  ).map(([label, prototypeClass, status]): Component => ({
    name: `registry: status pill (${label})`,
    prototype: {
      page: "regAdmin",
      selector: `.legend > span:nth-child(2) .pill.${prototypeClass}`,
    },
    live: { page: "regAdmin", selector: `.admin-legend .admin-pill-ai-${status}` },
    box: ["height"],
  })),
  // The registry as a writer, with no row to show, and with a read that failed.
  {
    name: "registry, writer: role pill",
    prototype: { page: "regWriter", selector: ".head .btns .pill.s-draft" },
    live: { page: "regWriter", selector: ".admin-head .admin-pill-role-writer" },
    box: ["height"],
  },
  {
    name: "registry, writer: status cell (no Change)",
    prototype: { page: "regWriter", selector: "table.reg td:nth-child(7)" },
    live: { page: "regWriter", selector: "table.admin-reg td:nth-child(7)" },
  },
  {
    name: "registry, empty: empty row",
    prototype: { page: "regEmpty", selector: "table.reg td .empty" },
    live: { page: "regEmpty", selector: "table.admin-reg td .admin-empty" },
  },
  {
    name: "registry, error: error box",
    prototype: { page: "regError", selector: ".errbox" },
    live: { page: "regError", selector: ".admin-errbox" },
    box: ["x", "width"],
  },
  {
    name: "registry, error: Retry",
    prototype: { page: "regError", selector: ".errbox button.small" },
    live: { page: "regError", selector: ".admin-errbox .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  // The feature detail of R-03 as an admin (drawing AIR-2).
  {
    name: "feature: menu row, current",
    prototype: { page: "featAdmin", selector: ".rail a.on" },
    live: { page: "featAdmin", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "feature: breadcrumb",
    prototype: { page: "featAdmin", selector: ".crumb" },
    live: { page: "featAdmin", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "feature: breadcrumb link",
    prototype: { page: "featAdmin", selector: ".crumb a" },
    live: { page: "featAdmin", selector: ".admin-crumb a" },
  },
  {
    name: "feature: page title",
    prototype: { page: "featAdmin", selector: ".head h1" },
    live: { page: "featAdmin", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "feature: lede",
    prototype: { page: "featAdmin", selector: ".head .lede" },
    live: { page: "featAdmin", selector: ".admin-head .admin-lede" },
  },
  {
    name: "feature: header action row",
    prototype: { page: "featAdmin", selector: ".head .btns" },
    live: { page: "featAdmin", selector: ".admin-head .admin-actions" },
  },
  {
    name: "feature: link in the header action row",
    prototype: { page: "featAdmin", selector: ".head .btns a.btn" },
    live: { page: "featAdmin", selector: ".admin-head .admin-actions a.button-gray" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "feature: sections",
    prototype: { page: "featAdmin", selector: ".stack" },
    live: { page: "featAdmin", selector: ".admin-sections" },
    box: ["x", "width"],
  },
  {
    name: "feature: section panel",
    prototype: { page: "featAdmin", selector: ".stack > .panel" },
    live: { page: "featAdmin", selector: ".admin-sections > .admin-panel" },
    box: ["x", "width"],
  },
  {
    name: "feature: section heading",
    prototype: { page: "featAdmin", selector: ".stack > .panel > h2" },
    live: { page: "featAdmin", selector: ".admin-section > h2" },
    box: ["height"],
  },
  {
    name: "feature: field text (Requirement)",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(3) > p:first-of-type" },
    live: { page: "featAdmin", selector: "#requirement > .admin-field-text" },
  },
  {
    name: "feature: Not written yet",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(9) > .empty" },
    live: { page: "featAdmin", selector: "#notes > .admin-empty" },
  },
  {
    name: "feature: source line",
    prototype: { page: "featAdmin", selector: ".stack .src" },
    live: { page: "featAdmin", selector: ".admin-sections .admin-src" },
  },
  {
    name: "feature: prompt line",
    prototype: { page: "featAdmin", selector: `${panelWith(".cmp")} > p:first-of-type` },
    live: { page: "featAdmin", selector: ".admin-reg-prompt-key > .admin-prompt-meta" },
  },
  {
    name: "feature: prompt key chip",
    prototype: { page: "featAdmin", selector: `${panelWith(".cmp")} > p:first-of-type .key` },
    live: { page: "featAdmin", selector: ".admin-prompt-meta > .admin-chip" },
    box: ["height"],
  },
  {
    name: "feature: category chip",
    prototype: {
      page: "featAdmin",
      selector: `${panelWith(".cmp")} > p:first-of-type .key ~ .key`,
    },
    live: { page: "featAdmin", selector: ".admin-prompt-meta > .admin-chip ~ .admin-chip" },
    box: ["height"],
  },
  {
    name: "feature: Published pill",
    prototype: { page: "featAdmin", selector: `${panelWith(".cmp")} > p:first-of-type .s-pub` },
    live: { page: "featAdmin", selector: ".admin-prompt-meta > .admin-pill-published" },
    box: ["height"],
  },
  {
    name: "feature: Draft pill",
    prototype: { page: "featAdmin", selector: `${panelWith(".cmp")} > p:first-of-type .s-draft` },
    live: { page: "featAdmin", selector: ".admin-prompt-meta > .admin-pill-draft" },
    box: ["height"],
  },
  {
    name: "feature: published and draft columns",
    prototype: { page: "featAdmin", selector: ".cmp" },
    live: { page: "featAdmin", selector: ".admin-cmp" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "feature: column label",
    prototype: { page: "featAdmin", selector: ".cmp .note" },
    live: { page: "featAdmin", selector: ".admin-cmp .admin-cmp-label" },
  },
  {
    name: "feature: prompt text",
    prototype: { page: "featAdmin", selector: ".cmp pre.code" },
    live: { page: "featAdmin", selector: ".admin-cmp pre.admin-code" },
    box: ["x", "width"],
  },
  {
    name: "feature: variable",
    prototype: { page: "featAdmin", selector: ".cmp .var" },
    live: { page: "featAdmin", selector: ".admin-cmp .admin-var" },
  },
  {
    name: "feature: Changed lines label",
    prototype: { page: "featAdmin", selector: "p.note:has(+ .diff)" },
    live: { page: "featAdmin", selector: ".admin-diff-label" },
  },
  {
    name: "feature: changed lines",
    prototype: { page: "featAdmin", selector: ".diff" },
    live: { page: "featAdmin", selector: ".admin-reg-diff" },
    properties: [...STYLE, "overflow-x", "overflow-y"],
    box: ["x", "width"],
  },
  ...(
    [
      ["removed", "div.del", "removed"],
      ["added", "div.add", "added"],
      ["same", "div:not(.add):not(.del)", "same"],
    ] as const
  ).map(([label, prototypeSelector, kind]): Component => ({
    name: `feature: changed line (${label})`,
    prototype: { page: "featAdmin", selector: `.diff > ${prototypeSelector}` },
    live: { page: "featAdmin", selector: `.admin-reg-diff > .admin-reg-diff-${kind}` },
  })),
  {
    name: "feature: status pill in the heading",
    prototype: { page: "featAdmin", selector: `${panelWith(".form")} > h2 .pill` },
    live: { page: "featAdmin", selector: "#status > h2 .admin-pill" },
    box: ["height"],
  },
  {
    name: "feature: status form",
    prototype: { page: "featAdmin", selector: ".stack .form" },
    live: { page: "featAdmin", selector: "#status .admin-form" },
    properties: [...STYLE, "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "feature: status button",
    prototype: { page: "featAdmin", selector: '.stack .form .seg button[aria-pressed="false"]' },
    live: { page: "featAdmin", selector: '#status .admin-seg button[aria-pressed="false"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "feature: status button, chosen",
    prototype: { page: "featAdmin", selector: '.stack .form .seg button[aria-pressed="true"]' },
    live: { page: "featAdmin", selector: '#status .admin-seg button[aria-pressed="true"]' },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "feature: reason field",
    prototype: { page: "featAdmin", selector: ".stack .form label input" },
    live: { page: "featAdmin", selector: "#status .admin-form label input" },
    box: ["height"],
  },
  {
    name: "feature: Save status",
    prototype: { page: "featAdmin", selector: ".stack .form button.primary" },
    live: { page: "featAdmin", selector: "#status .admin-form .button-filled" },
    properties: [...STYLE, "cursor", "opacity"],
    box: ["height"],
  },
  {
    name: "feature: history table",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) table" },
    live: { page: "featAdmin", selector: "#history .admin-table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "feature: history head cell",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) th" },
    live: { page: "featAdmin", selector: "#history .admin-table th" },
    box: ["height"],
  },
  {
    name: "feature: history time cell",
    prototype: { page: "featAdmin", selector: ".stack > .panel:nth-child(12) td.note" },
    live: { page: "featAdmin", selector: "#history .admin-table td.admin-cell-note" },
  },
  {
    name: "feature: retry_hints heading chip",
    prototype: { page: "featAdmin", selector: ".stack > .panel:last-child > h2 .key" },
    live: { page: "featAdmin", selector: "#retry > h2 .admin-chip" },
    box: ["height"],
  },
  {
    name: "feature: retry_hints text",
    prototype: { page: "featAdmin", selector: ".stack > .panel:last-child > pre.code" },
    live: { page: "featAdmin", selector: "#retry > pre.admin-code" },
    box: ["x", "width"],
  },
  // The confirmed example of P-02, a Pipeline row (drawing AIR-2 for P-02).
  {
    name: "feature, P-02: example line",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) > p:first-of-type" },
    live: { page: "featPipeline", selector: "#example > .admin-example-meta" },
  },
  {
    name: "feature, P-02: example pill (Confirmed)",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) .pill.s-pub" },
    live: { page: "featPipeline", selector: "#example .admin-pill-example-confirmed" },
    box: ["height"],
  },
  {
    name: "feature, P-02: who confirmed it",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) > p .note" },
    live: { page: "featPipeline", selector: "#example > .admin-example-meta .admin-note" },
  },
  {
    name: "feature, P-02: example text",
    prototype: {
      page: "featPipeline",
      selector: ".stack > .panel:nth-child(7) > p:nth-of-type(2)",
    },
    live: { page: "featPipeline", selector: "#example > .admin-field-text" },
  },
  {
    name: "feature, P-02: earlier examples table",
    prototype: { page: "featPipeline", selector: ".stack > .panel:nth-child(7) > table" },
    live: { page: "featPipeline", selector: "#example > table" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  // The feature detail of R-03 as a writer: the status is read only.
  {
    name: "feature, writer: role pill",
    prototype: { page: "featWriter", selector: ".head .btns .pill.s-draft" },
    live: { page: "featWriter", selector: ".admin-head .admin-pill-role-writer" },
    box: ["height"],
  },
  {
    name: "feature, writer: status panel (dimmed)",
    prototype: { page: "featWriter", selector: ".stack > .panel.ro" },
    live: { page: "featWriter", selector: ".admin-sections > .admin-section.admin-ro" },
    properties: [...STYLE, "opacity"],
    box: ["x", "width"],
  },
  {
    name: "feature, writer: Admin only",
    prototype: { page: "featWriter", selector: ".panel.ro h2 .lock" },
    live: { page: "featWriter", selector: ".admin-ro h2 .admin-lock" },
  },
  {
    name: "feature, writer: read-only note",
    prototype: { page: "featWriter", selector: ".panel.ro > p.note" },
    live: { page: "featWriter", selector: ".admin-ro > .admin-note" },
  },
];

const LIVE_REGISTRY_EXCEPTIONS: Gate["exceptions"] = [
  ...[
    "registry: category select",
    "registry: search field",
    "registry: Sort by ID",
    "registry, error: Retry",
    "feature: breadcrumb link",
    "feature: link in the header action row",
    "feature: status button",
    "feature: status button, chosen",
    "feature: reason field",
  ].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the drawing has none (auto). Neither draws a minimum: the control's " +
      "height is compared as `box height` (as the #453 editors in admin-visual-ai-features).",
  })),
  ...["feature: breadcrumb link", "registry: view link"].map((component) => ({
    component,
    properties: ["align-items"],
    reason:
      "From the app's base link style; it does nothing on a link with no flex children. Font, " +
      "colour of the breadcrumb and underline are compared (as `feature: breadcrumb link` of #439).",
  })),
  {
    component: "registry: view link",
    properties: ["color"],
    reason:
      "The drawing gives a link in a table cell no colour, so it draws the browser's default " +
      "link blue (rgb(0, 0, 238)), which is not one of the admin tokens; live links use the " +
      "admin's ink token, as every live admin link outside the breadcrumb does (UI: tokens only).",
  },
  {
    component: "registry: filter row",
    properties: ["box y"],
    reason:
      "Its y follows the header, whose lede is text: the drawing's lede adds the path and the " +
      "seed date and wraps to two lines; the live lede is one line. The header row's x, y and " +
      "width are compared, and the filter row's x, width and height.",
  },
  {
    component: "registry: panel",
    properties: ["box y"],
    reason: "As `registry: filter row`: it sits under the header, whose lede is text.",
  },
  {
    component: "registry, error: error box",
    properties: ["margin-bottom"],
    reason:
      "The drawing puts an empty 12 px div under its error box; live gives the box a 12 px " +
      "bottom margin (--adm-errbox-after) instead. The same 12 px gap above the filter row.",
  },
  ...["feature: field text (Requirement)", "feature, P-02: example text"].map((component) => ({
    component,
    properties: ["white-space"],
    reason:
      "A stored field keeps its line breaks (pre-wrap), as App text does (#445); the drawing's " +
      "sample text has none and computes normal. Font, colour and margins are compared.",
  })),
  {
    component: "Loading state, Latest run, Run, Confirm (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The loading lines show only while the server reads, so the gate cannot hold them; they " +
      "use the drawing's sizes (.admin-skel). The Latest run panel, the Run button and the " +
      "running state belong to the Run panel and run log (#476); Confirm on an example is an " +
      "edit, built in #475. Live keeps the imported offline runs as 'Test results' at the end.",
  },
];

gateTests(
  {
    prototypePages: LIVE_REGISTRY_PROTOTYPE,
    livePages: LIVE_REGISTRY_PAGES,
    components: LIVE_REGISTRY_COMPONENTS,
    exceptions: LIVE_REGISTRY_EXCEPTIONS,
  },
  (width) => `test_474_registry_and_feature_detail_match_the_prototype_at_${width}_px`,
);

// #474: prototype vs live pictures of the registry and the R-03 detail, as an admin, full page,
// written as ai-registry-live-<table|feature>-<width>-{prototype,live,side-by-side}.png.
test("test_474_registry_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(240_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  const pictures: Picture[] = (
    [
      ["ai-registry-live-table", "regAdmin"],
      ["ai-registry-live-feature", "featAdmin"],
    ] as const
  ).map(([name, key]) => ({
    name,
    prototype: LIVE_REGISTRY_PROTOTYPE[key],
    live: LIVE_REGISTRY_PAGES[key],
    fullPage: true,
    alignTop: true,
  }));
  await writePictures(page, origin, pictures);
});
