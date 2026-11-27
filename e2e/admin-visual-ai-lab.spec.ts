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

// #478: AIR-4 the comparison lab (/admin/ai-lab) against the drawing's #reg-lab
// (docs/design/prototype/admin-ai-features.html), at 1024 and 1280 px. Part of the admin visual
// gate (e2e/support/admin-visual.ts, #483). The lab is opened on the "live" app, whose two models
// are the test stub model (no real model is ever called). Its states: two answers with Blind on
// (as the drawing's default), no run yet, a model error on one side (that side's request answered
// in the browser with the route's model-error answer, so nothing is sent), both sides in progress
// (the requests held in the browser) and a writer. Each state's account reads its own copy of the
// registry rows and writes its own run log. Text and seed data are never compared, only the fixed
// components.

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

const LIVE_APP = `http://127.0.0.1:${e2ePorts.live}`;
// Closing line has one prompt key, so the settings' left column holds Feature and Sample only,
// as the drawing's.
const LAB_PAGE = `${LIVE_APP}/admin/ai-lab?feature=closing_line`;
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

/** Signs the page in again as a new account of `role` with its own registry and run log. */
function asLabAccount(role: "admin" | "writer", then?: (page: Page) => Promise<void>): PageSetup {
  return async (page) => {
    await page.unroute(RUN_ROUTE);
    const account = await signIn(page.context(), new URL(page.url()).origin, undefined, {
      contentRole: role,
    });
    await post("/__ai_features", { token: account.token, registry: true });
    await post("/__ai_runs", { token: account.token, log: "own" });
    await page.reload();
    await settle(page);
    if (then) await then(page);
  };
}

const form = (page: Page) => page.getByRole("region", { name: "Comparison settings" });
async function noSample(page: Page) {
  await expect(form(page).getByRole("button", { name: "Run both" })).toBeEnabled();
  const select = form(page).getByRole("combobox", { name: "Sample (the same for both sides)" });
  await select.selectOption("");
  await expect(select).toHaveValue("");
  await expect(page.locator(".admin-lab-warning")).toHaveCount(0);
}

async function runBoth(page: Page) {
  await noSample(page);
  await form(page).getByRole("button", { name: "Run both" }).click();
  await expect(page.locator(".admin-lab-side pre.admin-code")).toHaveCount(2);
}

async function runWithModelError(page: Page) {
  // The second request of Run both is answered here, in the browser, with the Run route's
  // model-error answer; it never reaches the server. The first runs on the stub model.
  let calls = 0;
  await page.route(RUN_ROUTE, async (route) => {
    calls += 1;
    if (calls === 2) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "model-error",
          reason: "timeout",
          runId: "00000000-0000-4000-8000-000000000478",
          recorded: true,
          stub: true,
          model: "stub",
        }),
      });
      return;
    }
    await route.continue();
  });
  await noSample(page);
  await form(page).getByRole("button", { name: "Run both" }).click();
  await expect(page.locator(".admin-lab-side .admin-errbox")).toBeVisible();
  await expect(page.locator(".admin-lab-side pre.admin-code")).toHaveCount(1);
}

async function runningBoth(page: Page) {
  // Both requests are held in the browser and never reach the server: nothing is run.
  await page.route(RUN_ROUTE, () => new Promise(() => {}));
  await noSample(page);
  await form(page).getByRole("button", { name: "Run both" }).click();
  await expect(page.locator(".admin-lab-side .admin-run-bar")).toHaveCount(2);
}

const PROTOTYPE: Gate["prototypePages"] = {
  labAdmin: { hash: "reg-lab/admin", file: "aiFeatures" },
  labEmpty: { hash: "reg-lab/empty", file: "aiFeatures" },
  labError: { hash: "reg-lab/error", file: "aiFeatures" },
  labRunning: { hash: "reg-lab/running", file: "aiFeatures" },
  labWriter: { hash: "reg-lab/writer", file: "aiFeatures" },
};

const LIVE: Gate["livePages"] = {
  labAdmin: { path: LAB_PAGE, prepare: asLabAccount("admin", runBoth) },
  labEmpty: { path: LAB_PAGE, prepare: asLabAccount("admin") },
  labError: { path: LAB_PAGE, prepare: asLabAccount("admin", runWithModelError) },
  labRunning: { path: LAB_PAGE, prepare: asLabAccount("admin", runningBoth) },
  // Last: it signs the browser in again as a writer.
  labWriter: { path: LAB_PAGE, prepare: asLabAccount("writer") },
};

const P_FORM = ".head + .panel";
const P_SIDE = ".cmp > .panel.side";

const COMPONENTS: Component[] = [
  // The lab as an admin, with two answers and Blind on (drawing AIR-4).
  {
    name: "lab: breadcrumb",
    prototype: { page: "labAdmin", selector: ".crumb" },
    live: { page: "labAdmin", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "lab: header row",
    prototype: { page: "labAdmin", selector: ".head" },
    live: { page: "labAdmin", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "lab: page title",
    prototype: { page: "labAdmin", selector: ".head h1" },
    live: { page: "labAdmin", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "lab: lede",
    prototype: { page: "labAdmin", selector: ".head .lede" },
    live: { page: "labAdmin", selector: ".admin-head .admin-lede" },
  },
  {
    name: "lab: path in the lede",
    prototype: { page: "labAdmin", selector: ".head .lede .key" },
    live: { page: "labAdmin", selector: ".admin-head .admin-lede .admin-chip" },
  },
  {
    name: "lab: role pill (admin)",
    prototype: { page: "labAdmin", selector: ".head .btns .pill.s-read" },
    live: { page: "labAdmin", selector: ".admin-head .admin-pill-role-admin" },
    box: ["height"],
  },
  {
    name: "lab: settings panel",
    prototype: { page: "labAdmin", selector: P_FORM },
    live: { page: "labAdmin", selector: ".admin-lab-form" },
    box: ["x", "width"],
  },
  {
    name: "lab: settings columns",
    prototype: { page: "labAdmin", selector: `${P_FORM} > .grid2` },
    live: { page: "labAdmin", selector: ".admin-lab-form > .admin-grid2" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "lab: form column",
    prototype: { page: "labAdmin", selector: `${P_FORM} .form` },
    live: { page: "labAdmin", selector: ".admin-lab-form .admin-form" },
    properties: [...STYLE, "display", "row-gap"],
    box: ["width"],
  },
  {
    name: "lab: field label",
    prototype: { page: "labAdmin", selector: `${P_FORM} .form label` },
    live: { page: "labAdmin", selector: ".admin-lab-form .admin-form > label" },
  },
  {
    name: "lab: select",
    prototype: { page: "labAdmin", selector: `${P_FORM} .form select` },
    live: { page: "labAdmin", selector: ".admin-lab-form .admin-form select" },
    box: ["height", "width"],
  },
  {
    name: "lab: Blind and Run both row",
    prototype: { page: "labAdmin", selector: `${P_FORM} > .btns` },
    live: { page: "labAdmin", selector: ".admin-lab-actions" },
    properties: [...STYLE, "display", "align-items", "column-gap"],
    box: ["width"],
  },
  {
    name: "lab: Blind label",
    prototype: { page: "labAdmin", selector: `${P_FORM} label.check` },
    live: { page: "labAdmin", selector: ".admin-lab-actions label.admin-check" },
    properties: [...STYLE, "display", "align-items", "column-gap"],
  },
  {
    name: "lab: Blind box",
    prototype: { page: "labAdmin", selector: `${P_FORM} label.check input` },
    live: { page: "labAdmin", selector: ".admin-lab-actions label.admin-check input" },
    properties: ["width", "height", "accent-color"],
    box: ["width", "height"],
  },
  {
    name: "lab: Run both",
    prototype: { page: "labAdmin", selector: `${P_FORM} button.primary` },
    live: { page: "labAdmin", selector: ".admin-lab-actions .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "lab: two answers",
    prototype: { page: "labAdmin", selector: ".cmp" },
    live: { page: "labAdmin", selector: ".admin-lab-cmp" },
    properties: [...STYLE, "display", "grid-template-columns", "column-gap"],
    box: ["x", "width"],
  },
  {
    name: "lab: side panel",
    prototype: { page: "labAdmin", selector: P_SIDE },
    live: { page: "labAdmin", selector: ".admin-lab-side" },
    properties: [...STYLE, "display", "flex-direction", "row-gap"],
    box: ["x", "width"],
  },
  {
    name: "lab: side title",
    prototype: { page: "labAdmin", selector: `${P_SIDE} > h2` },
    live: { page: "labAdmin", selector: ".admin-lab-side > h2" },
  },
  {
    name: "lab: Hidden until answered",
    prototype: { page: "labAdmin", selector: `${P_SIDE} > h2 .pill.s-draft` },
    live: { page: "labAdmin", selector: ".admin-lab-side > h2 .admin-pill-draft" },
    box: ["height"],
  },
  {
    name: "lab: stub marker",
    prototype: { page: "labAdmin", selector: `${P_SIDE} .pill.s-checked` },
    live: { page: "labAdmin", selector: ".admin-lab-side .admin-pill-mark" },
    box: ["height"],
  },
  {
    name: "lab: answer text",
    prototype: { page: "labAdmin", selector: `${P_SIDE} pre.code` },
    live: { page: "labAdmin", selector: ".admin-lab-side pre.admin-code" },
  },
  {
    name: "lab: pass questions note",
    prototype: { page: "labAdmin", selector: `${P_SIDE} p.note` },
    live: { page: "labAdmin", selector: ".admin-lab-side p.admin-lab-questions" },
  },
  {
    name: "lab: pass question row",
    prototype: { page: "labAdmin", selector: `${P_SIDE} .yn` },
    live: { page: "labAdmin", selector: ".admin-lab-side .admin-yn" },
    properties: [...STYLE, "display", "grid-template-columns", "align-items", "column-gap"],
  },
  {
    name: "lab: Yes and No",
    prototype: { page: "labAdmin", selector: `${P_SIDE} .yn .seg` },
    live: { page: "labAdmin", selector: ".admin-lab-side .admin-yn .admin-seg" },
    properties: [...STYLE, "display", "column-gap"],
  },
  {
    name: "lab: Yes button",
    prototype: { page: "labAdmin", selector: `${P_SIDE} .yn .seg button` },
    live: { page: "labAdmin", selector: ".admin-lab-side .admin-yn .admin-seg button" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "lab: Save result row",
    prototype: { page: "labAdmin", selector: ".cmp + .btns" },
    live: { page: "labAdmin", selector: ".admin-lab-save" },
    box: ["width"],
  },
  {
    name: "lab: Save result",
    prototype: { page: "labAdmin", selector: ".cmp + .btns button.primary" },
    live: { page: "labAdmin", selector: ".admin-lab-save .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "lab: note under the page",
    prototype: { page: "labAdmin", selector: "main > p.note:last-child" },
    live: { page: "labAdmin", selector: ".admin-main > p.admin-lab-after" },
  },
  // No run yet, a model error on one side, both sides in progress, and a writer.
  {
    name: "lab, empty: No runs yet",
    prototype: { page: "labEmpty", selector: `${P_FORM} + .empty` },
    live: { page: "labEmpty", selector: ".admin-lab-form + .admin-empty" },
  },
  {
    name: "lab, error: error box",
    prototype: { page: "labError", selector: `${P_SIDE} .errbox` },
    live: { page: "labError", selector: ".admin-lab-side .admin-errbox" },
    box: ["width"],
  },
  {
    name: "lab, error: Retry",
    prototype: { page: "labError", selector: `${P_SIDE} .errbox button.small` },
    live: { page: "labError", selector: ".admin-lab-side .admin-errbox .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "lab, running: Run in progress",
    prototype: { page: "labRunning", selector: `${P_SIDE} .pill.s-gen` },
    live: { page: "labRunning", selector: ".admin-lab-side .admin-pill-running" },
    box: ["height"],
  },
  {
    name: "lab, running: bar",
    prototype: { page: "labRunning", selector: `${P_SIDE} .bar` },
    live: { page: "labRunning", selector: ".admin-lab-side .admin-run-bar" },
    box: ["height", "width"],
  },
  {
    name: "lab, running: Run both while running",
    prototype: { page: "labRunning", selector: `${P_FORM} button.primary` },
    live: { page: "labRunning", selector: ".admin-lab-actions .button-filled" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  {
    name: "lab, writer: role pill",
    prototype: { page: "labWriter", selector: ".head .btns .pill.s-draft" },
    live: { page: "labWriter", selector: ".admin-head .admin-pill-role-writer" },
    box: ["height"],
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  ...[
    "lab: select",
    "lab: Run both",
    "lab: Yes button",
    "lab: Save result",
    "lab, error: Retry",
    "lab, running: Run both while running",
  ].map((component) => ({
    component,
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the drawing has none (auto). Neither draws a minimum: the control's " +
      "height is compared as `box height` (as `run, error: Retry` of #477).",
  })),
  {
    component: "lab: Save result",
    properties: ["cursor"],
    reason:
      "Live keeps Save result disabled (not-allowed) until both sides have an answer and every " +
      "pass question has yes or no, as the drawing's note says ('Save result waits ...'); the " +
      "compared state keeps the questions unanswered so that Blind's 'Hidden until answered' " +
      "shows, while the drawing's button is always enabled. Its font, colours, padding and " +
      "height are compared.",
  },
  {
    component: "Cancel, a pasted text side (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "The drawing's Cancel under a run in progress is not built, as in the Run panel (#477): the " +
      "server keeps a call once it is sent and records it, so a Cancel in the browser would only " +
      "hide it. A side is a prompt version or a model, as the drawing's selects; a pasted text " +
      "is tried in the Run panel. Owner decisions in the pull request.",
  },
];

gateTests(
  { prototypePages: PROTOTYPE, livePages: LIVE, components: COMPONENTS, exceptions: EXCEPTIONS },
  (width) => `test_478_comparison_lab_matches_the_prototype_at_${width}_px`,
);

// #478: prototype vs live pictures of the lab with two answers, full page, written as
// ai-lab-<width>-{prototype,live,side-by-side}.png. Invented data and the stub model only.
test("test_478_comparison_lab_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(300_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  const pictures: Picture[] = [
    {
      name: "ai-lab",
      prototype: PROTOTYPE.labAdmin,
      live: LIVE.labAdmin,
      fullPage: true,
      alignTop: true,
    },
  ];
  await writePictures(page, origin, pictures);
});
