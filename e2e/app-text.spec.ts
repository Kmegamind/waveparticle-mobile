import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #288: app text in the database. The Supabase stub keeps one app_text table for every test, so
// these tests run one after the other and change only ui.HOME-0.greeting, which no other test
// reads; each test starts and ends with the seed (every code default as version 1, published). A
// test that publishes ends with a roll back in the admin, which also clears the app's own cache.

test.describe.configure({ mode: "serial" });

const KEY = "ui.HOME-0.greeting";
const DEFAULT = "Let’s launch your first wave.";

async function appTextStub(body: { failReads?: boolean; reset?: boolean }) {
  const answer = await fetch(`${STUB_SUPABASE}/__app_text`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`stub app text failed: ${answer.status}`);
}

test.beforeEach(() => appTextStub({ reset: true, failReads: false }));
test.afterEach(() => appTextStub({ reset: true, failReads: false }));

/** The App text card of one key. */
const card = (page: Page, key: string) => page.getByRole("region", { name: key });

/** HOME-0 of a fresh account: the greeting on the Goal card. */
async function homeGreeting(page: Page) {
  await page.goto("/");
  const greeting = page.getByRole("region", { name: "Goal" }).getByRole("heading", { level: 2 });
  await expect(greeting).toBeVisible();
  return greeting;
}

async function saveAndPublish(page: Page, text: string) {
  await page.goto("/admin/app-text");
  const greeting = card(page, KEY);
  await greeting.getByLabel(`Text for ${KEY}`).fill(text);
  await greeting.getByRole("button", { name: "Save draft" }).click();
  await expect(greeting.getByRole("status")).toHaveText("Draft saved.");
  await expect(greeting.getByTestId("draft-text")).toContainText(text);
  await greeting.getByRole("button", { name: "Publish v2" }).click();
  await expect(greeting.getByRole("status")).toHaveText("Published v2.");
  await expect(greeting.getByTestId("published-text")).toContainText(text);
}

/** Rolls the greeting back to version 1 in the admin, which also clears the app's cache. */
async function rollBackToFirst(page: Page) {
  await page.goto("/admin/app-text");
  const greeting = card(page, KEY);
  await greeting.getByText(/^Versions \(/).click();
  await greeting.getByRole("button", { name: "Roll back to v1" }).click();
  await expect(greeting.getByRole("status")).toHaveText("Rolled back to v1.");
  await expect(greeting.getByTestId("published-text")).toContainText(DEFAULT);
}

test("test_288_ac2_lists_every_key_with_its_screen_and_published_text", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/app-text");
  await expect(page.getByRole("heading", { level: 1, name: "App text" })).toBeVisible();
  await expect(page.locator(".admin-text")).toHaveCount(13);
  const failure = card(page, "ui.F3.fail.body");
  await expect(failure.getByText("Screen F3")).toBeVisible();
  await expect(failure.getByTestId("published-text")).toHaveText(
    "v1 He is not here right now. Please try again.",
  );
  await expect(failure.getByTestId("draft-text")).toHaveCount(0);
});

test("test_288_ac2_writer_edits_publishes_and_the_screen_shows_it", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await expect(await homeGreeting(page)).toHaveText(DEFAULT);

  await saveAndPublish(page, "Let’s start your first wave.");
  await expect(await homeGreeting(page)).toHaveText("Let’s start your first wave.");
  await rollBackToFirst(page);
});

test("test_288_ac2_a_draft_is_not_shown_until_published", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/app-text");
  const greeting = card(page, KEY);
  await greeting.getByLabel(`Text for ${KEY}`).fill("A draft nobody sees yet.");
  await greeting.getByRole("button", { name: "Save draft" }).click();
  await expect(greeting.getByTestId("draft-text")).toContainText("A draft nobody sees yet.");
  await expect(greeting.getByTestId("published-text")).toContainText(DEFAULT);
  await expect(await homeGreeting(page)).toHaveText(DEFAULT);
});

test("test_288_ac2_roll_back_restores_the_old_text", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await saveAndPublish(page, "Let’s start your first wave.");

  await expect(await homeGreeting(page)).toHaveText("Let’s start your first wave.");
  await rollBackToFirst(page);
  await expect(await homeGreeting(page)).toHaveText(DEFAULT);
});

test("test_288_ac3_database_unavailable_shows_the_code_default", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  // Published reads fail from here on; the writer's own reads and writes still work.
  await appTextStub({ failReads: true });
  await saveAndPublish(page, "Let’s start your first wave.");
  // The database has a newer published text, but cannot answer the app: the code default shows.
  await expect(await homeGreeting(page)).toHaveText(DEFAULT);

  await appTextStub({ failReads: false });
  await expect(await homeGreeting(page)).toHaveText("Let’s start your first wave.");
  await rollBackToFirst(page);
});

test("test_288_ac1_an_account_without_a_role_cannot_write", async ({ page, context }) => {
  const account = await signIn(context, baseUrlOf(page));
  const response = await page.goto("/admin/app-text");
  expect(response?.status()).toBe(404);
  await expect(page.getByLabel(`Text for ${KEY}`)).toHaveCount(0);

  // The database itself refuses the write functions to a no-role account.
  for (const [name, args] of [
    ["save_app_text_draft", { text_key: KEY, text_body: "Hello" }],
    ["publish_app_text", { text_key: KEY, text_version: 1 }],
  ] as const) {
    const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { authorization: `Bearer ${account.token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    expect(answer.status, name).toBe(403);
  }
  await expect(await homeGreeting(page)).toHaveText(DEFAULT);
});

test("test_288_admin_is_not_kept_in_the_browser_cache", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const response = await page.goto("/admin/app-text");
  // The proxy's own value (Next alone would send "no-cache, no-store" without "private").
  expect(response?.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  await context.clearCookies();
  await signIn(context, baseUrlOf(page));
  const notFound = await page.goto("/admin/app-text");
  expect(notFound?.status()).toBe(404);
  // Next's not-found answer sets its own value, which is private and no-store as well.
  expect(notFound?.headers()["cache-control"]).toMatch(/^private,.*\bno-store\b/);
});

test("test_288_ac2_no_sideways_scroll_at_360_px", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/app-text");
  await card(page, KEY).getByText("Versions (1)").click();
  await expect(card(page, KEY).getByText("Published", { exact: true }).last()).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});
