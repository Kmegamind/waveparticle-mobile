import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";
import {
  ADMIN_VISUAL_USE,
  skipGateOutsideCi,
  STYLE,
  gateTests,
  picturesOnRequest,
  startPrototypeServing,
  writePictures,
  type Component,
  type Gate,
  type PageSetup,
  type Picture,
} from "./support/admin-visual";
import { e2ePorts } from "./support/ports";

// #477: AIR-3 the Run panel (/admin/ai-features/<slug>/run) and AIR-5 Runs (/admin/ai-runs),
// against the drawing's #reg-run and #reg-runs (docs/design/prototype/admin-ai-features.html), at
// 1024 and 1280 px. Part of the admin visual gate (e2e/support/admin-visual.ts, #483). The Run
// panel is opened on the "live" app, whose model is the test stub model (no real model is ever
// called); its states are an answer, no run yet, a model error with Retry (the stub's error
// prompt), a run in progress (the request held in the browser) and a writer. Runs reads an own,
// seeded run log of invented runs (e2e/support/stub-ai-runs.mjs). Text and seed data are never
// compared, only the fixed components.

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const LIVE_APP = `http://127.0.0.1:${e2ePorts.live}`;
const RUN_PAGE = `${LIVE_APP}/admin/ai-features/rest_reply/run`;
const RUN_ROUTE = "**/admin/ai-runs/run";

async function post(pathname: string, body: unknown) {
  const answer = await fetch(`${STUB_SUPABASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(answer.status).toBe(200);
}

async function settle(page: Page) {
  await expect(page.locator(".admin-main h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const shell = document.querySelector(".admin-shell");
    return !!shell && Object.keys(shell).some((key) => key.startsWith("__reactFiber"));
  });
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Signs the page in again as a new account of `role` with its own run log, reloads, then runs
 * `then` (for example pressing Run).
 */
function asLabAccount(
  role: "admin" | "writer",
  log: "own" | "seeded",
  then?: (page: Page) => Promise<void>,
): PageSetup {
  return async (page) => {
    // Only this spec's own hold on Run; the prototype's routes stay.
    await page.unroute(RUN_ROUTE);
    const account = await signIn(page.context(), new URL(page.url()).origin, undefined, {
      contentRole: role,
    });
    await post("/__ai_runs", { token: account.token, log });
    await page.reload();
    await settle(page);
    if (then) await then(page);
  };
}

const form = (page: Page) => page.getByRole("form", { name: "Run settings" });
const noSample = (page: Page) =>
  form(page).getByRole("combobox", { name: "Sample" }).selectOption("");

async function runToAnswer(page: Page) {
  await noSample(page);
  await form(page).getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator('.admin-run pre[aria-label="Answer"]')).toBeVisible();
}

async function runToModelError(page: Page) {
  await noSample(page);
  await form(page).getByRole("button", { name: "Pasted text" }).click();
  await form(page)
    .getByRole("textbox", { name: /Pasted text/ })
    .fill("STUB MODEL ERROR");
  await form(page).getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator(".admin-run .admin-errbox")).toBeVisible();
}

async function runInProgress(page: Page) {
  // The request is held in the browser and never reaches the server: nothing is run.
  await page.route(RUN_ROUTE, () => new Promise(() => {}));
  await noSample(page);
  await form(page).getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.locator(".admin-run .admin-run-bar")).toBeVisible();
}

const PROTOTYPE: Gate["prototypePages"] = {
  runAdmin: { hash: "reg-run/admin", file: "aiFeatures" },
  runEmpty: { hash: "reg-run/empty", file: "aiFeatures" },
  runError: { hash: "reg-run/error", file: "aiFeatures" },
  runRunning: { hash: "reg-run/running", file: "aiFeatures" },
  runWriter: { hash: "reg-run/writer", file: "aiFeatures" },
  runsAdmin: { hash: "reg-runs/admin", file: "aiFeatures" },
  runsEmpty: { hash: "reg-runs/empty", file: "aiFeatures" },
  runsError: { hash: "reg-runs/error", file: "aiFeatures" },
};

const LIVE: Gate["livePages"] = {
  runAdmin: { path: RUN_PAGE, prepare: asLabAccount("admin", "own", runToAnswer) },
  runEmpty: { path: RUN_PAGE, prepare: asLabAccount("admin", "own") },
  runError: { path: RUN_PAGE, prepare: asLabAccount("admin", "own", runToModelError) },
  runRunning: { path: RUN_PAGE, prepare: asLabAccount("admin", "own", runInProgress) },
  runsAdmin: { path: "/admin/ai-runs", prepare: asLabAccount("admin", "seeded") },
  runsEmpty: { path: "/admin/ai-runs", prepare: asLabAccount("admin", "own") },
  // The seeded log's third run is a model error; open its detail.
  runsError: {
    path: "/admin/ai-runs",
    prepare: asLabAccount("admin", "seeded", async (page) => {
      await page.locator("table.admin-runs tbody tr:nth-child(3) a").click();
      await expect(page.locator("table.admin-runs tbody tr:nth-child(3)")).toHaveClass(
        /admin-row-sel/,
      );
      await expect(page.locator(".admin-runs-detail .admin-errbox")).toBeVisible();
    }),
  },
  // Last: it signs the browser in again as a writer.
  runWriter: { path: RUN_PAGE, prepare: asLabAccount("writer", "own") },
};

const P_ANSWER = ".grid2 > .panel:nth-child(2)";
const P_FORM = ".grid2 > .panel:nth-child(1)";

const COMPONENTS: Component[] = [
  // The Run panel as an admin, with an answer (drawing AIR-3).
  {
    name: "run: breadcrumb",
    prototype: { page: "runAdmin", selector: ".crumb" },
    live: { page: "runAdmin", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "run: breadcrumb link",
    prototype: { page: "runAdmin", selector: ".crumb a" },
    live: { page: "runAdmin", selector: ".admin-crumb a" },
  },
  {
    name: "run: header row",
    prototype: { page: "runAdmin", selector: ".head" },
    live: { page: "runAdmin", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "run: page title",
    prototype: { page: "runAdmin", selector: ".head h1" },
    live: { page: "runAdmin", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "run: lede",
    prototype: { page: "runAdmin", selector: ".head .lede" },
    live: { page: "runAdmin", selector: ".admin-head .admin-lede" },
  },
  {
    name: "run: role pill (admin)",
    prototype: { page: "runAdmin", selector: ".head .btns .pill.s-read" },
    live: { page: "runAdmin", selector: ".admin-head .admin-pill-role-admin" },
    box: ["height"],
  },
  {
    name: "run: two panels",
    prototype: { page: "runAdmin", selector: ".grid2" },
    live: { page: "runAdmin", selector: ".admin-run" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "run: settings panel",
    prototype: { page: "runAdmin", selector: P_FORM },
    live: { page: "runAdmin", selector: ".admin-run > .admin-panel:nth-child(1)" },
    box: ["x", "width"],
  },
  {
    name: "run: panel title",
    prototype: { page: "runAdmin", selector: `${P_FORM} > h2` },
    live: { page: "runAdmin", selector: ".admin-run > .admin-panel:nth-child(1) > h2" },
  },
  {
    name: "run: form",
    prototype: { page: "runAdmin", selector: ".form" },
    live: { page: "runAdmin", selector: ".admin-run form.admin-form" },
    properties: [...STYLE, "display", "row-gap"],
    box: ["width"],
  },
  {
    name: "run: field label",
    prototype: { page: "runAdmin", selector: ".form label:has(select)" },
    live: { page: "runAdmin", selector: ".admin-run form label:has(select)" },
  },
  {
    name: "run: version buttons",
    prototype: { page: "runAdmin", selector: ".form .seg" },
    live: { page: "runAdmin", selector: ".admin-run .admin-seg" },
  },
  {
    name: "run: version button, chosen",
    prototype: { page: "runAdmin", selector: '.seg button[aria-pressed="true"]' },
    live: { page: "runAdmin", selector: '.admin-run .admin-seg [aria-pressed="true"]' },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run: version button",
    prototype: { page: "runAdmin", selector: '.seg button[aria-pressed="false"]' },
    live: {
      page: "runAdmin",
      selector: '.admin-run .admin-seg [aria-pressed="false"]:not(:disabled)',
    },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run: pasted text box",
    prototype: { page: "runAdmin", selector: ".form textarea" },
    live: { page: "runAdmin", selector: ".admin-run textarea" },
    box: ["height"],
  },
  {
    name: "run: sample select",
    prototype: { page: "runAdmin", selector: ".form label:has(select) select" },
    live: { page: "runAdmin", selector: ".admin-run form label:has(select) select" },
    box: ["height"],
  },
  {
    name: "run: Run button",
    prototype: { page: "runAdmin", selector: ".form button.primary" },
    live: { page: "runAdmin", selector: ".admin-run button.button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run: today's spend line",
    prototype: { page: "runAdmin", selector: ".form > p.note" },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-spend" },
  },
  {
    name: "run: answer panel",
    prototype: { page: "runAdmin", selector: P_ANSWER },
    live: { page: "runAdmin", selector: ".admin-run > .admin-panel:nth-child(2)" },
    box: ["x", "width"],
  },
  {
    name: "run: stub marker line",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} > p:first-of-type` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-model" },
  },
  {
    name: "run: stub marker",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} .pill.s-checked` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-model .admin-pill-mark" },
    box: ["height"],
  },
  {
    name: "run: stub marker note",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} > p:first-of-type .note` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-model .admin-note" },
  },
  {
    name: "run: answer text",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} pre.code` },
    live: { page: "runAdmin", selector: ".admin-run pre.admin-code" },
    box: ["width"],
  },
  {
    name: "run: checks table",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} table` },
    live: { page: "runAdmin", selector: ".admin-run table.admin-run-checks" },
    properties: [...STYLE, "border-collapse"],
    box: ["width"],
  },
  {
    name: "run: checks head cell",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} table th` },
    live: { page: "runAdmin", selector: ".admin-run table.admin-run-checks th" },
  },
  {
    name: "run: checks cell",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} table td` },
    live: { page: "runAdmin", selector: ".admin-run table.admin-run-checks td" },
  },
  {
    name: "run: answer fields",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} dl.fields` },
    live: { page: "runAdmin", selector: ".admin-run dl.admin-run-fields" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "run: answer field label",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} dl.fields dt` },
    live: { page: "runAdmin", selector: ".admin-run dl.admin-run-fields dt" },
  },
  {
    name: "run: answer field value",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} dl.fields dd` },
    live: { page: "runAdmin", selector: ".admin-run dl.admin-run-fields dd" },
  },
  {
    name: "run: example buttons row",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} .btns` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-buttons" },
  },
  {
    name: "run: Set as candidate example",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} .btns button:first-child` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-buttons button:first-child" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run: Confirm",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} .btns button:last-child` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-buttons button:last-child" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run: note under the buttons",
    prototype: { page: "runAdmin", selector: `${P_ANSWER} .src` },
    live: { page: "runAdmin", selector: ".admin-run .admin-run-buttons + .admin-src" },
  },
  {
    name: "run: note under the page",
    prototype: { page: "runAdmin", selector: "main > p.note:last-child" },
    live: { page: "runAdmin", selector: ".admin-main > p.admin-run-after" },
  },
  // No run yet, a model error with Retry, and a run in progress.
  {
    name: "run, empty: No runs yet",
    prototype: { page: "runEmpty", selector: `${P_ANSWER} .empty` },
    live: { page: "runEmpty", selector: ".admin-run .admin-empty" },
  },
  {
    name: "run, error: error box",
    prototype: { page: "runError", selector: `${P_ANSWER} .errbox` },
    live: { page: "runError", selector: ".admin-run .admin-errbox" },
    box: ["x", "width"],
  },
  {
    name: "run, error: Retry",
    prototype: { page: "runError", selector: `${P_ANSWER} .errbox button.small` },
    live: { page: "runError", selector: ".admin-run .admin-errbox .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run, running: Run in progress",
    prototype: { page: "runRunning", selector: `${P_ANSWER} .pill.s-gen` },
    live: { page: "runRunning", selector: ".admin-run .admin-pill-running" },
    box: ["height"],
  },
  {
    name: "run, running: progress line",
    prototype: { page: "runRunning", selector: `${P_ANSWER} [role="status"] > p` },
    live: { page: "runRunning", selector: ".admin-run .admin-run-progress" },
  },
  {
    name: "run, running: bar",
    prototype: { page: "runRunning", selector: `${P_ANSWER} .bar` },
    live: { page: "runRunning", selector: ".admin-run .admin-run-bar" },
    box: ["height", "width"],
  },
  {
    name: "run, running: bar fill",
    prototype: { page: "runRunning", selector: `${P_ANSWER} .bar i` },
    live: { page: "runRunning", selector: ".admin-run .admin-run-bar > i" },
    box: ["height", "width"],
  },
  {
    name: "run, running: Run button while running",
    prototype: { page: "runRunning", selector: ".form button.primary" },
    live: { page: "runRunning", selector: ".admin-run button.button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "run, writer: role pill",
    prototype: { page: "runWriter", selector: ".head .btns .pill.s-draft" },
    live: { page: "runWriter", selector: ".admin-head .admin-pill-role-writer" },
    box: ["height"],
  },

  // Runs as an admin (drawing AIR-5).
  {
    name: "runs: menu row, current",
    prototype: { page: "runsAdmin", selector: ".rail a.on" },
    live: { page: "runsAdmin", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "runs: header row",
    prototype: { page: "runsAdmin", selector: ".head" },
    live: { page: "runsAdmin", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "runs: page title",
    prototype: { page: "runsAdmin", selector: ".head h1" },
    live: { page: "runsAdmin", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "runs: lede",
    prototype: { page: "runsAdmin", selector: ".head .lede" },
    live: { page: "runsAdmin", selector: ".admin-head .admin-lede" },
  },
  {
    name: "runs: path in the lede",
    prototype: { page: "runsAdmin", selector: ".head .lede .key" },
    live: { page: "runsAdmin", selector: ".admin-head .admin-lede .admin-chip" },
  },
  {
    name: "runs: tiles",
    prototype: { page: "runsAdmin", selector: ".tiles" },
    live: { page: "runsAdmin", selector: ".admin-tiles" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "runs: tile",
    prototype: { page: "runsAdmin", selector: ".tile" },
    live: { page: "runsAdmin", selector: ".admin-tile" },
    box: ["width", "height"],
  },
  {
    name: "runs: tile number",
    prototype: { page: "runsAdmin", selector: ".tile b" },
    live: { page: "runsAdmin", selector: ".admin-tile-number" },
  },
  {
    name: "runs: tile label",
    prototype: { page: "runsAdmin", selector: ".tile span" },
    live: { page: "runsAdmin", selector: ".admin-tile-label" },
  },
  {
    name: "runs: two panels",
    prototype: { page: "runsAdmin", selector: "main > .grid2" },
    live: { page: "runsAdmin", selector: ".admin-runs-top" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["x", "width"],
  },
  {
    name: "runs: panel title",
    prototype: { page: "runsAdmin", selector: "main > .grid2 > .panel > h2" },
    live: { page: "runsAdmin", selector: ".admin-runs-top > .admin-panel > h2" },
  },
  {
    name: "runs: by user table",
    prototype: { page: "runsAdmin", selector: "main > .grid2 > .panel:first-child table" },
    live: { page: "runsAdmin", selector: ".admin-runs-top > .admin-panel:first-child table" },
    properties: [...STYLE, "border-collapse"],
    box: ["width"],
  },
  {
    name: "runs: by user number head",
    prototype: { page: "runsAdmin", selector: "main > .grid2 table th.num" },
    live: { page: "runsAdmin", selector: ".admin-runs-top table th.admin-num" },
  },
  {
    name: "runs: by user number",
    prototype: { page: "runsAdmin", selector: "main > .grid2 table td.num" },
    live: { page: "runsAdmin", selector: ".admin-runs-top table td.admin-num" },
  },
  {
    name: "runs: filter row",
    prototype: { page: "runsAdmin", selector: ".filters" },
    live: { page: "runsAdmin", selector: ".admin-runs-filters" },
  },
  {
    name: "runs: filter label",
    prototype: { page: "runsAdmin", selector: ".filters label:first-child" },
    live: { page: "runsAdmin", selector: ".admin-runs-filters label:first-child" },
  },
  {
    name: "runs: filter select",
    prototype: { page: "runsAdmin", selector: ".filters select" },
    live: { page: "runsAdmin", selector: ".admin-runs-filters select" },
    box: ["height"],
  },
  {
    name: "runs: Stub runs only",
    prototype: { page: "runsAdmin", selector: ".filters .check" },
    live: { page: "runsAdmin", selector: ".admin-runs-filters .admin-check" },
  },
  {
    name: "runs: Stub runs only box",
    prototype: { page: "runsAdmin", selector: ".filters .check input" },
    live: { page: "runsAdmin", selector: ".admin-runs-filters .admin-check input" },
    box: ["width", "height"],
  },
  {
    name: "runs: log panel",
    prototype: { page: "runsAdmin", selector: ".panel.scroll" },
    live: { page: "runsAdmin", selector: ".admin-panel-scroll" },
    box: ["x", "width"],
  },
  {
    name: "runs: log head cell",
    prototype: { page: "runsAdmin", selector: ".panel.scroll th:nth-child(2)" },
    live: { page: "runsAdmin", selector: "table.admin-runs th:nth-child(2)" },
  },
  {
    name: "runs: log number head",
    prototype: { page: "runsAdmin", selector: ".panel.scroll th.num" },
    live: { page: "runsAdmin", selector: "table.admin-runs th.admin-num" },
  },
  {
    name: "runs: row (clickable)",
    prototype: { page: "runsAdmin", selector: ".panel.scroll tbody tr:nth-child(2)" },
    live: { page: "runsAdmin", selector: "table.admin-runs tbody tr:nth-child(2)" },
    properties: [...STYLE, "cursor"],
  },
  {
    name: "runs: when cell",
    prototype: {
      page: "runsAdmin",
      selector: ".panel.scroll tbody tr:nth-child(2) td:nth-child(1)",
    },
    live: { page: "runsAdmin", selector: "table.admin-runs tbody tr:nth-child(2) td:nth-child(1)" },
  },
  {
    name: "runs: who cell",
    prototype: {
      page: "runsAdmin",
      selector: ".panel.scroll tbody tr:nth-child(2) td:nth-child(2)",
    },
    live: { page: "runsAdmin", selector: "table.admin-runs tbody tr:nth-child(2) td:nth-child(2)" },
  },
  {
    name: "runs: feature id",
    prototype: { page: "runsAdmin", selector: ".panel.scroll tbody tr:nth-child(2) .key" },
    live: { page: "runsAdmin", selector: "table.admin-runs tbody tr:nth-child(2) .admin-chip" },
  },
  {
    name: "runs: number cell",
    prototype: { page: "runsAdmin", selector: ".panel.scroll tbody tr:nth-child(2) td.num" },
    live: { page: "runsAdmin", selector: "table.admin-runs tbody tr:nth-child(2) td.admin-num" },
  },
  {
    name: "runs: chosen row cell",
    prototype: { page: "runsAdmin", selector: ".panel.scroll tr.sel td:nth-child(2)" },
    live: { page: "runsAdmin", selector: "table.admin-runs tr.admin-row-sel td:nth-child(2)" },
  },
  {
    name: "runs: Stub pill",
    prototype: {
      page: "runsAdmin",
      selector: ".panel.scroll tbody tr:nth-child(2) .pill.s-checked",
    },
    live: {
      page: "runsAdmin",
      selector: "table.admin-runs tbody tr:nth-child(2) .admin-pill-mark",
    },
    box: ["height"],
  },
  {
    name: "runs: Answered pill",
    prototype: { page: "runsAdmin", selector: ".panel.scroll tbody tr:nth-child(2) .pill.s-pub" },
    live: {
      page: "runsAdmin",
      selector: "table.admin-runs tbody tr:nth-child(2) .admin-pill-published",
    },
    box: ["height"],
  },
  {
    name: "runs: detail panel",
    prototype: { page: "runsAdmin", selector: ".panel:has(dl.fields)" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail" },
    box: ["x", "width"],
  },
  {
    name: "runs: detail title",
    prototype: { page: "runsAdmin", selector: ".panel:has(dl.fields) > h2" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail > h2" },
  },
  {
    name: "runs: detail stub marker",
    prototype: { page: "runsAdmin", selector: ".panel:has(dl.fields) > h2 .pill.s-checked" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail > h2 .admin-pill-mark" },
    box: ["height"],
  },
  {
    name: "runs: detail fields",
    prototype: { page: "runsAdmin", selector: ".panel:has(dl.fields) dl.fields" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail dl.admin-fields" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "runs: detail field label",
    prototype: { page: "runsAdmin", selector: "dl.fields dt" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail dl.admin-fields dt" },
  },
  {
    name: "runs: detail field value",
    prototype: { page: "runsAdmin", selector: "dl.fields dd" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail dl.admin-fields dd" },
  },
  {
    name: "runs: Input label",
    prototype: { page: "runsAdmin", selector: ".panel:has(dl.fields) .grid2 p.note" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail .admin-grid2 p.admin-note" },
  },
  {
    name: "runs: input text",
    prototype: { page: "runsAdmin", selector: ".panel:has(dl.fields) pre.code" },
    live: { page: "runsAdmin", selector: ".admin-runs-detail pre.admin-code" },
  },
  {
    name: "runs: note under the page",
    prototype: { page: "runsAdmin", selector: "main > p.note:last-child" },
    live: { page: "runsAdmin", selector: ".admin-main > p.admin-runs-after" },
  },
  // An empty log, and a run that ended in a model error.
  {
    name: "runs, empty: No runs yet",
    prototype: { page: "runsEmpty", selector: "main > .grid2 .empty" },
    live: { page: "runsEmpty", selector: ".admin-runs-top .admin-empty" },
  },
  {
    name: "runs, error: Model error pill",
    prototype: { page: "runsError", selector: ".panel.scroll .pill.s-fail" },
    live: { page: "runsError", selector: "table.admin-runs .admin-row-sel .admin-pill-failed" },
    box: ["height"],
  },
  {
    name: "runs, error: error box",
    prototype: { page: "runsError", selector: ".panel:has(dl.fields) .errbox" },
    live: { page: "runsError", selector: ".admin-runs-detail .admin-errbox" },
  },
  {
    name: "runs, error: Retry",
    prototype: { page: "runsError", selector: ".panel:has(dl.fields) .errbox button.small" },
    live: { page: "runsError", selector: ".admin-runs-detail .admin-errbox .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  ...[
    "run: breadcrumb link",
    "run: version button, chosen",
    "run: version button",
    "run: sample select",
    "run: Set as candidate example",
    "run: Confirm",
    "run, error: Retry",
    "runs: filter select",
    "runs: Stub runs only box",
    "runs, error: Retry",
  ].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the drawing has none (auto). Neither draws a minimum: the control's " +
      "height is compared as `box height` (as `registry, error: Retry` of #474).",
  })),
  {
    component: "run: breadcrumb link",
    properties: ["align-items"],
    reason:
      "From the app's base link style; it does nothing on a link with no flex children. Font, " +
      "colour of the breadcrumb and underline are compared (as `feature: breadcrumb link` of #474).",
  },
  {
    component: "runs: Stub runs only box",
    properties: ["font-family", "line-height", "color"],
    reason:
      "A checkbox draws no text: the drawing's box keeps the browser's form font (Arial, black) " +
      "and live's the admin font and ink, neither of which shows. Its size, margins and accent " +
      "colour are compared.",
  },
  ...["runs: who cell", "runs: chosen row cell"].map((component) => ({
    component,
    properties: ["min-width"],
    reason:
      "Live gives the Who column 170 px (--adm-runs-who-column): a real account is a long email, " +
      "which breaks anywhere, and without a minimum the 1024 px log squeezed it to three letters " +
      "a line. The drawing's sample names are short. Font, colour, padding and borders are " +
      "compared; the log scrolls inside its panel as the drawing's .panel.scroll.",
  })),
  {
    component: "runs: tile",
    properties: ["box height"],
    reason:
      "The spend tile's label also says how many runs of today have no cost ('· 2 without a " +
      "cost', data), which wraps to a second line at 1024 px and the row of tiles grows with it. " +
      "The drawing has no run without a cost. The tile's width, padding, border and type are " +
      "compared.",
  },
  {
    component: "Cancel, a second model, runs running state (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The drawing's Cancel under a run in progress is not built: the server keeps running a " +
      "call once it is sent and records it, so a Cancel in the browser would only hide it (no " +
      "dead buttons; owner decision in the pull request). The Model select offers only the " +
      "configured model (MODEL_NAME), not the drawing's second sample model. The Runs page's " +
      "running row uses the Run panel's 'Run in progress' pill and bar, compared above.",
  },
];

gateTests(
  { prototypePages: PROTOTYPE, livePages: LIVE, components: COMPONENTS, exceptions: EXCEPTIONS },
  (width) => `test_477_run_panel_and_runs_match_the_prototype_at_${width}_px`,
);

// #477: prototype vs live pictures of the Run panel with an answer and of Runs, full page, written
// as ai-run-panel-<width>-... and ai-runs-<width>-{prototype,live,side-by-side}.png. Invented
// data and the stub model only.
test("test_477_run_panel_and_runs_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(300_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  const pictures: Picture[] = [
    {
      name: "ai-run-panel",
      prototype: PROTOTYPE.runAdmin,
      live: LIVE.runAdmin,
      fullPage: true,
      alignTop: true,
    },
    {
      name: "ai-runs",
      prototype: PROTOTYPE.runsAdmin,
      live: LIVE.runsAdmin,
      fullPage: true,
      alignTop: true,
    },
  ];
  await writePictures(page, origin, pictures);
});
