import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #479 (AI-LAB-SAMPLES, AI-SOURCE-EXCERPTS, AI-SAMPLES-LOCAL): AIR-6 Samples, /admin/ai-samples,
// against the Supabase stand-in's invented library (e2e/support/stub-ai-samples.mjs). No book text:
// every sample here is short and invented. The database rules themselves (only admin and writer
// read; nobody writes through the API) are tested on Postgres (PGlite trial in the pull request)
// and in tests/ai-samples.test.ts.

async function stub(pathname: string, token: string | null, body?: unknown, method?: string) {
  return fetch(`${STUB_SUPABASE}${pathname}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const list = (page: Page) => page.locator("table.admin-samples");
const detail = (page: Page) => page.locator("section.admin-samples-detail");

test("test_479_an_admin_sees_the_library_with_the_source_named_and_the_first_sample", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  expect((await page.goto("/admin/ai-samples"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Samples" })).toBeVisible();
  await expect(page.locator(".admin-head .admin-pill-role-admin")).toHaveText("Viewing as admin");
  await expect(page.locator(".admin-head .admin-lock")).toHaveText("Admin and writer only");

  const rows = list(page).locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Lamp maker, first evening (invented)");
  await expect(rows.nth(0)).toContainText("Ada Tester");
  await expect(rows.nth(0)).toContainText("Invented notebook for tests, page 1");
  // Words of the excerpt (16 invented words).
  await expect(rows.nth(0).locator("td").nth(3)).toHaveText("16");
  // A sample with no Companion and no excerpt says so, never filler.
  await expect(rows.nth(2).locator("td").nth(1)).toHaveText("Not written yet");
  await expect(rows.nth(2).locator("td").nth(2)).toHaveText("Not written yet");
  await expect(rows.nth(2).locator("td").nth(3)).toHaveText("No excerpt");
  await expect(rows.nth(0)).toHaveClass(/admin-row-sel/);

  const shown = detail(page);
  await expect(shown.getByRole("heading", { level: 2 })).toHaveText(
    "Lamp maker, first evening (invented)",
  );
  await expect(shown).toContainText("The lamp maker counts the wicks twice before dark");
  await expect(shown.locator(".admin-src")).toHaveText(
    "Source: Invented notebook for tests, page 1",
  );
  await expect(shown).toContainText("Her workshop has one window.");
  await expect(shown).toContainText("Have twelve lamps ready by the fair.");
  await expect(shown).toContainText("Count the wicks");

  // Nothing adds a sample from the page yet (owner decision in the pull request): no dead button.
  await expect(page.getByRole("button", { name: /finished story/i })).toHaveCount(0);

  // The menu row is current.
  await expect(
    page.getByRole("navigation", { name: "Admin pages" }).getByRole("link", { name: /Samples/ }),
  ).toHaveAttribute("aria-current", "page");
});

test("test_479_choosing_a_row_shows_that_samples_inputs", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/ai-samples");
  await list(page).getByRole("link", { name: "Ferry clerk, one crossing (invented)" }).click();
  await expect(page).toHaveURL(/\?sample=invented-ferry-clerk$/);
  const shown = detail(page);
  await expect(shown.getByRole("heading", { level: 2 })).toHaveText(
    "Ferry clerk, one crossing (invented)",
  );
  await expect(shown).toContainText("finds the tenth passenger has none");
  await expect(shown.locator(".admin-src")).toHaveText(
    "Source: Invented ledger for tests, entry 12",
  );
  await expect(shown).toContainText("The river is wide and slow.");
  await expect(list(page).locator("tbody tr").nth(1)).toHaveClass(/admin-row-sel/);

  // A sample with no excerpt and empty fields shows "Not written yet".
  await page.goto("/admin/ai-samples?sample=invented-dialogue");
  await expect(detail(page).locator(".admin-src")).toHaveText("Source: Not written yet");
  await expect(detail(page).locator("dd").first()).toHaveText("Not written yet");

  // An unknown id shows the first sample.
  await page.goto("/admin/ai-samples?sample=no-such-sample");
  await expect(detail(page).getByRole("heading", { level: 2 })).toHaveText(
    "Lamp maker, first evening (invented)",
  );
});

test("test_479_a_writer_reads_the_library", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  expect((await page.goto("/admin/ai-samples"))?.status()).toBe(200);
  await expect(page.locator(".admin-head .admin-pill-role-writer")).toHaveText("Viewing as writer");
  await expect(list(page).locator("tbody tr")).toHaveCount(3);
  await expect(detail(page)).toContainText("The lamp maker counts the wicks");
});

test("test_479_app_users_and_anonymous_read_nothing_and_nobody_writes", async ({
  page,
  context,
  browser,
}) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  // Not even a content editor writes through the API.
  for (const table of ["ai_samples", "ai_source_excerpts"]) {
    const insert = await stub(`/rest/v1/${table}`, writer.token, { id: "invented-x" });
    expect(insert.status, table).toBe(403);
    expect((await insert.json()).code).toBe("42501");
  }

  const plain = await browser.newContext({ baseURL: baseUrlOf(page) });
  const user = await plain.newPage();
  const account = await signIn(plain, baseUrlOf(page));
  expect((await user.goto("/admin/ai-samples"))?.status()).toBe(404);
  for (const table of ["ai_samples", "ai_source_excerpts"]) {
    const rows = await stub(`/rest/v1/${table}`, account.token);
    expect(rows.status, table).toBe(200);
    expect(await rows.json(), table).toEqual([]);
  }
  await plain.close();

  const anonymous = await browser.newContext({ baseURL: baseUrlOf(page) });
  const visitor = await anonymous.newPage();
  expect((await visitor.goto("/admin/ai-samples"))?.status()).toBe(404);
  for (const table of ["ai_samples", "ai_source_excerpts"]) {
    expect((await stub(`/rest/v1/${table}`, null)).status, table).toBe(401);
  }
  await anonymous.close();
});

test("test_479_an_empty_library_says_no_samples_yet", async ({ page, context }) => {
  const admin = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  expect((await stub("/__ai_samples", null, { token: admin.token, library: "empty" })).status).toBe(
    200,
  );
  await page.goto("/admin/ai-samples");
  await expect(page.locator(".admin-panel .admin-empty")).toHaveText("No samples yet");
  await expect(detail(page)).toHaveCount(0);
});

test("test_479_a_failed_read_says_so_with_retry", async ({ page, context }) => {
  const admin = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  expect(
    (await stub("/__fail_reads", null, { token: admin.token, tables: ["ai_samples"] })).status,
  ).toBe(200);
  await page.goto("/admin/ai-samples");
  const box = page.locator(".admin-errbox[role=alert]");
  await expect(box).toContainText("The sample library could not be read.");
  await expect(box.getByRole("link", { name: "Retry" })).toBeVisible();
  await expect(page.locator(".admin-panel .admin-empty")).toHaveText("No samples yet");
});
