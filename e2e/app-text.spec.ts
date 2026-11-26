import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #288: app text in the database. The Supabase stub keeps one app_text table for every test, so
// these tests run one after the other and change only ui.HOME-0.greeting, which no other test
// reads; each test starts and ends with that key's seed (every code default as version 1, published). A
// test that publishes ends with a roll back in the admin, which also clears the app's own cache.

test.describe.configure({ mode: "serial" });

const KEY = "ui.HOME-0.greeting";
const DEFAULT = "Let’s launch your first wave.";

async function appTextStub(body: { failReads?: boolean; reset?: string }) {
  const answer = await fetch(`${STUB_SUPABASE}/__app_text`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`stub app text failed: ${answer.status}`);
}

// Only this file's key is reset, so the publish history tests (#289) can run beside it.
test.beforeEach(() => appTextStub({ reset: KEY, failReads: false }));
test.afterEach(() => appTextStub({ reset: KEY, failReads: false }));

/** The App text card of one key. */
// #313: each key is one row of the App text table.
const card = (page: Page, key: string) => page.getByRole("row", { name: key, exact: true });

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
  // #313: one table row per key.
  await expect(page.getByRole("table", { name: "App text" }).locator("tbody tr")).toHaveCount(13);
  const failure = card(page, "ui.F3.fail.body");
  await expect(failure.getByRole("cell", { name: "F3", exact: true })).toBeVisible();
  // #445: the published text is the text edited in place; one version (v1) has no Versions list.
  await expect(failure.getByTestId("published-text")).toHaveText(
    "He is not here right now. Please try again.",
  );
  await expect(failure.getByLabel("Text for ui.F3.fail.body")).toHaveText(
    "He is not here right now. Please try again.",
  );
  await expect(failure.getByText("Published", { exact: true })).toBeVisible();
  await expect(failure.getByText(/^Versions \(/)).toHaveCount(0);
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

// #445: the page as the prototype draws it (ADM-07): one line per key, the text edited in place,
// and "Publish changes" in the header for an admin.

test("test_445_each_key_is_one_line_with_its_text_edited_in_place", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/app-text");
  const table = page.getByRole("table", { name: "App text" });
  // No text box in the table: each text is edited where it stands.
  await expect(table.locator("textarea")).toHaveCount(0);
  const failure = card(page, "ui.F3.fail.body");
  await expect(failure.getByLabel("Text for ui.F3.fail.body")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(failure.getByRole("button")).toHaveCount(0);
  // The prototype's line is 39.6 px tall (cell padding, one line of text, the line under it).
  const height = await failure.evaluate((row) => row.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(41);
  // A writer has no Publish changes (admin only).
  await expect(page.getByRole("button", { name: /^Publish changes/ })).toHaveCount(0);
});

test("test_445_save_draft_appears_only_on_an_exact_difference", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/app-text");
  const greeting = card(page, KEY);
  const text = greeting.getByLabel(`Text for ${KEY}`);
  await text.fill(`${DEFAULT} `);
  // One trailing space is a difference.
  await expect(greeting.getByRole("button", { name: "Save draft" })).toBeVisible();
  // Typed back to the stored text exactly: nothing to save.
  await text.fill(DEFAULT);
  await expect(greeting.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  // Cancel puts the stored text back, unchanged.
  await text.fill("Something else");
  await greeting.getByRole("button", { name: "Cancel" }).click();
  await expect(text).toHaveText(DEFAULT);
  await expect(greeting.getByRole("button")).toHaveCount(0);
  // Enter adds no line break.
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(text).toHaveText(DEFAULT);
  await expect(greeting.getByRole("button", { name: "Save draft" })).toHaveCount(0);
});

test("test_445_admin_publishes_changes_naming_each_key", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/app-text");
  const greeting = card(page, KEY);
  await greeting.getByLabel(`Text for ${KEY}`).fill("Let’s start your first wave.");
  await greeting.getByRole("button", { name: "Save draft" }).click();
  await expect(greeting.getByRole("status")).toHaveText("Draft saved.");
  // The per-key publish stays beside the draft.
  await expect(greeting.getByRole("button", { name: "Publish v2" })).toBeVisible();

  // Unsaved typing in the row: Publish v2 waits, and says why (it publishes the stored v2).
  const text = greeting.getByLabel(`Text for ${KEY}`);
  await text.fill("Typed and not saved.");
  const publishOne = greeting.getByRole("button", { name: "Publish v2" });
  await expect(publishOne).toBeDisabled();
  await expect(publishOne).toHaveAccessibleDescription(
    "Save or cancel your edit first: Publish and Roll back use the stored text.",
  );

  // The files that write app text never run at the same time (playwright.config.ts, project
  // "app-text"), so this file's draft is the only one.
  const open = page.getByRole("button", { name: /^Publish changes/ });
  // The button states its count.
  await expect(open).toHaveText("Publish changes (1)");
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Publish changes" });
  const listed = dialog.getByRole("list", { name: "Drafts to publish" }).getByRole("listitem");
  await expect(listed).toHaveCount(1);
  await expect(listed).toHaveText(`${KEY} v2Let’s start your first wave.`);
  await dialog.getByRole("button", { name: "Publish 1 draft" }).click();
  await expect(dialog.getByRole("status")).toHaveText(`Published ${KEY} v2.`);
  await dialog.getByRole("button", { name: "Close" }).last().click();
  await expect(dialog).toBeHidden();

  // The stored text changed under the typing: it is kept, shown, and said so (#445 review I1).
  // The State cell (the Versions list holds pills of its own).
  await expect(greeting.getByRole("cell").last()).toHaveText(/^Published/);
  await expect(greeting.getByRole("alert")).toContainText(
    "The stored text changed; your unsaved text was kept.",
  );
  await expect(text).toHaveText("Typed and not saved.");
  await expect(greeting.getByRole("button", { name: "Save draft" })).toBeVisible();
  await greeting.getByRole("button", { name: "Discard" }).click();
  await expect(text).toHaveText("Let’s start your first wave.");
  await expect(greeting.getByRole("alert")).toHaveCount(0);
  await expect(greeting.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  await expect(greeting.getByTestId("published-text")).toHaveText("Let’s start your first wave.");
  await expect(await homeGreeting(page)).toHaveText("Let’s start your first wave.");
  await rollBackToFirst(page);
});
