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

// #479: AIR-6 Samples, live at /admin/ai-samples, against the drawing's #reg-samples
// (docs/design/prototype/admin-ai-features.html) as an admin, as a writer, with an empty library
// and with a read that failed, at 1024 and 1280 px. Part of the admin visual gate
// (e2e/support/admin-visual.ts, #483). The live library is the Supabase stand-in's invented one
// (e2e/support/stub-ai-samples.mjs); text and seed data are never compared, only the fixed
// components.

test.use(ADMIN_VISUAL_USE);
skipGateOutsideCi();

/** Signs the page in again as an account of `role`, runs `setup` with its token, then reloads. */
function asSamplesAccount(
  role: "admin" | "writer",
  setup?: (token: string, page: Page) => Promise<void>,
): PageSetup {
  return async (page) => {
    const account = await signIn(page.context(), new URL(page.url()).origin, undefined, {
      contentRole: role,
    });
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

async function post(pathname: string, body: unknown) {
  const answer = await fetch(`${STUB_SUPABASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(answer.status).toBe(200);
}

const PROTOTYPE: Gate["prototypePages"] = {
  samplesAdmin: { hash: "reg-samples/admin", file: "aiFeatures" },
  samplesWriter: { hash: "reg-samples/writer", file: "aiFeatures" },
  samplesEmpty: { hash: "reg-samples/empty", file: "aiFeatures" },
  samplesError: { hash: "reg-samples/error", file: "aiFeatures" },
};

const LIVE: Gate["livePages"] = {
  samplesAdmin: { path: "/admin/ai-samples" },
  samplesEmpty: {
    path: "/admin/ai-samples",
    prepare: asSamplesAccount("admin", (token) =>
      post("/__ai_samples", { token, library: "empty" }),
    ),
  },
  samplesError: {
    path: "/admin/ai-samples",
    prepare: asSamplesAccount("admin", (token) =>
      post("/__fail_reads", { token, tables: ["ai_samples"] }),
    ),
  },
  // Last: it signs the browser in again as a writer.
  samplesWriter: { path: "/admin/ai-samples", prepare: asSamplesAccount("writer") },
};

const COMPONENTS: Component[] = [
  // The library as an admin (drawing AIR-6).
  {
    name: "samples: menu row, current",
    prototype: { page: "samplesAdmin", selector: ".rail a.on" },
    live: { page: "samplesAdmin", selector: ".admin-menu-link[aria-current]" },
    box: ["width", "height"],
  },
  {
    name: "samples: breadcrumb",
    prototype: { page: "samplesAdmin", selector: ".crumb" },
    live: { page: "samplesAdmin", selector: ".admin-crumb" },
    box: ["height"],
  },
  {
    name: "samples: header row",
    prototype: { page: "samplesAdmin", selector: ".head" },
    live: { page: "samplesAdmin", selector: ".admin-head" },
    box: ["x", "y", "width"],
  },
  {
    name: "samples: page title",
    prototype: { page: "samplesAdmin", selector: ".head h1" },
    live: { page: "samplesAdmin", selector: ".admin-head h1" },
    box: ["height"],
  },
  {
    name: "samples: lede",
    prototype: { page: "samplesAdmin", selector: ".head .lede" },
    live: { page: "samplesAdmin", selector: ".admin-head .admin-lede" },
  },
  {
    name: "samples: {{variables}} in the lede",
    prototype: { page: "samplesAdmin", selector: ".head .lede .var" },
    live: { page: "samplesAdmin", selector: ".admin-head .admin-lede .admin-var" },
  },
  {
    name: "samples: Admin and writer only",
    prototype: { page: "samplesAdmin", selector: ".head .lede .lock" },
    live: { page: "samplesAdmin", selector: ".admin-head .admin-lede .admin-lock" },
  },
  {
    name: "samples: header action row",
    prototype: { page: "samplesAdmin", selector: ".head .btns" },
    live: { page: "samplesAdmin", selector: ".admin-head .admin-actions" },
  },
  {
    name: "samples: role pill (admin)",
    prototype: { page: "samplesAdmin", selector: ".head .btns .pill.s-read" },
    live: { page: "samplesAdmin", selector: ".admin-head .admin-pill-role-admin" },
    box: ["height"],
  },
  {
    name: "samples: list panel",
    prototype: { page: "samplesAdmin", selector: ".panel:has(table)" },
    live: { page: "samplesAdmin", selector: ".admin-panel:has(table.admin-samples)" },
    box: ["x", "width"],
  },
  {
    name: "samples: table",
    prototype: { page: "samplesAdmin", selector: ".panel table" },
    live: { page: "samplesAdmin", selector: "table.admin-samples" },
    properties: [...STYLE, "border-collapse", "table-layout"],
    box: ["width"],
  },
  {
    name: "samples: head cell",
    prototype: { page: "samplesAdmin", selector: ".panel table th:nth-child(2)" },
    live: { page: "samplesAdmin", selector: "table.admin-samples th:nth-child(2)" },
    box: ["height"],
  },
  {
    name: "samples: row (clickable)",
    prototype: { page: "samplesAdmin", selector: ".panel table tbody tr:nth-child(2)" },
    live: { page: "samplesAdmin", selector: "table.admin-samples tbody tr:nth-child(2)" },
    properties: [...STYLE, "cursor"],
  },
  {
    name: "samples: name cell",
    prototype: {
      page: "samplesAdmin",
      selector: ".panel table tbody tr:nth-child(2) td:nth-child(1)",
    },
    live: {
      page: "samplesAdmin",
      selector: "table.admin-samples tbody tr:nth-child(2) td:nth-child(1)",
    },
  },
  {
    name: "samples: name",
    prototype: {
      page: "samplesAdmin",
      selector: ".panel table tbody tr:nth-child(2) td:nth-child(1) b",
    },
    live: {
      page: "samplesAdmin",
      selector: "table.admin-samples tbody tr:nth-child(2) td:nth-child(1) a",
    },
  },
  {
    name: "samples: chosen row cell",
    prototype: { page: "samplesAdmin", selector: ".panel table tr.sel td:nth-child(2)" },
    live: {
      page: "samplesAdmin",
      selector: "table.admin-samples tr.admin-row-sel td:nth-child(2)",
    },
  },
  {
    name: "samples: Not written yet in a cell",
    prototype: {
      page: "samplesAdmin",
      selector: ".panel table tbody tr:nth-child(3) td:nth-child(2) .note",
    },
    live: {
      page: "samplesAdmin",
      selector: "table.admin-samples tbody tr:nth-child(3) td:nth-child(2) .admin-note",
    },
  },
  {
    name: "samples: words cell",
    prototype: { page: "samplesAdmin", selector: ".panel table tbody tr:nth-child(2) td.note" },
    live: {
      page: "samplesAdmin",
      selector: "table.admin-samples tbody tr:nth-child(2) td.admin-cell-note",
    },
  },
  {
    name: "samples: detail panel",
    prototype: { page: "samplesAdmin", selector: ".panel:has(dl.fields)" },
    live: { page: "samplesAdmin", selector: ".admin-samples-detail" },
    box: ["x", "width"],
  },
  {
    name: "samples: detail title",
    prototype: { page: "samplesAdmin", selector: ".panel:has(dl.fields) > h2" },
    live: { page: "samplesAdmin", selector: ".admin-samples-detail > h2" },
  },
  {
    name: "samples: field list",
    prototype: { page: "samplesAdmin", selector: "dl.fields" },
    live: { page: "samplesAdmin", selector: ".admin-samples-detail dl.admin-fields" },
    properties: [...STYLE, "display", "grid-template-columns"],
    box: ["width"],
  },
  {
    name: "samples: field label",
    prototype: { page: "samplesAdmin", selector: "dl.fields dt" },
    live: { page: "samplesAdmin", selector: ".admin-samples-detail dl.admin-fields dt" },
  },
  {
    name: "samples: field value",
    prototype: { page: "samplesAdmin", selector: "dl.fields dd" },
    live: { page: "samplesAdmin", selector: ".admin-samples-detail dl.admin-fields dd" },
  },
  {
    name: "samples: source named",
    prototype: { page: "samplesAdmin", selector: "dl.fields .src" },
    live: { page: "samplesAdmin", selector: ".admin-samples-detail .admin-src" },
  },
  {
    name: "samples: note under the page",
    prototype: { page: "samplesAdmin", selector: "main > p.note:last-child" },
    live: { page: "samplesAdmin", selector: ".admin-main > p.admin-samples-after" },
  },
  // An empty library and a failed read.
  {
    name: "samples, empty: No samples yet",
    prototype: { page: "samplesEmpty", selector: ".panel .empty" },
    live: { page: "samplesEmpty", selector: ".admin-panel .admin-empty" },
  },
  {
    name: "samples, error: error box",
    prototype: { page: "samplesError", selector: ".errbox" },
    live: { page: "samplesError", selector: ".admin-errbox" },
    box: ["x", "width"],
  },
  {
    name: "samples, error: Retry",
    prototype: { page: "samplesError", selector: ".errbox button.small" },
    live: { page: "samplesError", selector: ".admin-errbox .button-small" },
    properties: [...STYLE, "cursor"],
    box: ["height"],
  },
  // As a writer.
  {
    name: "samples, writer: role pill",
    prototype: { page: "samplesWriter", selector: ".head .btns .pill.s-draft" },
    live: { page: "samplesWriter", selector: ".admin-head .admin-pill-role-writer" },
    box: ["height"],
  },
];

const EXCEPTIONS: Gate["exceptions"] = [
  {
    component: "samples, error: Retry",
    properties: ["min-width", "min-height"],
    reason:
      "Live sets 0 to switch off the phone app's 44 px tap minimum inside the admin " +
      "(ADMIN-DESKTOP); the drawing has none (auto). Neither draws a minimum: the control's " +
      "height is compared as `box height` (as `registry, error: Retry` of #474).",
  },
  {
    component: "samples, error: error box",
    properties: ["margin-bottom"],
    reason:
      "The drawing puts an empty 12 px div under its error box; live gives the box a 12 px " +
      "bottom margin (--adm-errbox-after) instead, as `registry, error: error box` of #474.",
  },
  ...["samples: role pill (admin)", "samples, writer: role pill"].map((component) => ({
    component,
    properties: ["box height"],
    reason:
      "The drawing's action row also holds the 'Add a finished story as a sample' button, which " +
      "is taller, and the row stretches the pill to its height. Live has no such button (see " +
      "below), so the pill keeps its own height, as the registry's role pill (#474) does in a " +
      "row without a button. Font, colours and padding are compared.",
  })),
  {
    component:
      "Add a finished story as a sample, Sample text pills, running state (not in COMPONENTS)",
    properties: ["(whole component)"],
    reason:
      "No finished story with its source excerpt and persona exists in the data model to pick " +
      "from, so the button is not built (no dead buttons; owner decision in the pull request), " +
      "and neither is its running state. The 'Sample text' pills mark the drawing's placeholder " +
      "text; live shows the stored text. The loading lines show only while the server reads.",
  },
];

gateTests(
  { prototypePages: PROTOTYPE, livePages: LIVE, components: COMPONENTS, exceptions: EXCEPTIONS },
  (width) => `test_479_samples_match_the_prototype_at_${width}_px`,
);

// #479: prototype vs live pictures of the library as an admin, full page, written as
// ai-samples-<width>-{prototype,live,side-by-side}.png. Invented data only.
test("test_479_samples_pictures_prototype_vs_live", async ({ page, context }) => {
  picturesOnRequest(240_000);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const origin = await startPrototypeServing(page);
  const pictures: Picture[] = [
    {
      name: "ai-samples",
      prototype: PROTOTYPE.samplesAdmin,
      live: LIVE.samplesAdmin,
      fullPage: true,
      alignTop: true,
    },
  ];
  await writePictures(page, origin, pictures);
});
