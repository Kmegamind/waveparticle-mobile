import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn, useSeededPublishHistory } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #289: ADM-12 Publish history. The Supabase stub keeps one app_text table and one history for
// every test, so these tests run one after the other and change only ui.R-OFF.body, which no
// screen shows yet (#21) and no other test changes. Each test starts and ends with that key reset.

test.describe.configure({ mode: "serial" });

const KEY = "ui.R-OFF.body";

async function resetKey() {
  const answer = await fetch(`${STUB_SUPABASE}/__app_text`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: KEY }),
  });
  if (!answer.ok) throw new Error(`stub app text failed: ${answer.status}`);
}

test.beforeEach(resetKey);
test.afterEach(resetKey);

/** The newest history row of one version and action. */
const historyRow = (page: Page, version: number, action: "Published" | "Rolled back") =>
  page.getByRole("row", { name: `${KEY} v${version}, ${action}` }).first();

async function publishNewVersion(page: Page, text: string) {
  await page.goto("/admin/app-text");
  const card = page.getByRole("row", { name: KEY, exact: true });
  await card.getByLabel(`Text for ${KEY}`).fill(text);
  await card.getByRole("button", { name: "Save draft" }).click();
  await expect(card.getByRole("status")).toHaveText("Draft saved.");
  await card.getByRole("button", { name: "Publish v2" }).click();
  await expect(card.getByRole("status")).toHaveText("Published v2.");
}

test("test_289_ac1_ac2_publish_and_roll_back_each_write_a_row_newest_first", async ({
  page,
  context,
}) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await publishNewVersion(page, "You are offline. Your Step is kept.");

  await page.goto("/admin/publish-history");
  await expect(page.getByRole("heading", { level: 1, name: "Publish history" })).toBeVisible();
  // #317: the table has its own accessible name.
  await expect(page.getByRole("table", { name: "Publish history" })).toBeVisible();
  const published = historyRow(page, 2, "Published");
  await expect(published).toContainText(`${account.userId}@example.invalid`);
  await expect(published).toContainText("App text");
  // #313: the prototype's short date, in UTC.
  await expect(published).toContainText(/\d{2}-\d{2} \d{2}:\d{2}/);
  // v2 is the version published now: nothing to roll back to.
  await expect(published.getByRole("button", { name: /Roll back/ })).toHaveCount(0);
  await expect(published).toContainText("Published now");

  // A roll back on the App text page writes its own row, above the publish.
  await page.goto("/admin/app-text");
  const card = page.getByRole("row", { name: KEY, exact: true });
  await card.getByText(/^Versions \(/).click();
  await card.getByRole("button", { name: "Roll back to v1" }).click();
  await expect(card.getByRole("status")).toHaveText("Rolled back to v1.");
  // The version that was published before is not a draft (known issue from #288).
  await expect(card.getByTestId("draft-text")).toHaveCount(0);
  await expect(card.getByText("Earlier version")).toBeVisible();

  await page.goto("/admin/publish-history");
  const rows = page.getByRole("row").filter({ hasText: KEY });
  await expect(rows.first()).toHaveAccessibleName(`${KEY} v1, Rolled back`);
  await expect(rows.nth(1)).toHaveAccessibleName(`${KEY} v2, Published`);
});

test("test_289_ac2_roll_back_from_the_history_publishes_that_version_again", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await publishNewVersion(page, "You are offline. Your Step is kept.");

  await page.goto("/admin/publish-history");
  // v1 was published by the seed, before the history existed: only the publish of v2 is listed.
  await historyRow(page, 2, "Published").waitFor();
  await page.goto("/admin/app-text");
  const card = page.getByRole("row", { name: KEY, exact: true });
  await card.getByText(/^Versions \(/).click();
  await card.getByRole("button", { name: "Roll back to v1" }).click();
  await expect(card.getByRole("status")).toHaveText("Rolled back to v1.");

  // Now v2 is not published: its history row offers Roll back.
  await page.goto("/admin/publish-history");
  const published = historyRow(page, 2, "Published");
  await published.getByRole("button", { name: "Roll back to v2" }).click();
  await expect(published.getByRole("status")).toHaveText("Rolled back to v2.");
  await expect(historyRow(page, 2, "Rolled back")).toBeVisible();
  await expect(historyRow(page, 2, "Rolled back")).toContainText("Published now");

  await page.goto("/admin/app-text");
  // #445: the published text is the text edited in place; its version is in the Versions list.
  const again = page.getByRole("row", { name: KEY, exact: true });
  await expect(again.getByTestId("published-text")).toHaveText(
    "You are offline. Your Step is kept.",
  );
  await again.getByText(/^Versions \(/).click();
  await expect(again.getByRole("listitem").filter({ hasText: /^v2/ })).toContainText("Published");
});

test("test_289_ac3_an_account_without_a_role_cannot_read_the_history", async ({
  page,
  context,
}) => {
  const account = await signIn(context, baseUrlOf(page));
  const response = await page.goto("/admin/publish-history");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("row")).toHaveCount(0);

  // The database itself refuses the list to a no-role account and to anon.
  const callers: Record<string, string>[] = [{ authorization: `Bearer ${account.token}` }, {}];
  for (const headers of callers) {
    const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/list_publish_history`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ row_limit: 100 }),
    });
    expect(answer.status).toBe(403);
  }
});

// #447: the prototype's `history` screen. Read on the account's fixed, seeded history (the
// visual gate's view), so no other test's row can change it.
test("test_447_ac1_rows_are_one_line_with_roll_back_or_published_now", async ({
  page,
  context,
}) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await useSeededPublishHistory(account);
  await page.goto("/admin/publish-history");
  const table = page.getByRole("table", { name: "Publish history" });
  await expect(table.getByRole("row")).toHaveCount(4);
  const first = table.getByRole("row", { name: "chr.opp.who v2, Published" });
  await expect(first).toContainText("editor@example.invalid");
  await expect(first.getByRole("button")).toHaveText("Roll back to v2");
  await expect(table.getByRole("row", { name: "ui.S1.back v3, Published" })).toContainText(
    "Published now",
  );
  // The title and lede sit in the header row; the table in a scrolling panel.
  await expect(page.locator(".admin-head h1")).toHaveText("Publish history");
  await expect(page.locator(".admin-panel.admin-scroll")).toContainText("When");
  // One line per row, as the prototype's 43 px rows: no empty status line under the action.
  for (const cell of await table.locator("tbody td:last-child").all()) {
    const height = await cell.evaluate((node) => node.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(44);
  }
});
