import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #477 (FR-AILAB-3; AI-RUN-PERMISSION, AI-LAB-STUB): AIR-5 Runs, /admin/ai-runs (drawing
// #reg-runs). Each test's account reads its own run log (POST /__ai_runs, e2e/support/
// stub-ai-runs.mjs): "seeded" holds four invented runs of today (an answer with steps by an
// invented writer, an answer, a model error and a run whose end was never recorded). The page
// calls no model.

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

async function post(pathname: string, body: unknown) {
  const answer = await fetch(`${STUB_SUPABASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(answer.status).toBe(200);
}

async function runsAccount(
  page: Page,
  context: BrowserContext,
  role: "admin" | "writer",
  log: "seeded" | "own",
) {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: role });
  await post("/__ai_runs", { token: account.token, log });
  return { ...account, email: `${account.userId}@example.invalid` };
}

const table = (page: Page) => page.getByRole("table", { name: "Runs" });
const rows = (page: Page) => table(page).locator("tbody tr");
const detail = (page: Page) => page.getByRole("region", { name: /Run detail/ });

test("test_477_ac2_every_run_with_who_when_feature_version_sample_model_tokens_cost_stub", async ({
  page,
  context,
}) => {
  const admin = await runsAccount(page, context, "admin", "seeded");
  await page.goto("/admin/ai-runs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Runs");
  await expect(page.locator(".admin-head .admin-pill-role-admin")).toBeVisible();
  const menu = page.getByRole("navigation", { name: "Admin pages" });
  await expect(menu.getByRole("link", { name: /Runs/ })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: /Runs/ })).toContainText("AIR-5");

  await expect(rows(page)).toHaveCount(4);
  const first = rows(page).nth(0);
  await expect(first).toContainText(admin.email);
  await expect(first).toContainText("R-03");
  await expect(first).toContainText("Draft v2");
  await expect(first).toContainText("Lamp maker, first evening (invented)");
  await expect(first).toContainText("stub");
  await expect(first).toContainText("150");
  await expect(first).toContainText("$0.000180");
  await expect(first.locator(".admin-pill-mark")).toHaveText("Stub");
  await expect(first).toContainText("Answered");
  await expect(rows(page).nth(1)).toContainText("invented-writer@example.invalid");
  await expect(rows(page).nth(2)).toContainText("Pasted text");
  await expect(rows(page).nth(2)).toContainText("No sample");
  await expect(rows(page).nth(2)).toContainText("Model error");
  // Started 30 minutes ago and never ended: shown, never hidden.
  await expect(rows(page).nth(3)).toContainText("End not recorded");
  // The newest run is chosen; its detail shows its input and output.
  await expect(first).toHaveClass(/admin-row-sel/);
  await expect(detail(page).locator('pre[aria-label="Input"]')).toContainText(
    "Invented input: the prompt as sent",
  );
  await expect(detail(page).locator('pre[aria-label="Output"]')).toHaveText(
    "Invented output: the stub model's fixed answer.",
  );
  await expect(detail(page).locator(".admin-pill-mark")).toHaveText("Fake model (stub)");
});

test("test_477_ac2_todays_total_spend_and_total_by_user", async ({ page, context }) => {
  const admin = await runsAccount(page, context, "admin", "seeded");
  await page.goto("/admin/ai-runs");
  const tiles = page.locator(".admin-tile");
  await expect(tiles.nth(0)).toContainText("$0.000540");
  await expect(tiles.nth(0)).toContainText("Today's spend · 2 without a cost");
  await expect(tiles.nth(1)).toContainText("4");
  await expect(tiles.nth(1)).toContainText("Runs today");
  await expect(tiles.nth(2)).toContainText("4");
  await expect(tiles.nth(3)).toContainText("0");
  await expect(tiles.nth(3)).toContainText("Real model runs");
  const byUser = page.getByRole("table", { name: "Total by user, today" });
  await expect(page.getByRole("heading", { name: "Total by user, today (UTC)" })).toBeVisible();
  const lines = byUser.locator("tbody tr");
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText("invented-writer@example.invalid");
  await expect(lines.nth(0)).toContainText("$0.000360");
  await expect(lines.nth(1)).toContainText(admin.email);
  await expect(lines.nth(1)).toContainText("3");
  await expect(lines.nth(1)).toContainText("$0.000180 · 2 without a cost");
  await expect(page.locator(".admin-runs-after")).toHaveText(
    "Today's spend is a read-only line, not a cap. Today is the UTC day.",
  );
});

test("test_477_ac2_filter_by_feature_user_model_and_stub", async ({ page, context }) => {
  await runsAccount(page, context, "admin", "seeded");
  await page.goto("/admin/ai-runs");
  const filter = page.getByRole("region", { name: "Filter" });
  await filter.getByRole("combobox", { name: "Feature" }).selectOption("rest_reply");
  await expect(page).toHaveURL(/\?feature=rest_reply$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("invented-writer@example.invalid");

  await filter.getByRole("combobox", { name: "Feature" }).selectOption("");
  await expect(rows(page)).toHaveCount(4);
  await filter
    .getByRole("combobox", { name: "User" })
    .selectOption({ label: "invented-writer@example.invalid" });
  await expect(rows(page)).toHaveCount(1);
  await filter.getByRole("combobox", { name: "User" }).selectOption("");
  await filter.getByRole("combobox", { name: "Model" }).selectOption("stub");
  await expect(rows(page)).toHaveCount(4);
  await filter.getByRole("checkbox", { name: "Stub runs only" }).check();
  await expect(page).toHaveURL(/stub=1/);
  await expect(rows(page)).toHaveCount(4);
  await page.goto("/admin/ai-runs?feature=closing_line");
  await expect(page.getByText("No run matches this filter")).toBeVisible();
});

test("test_477_ac2_detail_of_a_model_error_a_run_not_ended_and_steps", async ({
  page,
  context,
}) => {
  await runsAccount(page, context, "writer", "seeded");
  await page.goto("/admin/ai-runs");
  await expect(page.locator(".admin-head .admin-pill-role-writer")).toBeVisible();

  await rows(page).nth(2).getByRole("link").click();
  await expect(rows(page).nth(2)).toHaveClass(/admin-row-sel/);
  const error = detail(page).getByRole("alert");
  await expect(error).toContainText("The model did not answer.");
  await expect(error).toContainText("No answer within the time limit (120 seconds).");
  await expect(error.getByRole("link", { name: "Retry" })).toHaveAttribute(
    "href",
    "/admin/ai-features/plan_split/run",
  );

  await rows(page).nth(3).getByRole("link").click();
  await expect(detail(page).getByRole("alert")).toContainText(
    "The end of this run was not recorded.",
  );
  await expect(detail(page)).toContainText("not ended");

  await rows(page).nth(1).getByRole("link").click();
  const steps = detail(page).getByRole("table", { name: "Steps" }).locator("tbody tr");
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(0)).toContainText("1. Invented draft");
  await expect(steps.nth(1)).toContainText("2. Invented rewrite");
});

test("test_477_ac2_empty_log_and_a_failed_read", async ({ page, context }) => {
  const admin = await runsAccount(page, context, "admin", "own");
  await page.goto("/admin/ai-runs");
  await expect(page.locator(".admin-panel .admin-empty").first()).toHaveText("No runs yet");
  await expect(page.locator(".admin-tile").nth(1)).toContainText("0");

  await post("/__fail_reads", { token: admin.token, tables: ["ai_runs"] });
  await page.reload();
  const error = page.locator(".admin-errbox[role=alert]");
  await expect(error).toContainText("The run log could not be read.");
  await expect(error.getByRole("link", { name: "Retry" })).toBeVisible();
});

test("test_477_ac2_an_app_user_and_a_visitor_get_no_runs_page", async ({ page, context }) => {
  const response = await page.goto("/admin/ai-runs");
  expect(response?.status()).toBe(404);
  await signIn(context, baseUrlOf(page));
  const user = await page.goto("/admin/ai-runs");
  expect(user?.status()).toBe(404);
});
