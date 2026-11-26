import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #308: ADM-08 Prompts. The Supabase stub keeps one set of prompt versions for every test (and the
// server reads the active ones for live calls), so these tests run one after the other, change
// only rest_reply with a harmless extra line, and put rest_reply back before and after each test.
// #446: only rest_reply is put back (the stub's per-key reset), so prompts that other tests or the
// visual gate read are never touched.

test.describe.configure({ mode: "serial" });

const KEY = "rest_reply";
const EXTRA = "Keep each sentence plain.";

async function resetPrompts() {
  const answer = await fetch(`${STUB_SUPABASE}/__prompts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true, key: KEY }),
  });
  if (!answer.ok) throw new Error(`stub prompts failed: ${answer.status}`);
}

test.beforeEach(resetPrompts);
test.afterEach(resetPrompts);

const editor = (page: Page) => page.getByRole("region", { name: "Edit" });
// #446: Save draft and Publish sit in the page's header action row, as in the prototype.
const headerActions = (page: Page) => page.getByRole("group", { name: "Prompt actions" });

async function saveBody(page: Page, change: (body: string) => string) {
  const field = editor(page).getByLabel("Prompt", { exact: true });
  await expect(field).toBeEnabled();
  await field.fill(change(await field.inputValue()));
  await headerActions(page).getByRole("button", { name: "Save draft" }).click();
}

test("test_308_ac1_lists_the_eight_prompts_with_v1_active_and_settings", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Admin pages" })
    .getByRole("link", { name: /Prompts/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/prompts$/);
  // #446: the list is a table as in the prototype, one row per prompt, each with its key as a link.
  const list = page.getByRole("table", { name: "Prompts" });
  await expect(list.getByRole("columnheader")).toHaveText([
    "Prompt",
    "What it is for",
    "Active",
    "Draft",
    "Settings",
  ]);
  const row = (key: string) =>
    list.getByRole("row").filter({ has: page.getByRole("link", { name: key, exact: true }) });
  // #56 added `pause_predicament`, call two of the pause message; #117 the safety classifier.
  await expect(list.locator("tbody").getByRole("row")).toHaveCount(9);
  await expect(row("pause_predicament")).toHaveCount(1);
  await expect(row("safety_classifier")).toHaveCount(1);
  const rest = row(KEY);
  await expect(rest.getByRole("cell").nth(2)).toHaveText("v1 Active");
  await expect(rest.getByRole("cell").nth(3)).toHaveText("None");
  await expect(rest.getByRole("list", { name: `Settings of ${KEY}` })).toContainText(
    "checks.max_words: 80",
  );
});

test("test_308_ac2_ac3_ac4_writer_saves_a_draft_and_sees_the_diff", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/prompts/${KEY}`);
  await expect(page.getByLabel("Active prompt")).toContainText("The person wrote: {{userMessage}}");
  // A new draft starts with an empty note: the active version's note says why it was made.
  await expect(editor(page).getByLabel("Note (what changed and why)")).toHaveValue("");
  await saveBody(page, (body) => `${body}\n${EXTRA}`);
  await expect(editor(page).getByRole("status")).toHaveText(
    "Draft v2 saved. The gateway can use it.",
  );
  await page.reload();
  const draft = page.getByRole("region", { name: "Draft v2" });
  await expect(draft.getByRole("list", { name: "Prompt changes" })).toContainText(
    `+Added: ${EXTRA}`,
  );
  await expect(draft).toContainText("Changes from active v1");
  await expect(draft).toContainText("No change to the settings.");
  const publish = headerActions(page).getByRole("button", { name: "Publish v2" });
  await expect(publish).toBeDisabled();
  await expect(editor(page)).toContainText("Only an admin can publish.");
});

test("test_308_ac3_bad_settings_json_is_refused_in_words", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/prompts/${KEY}`);
  const settings = editor(page).getByLabel("Settings (JSON)");
  await expect(settings).toBeEnabled();
  await settings.fill("[1, 2]");
  await headerActions(page).getByRole("button", { name: "Save draft" }).click();
  await expect(editor(page).getByRole("status")).toContainText(
    "The settings are not a JSON object, so nothing was saved.",
  );
  await expect(settings).toHaveValue("[1, 2]");
});

test("test_308_ac7_admin_cannot_publish_an_unknown_placeholder", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/prompts/${KEY}`);
  await saveBody(page, (body) => body.replace("{{facts}}", "{{fatcs}}"));
  await expect(editor(page).getByRole("status")).toContainText("Draft v2 saved.");
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Draft v2" })
      .getByRole("list", { name: "Problems of the draft" }),
  ).toHaveText("Unknown {{fatcs}} in the prompt.");
  await expect(headerActions(page).getByRole("button", { name: "Publish v2" })).toBeDisabled();
});

test("test_308_ac5_ac6_admin_publishes_and_rolls_back_from_history", async ({ page, context }) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/prompts/${KEY}`);
  await saveBody(page, (body) => `${body}\n${EXTRA}`);
  await expect(editor(page).getByRole("status")).toContainText("Draft v2 saved.");
  await page.reload();
  await headerActions(page).getByRole("button", { name: "Publish v2" }).click();
  await expect(editor(page).getByRole("status")).toHaveText("Published v2.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Active v2" })).toBeVisible();

  await page.goto("/admin/publish-history");
  const published = page.getByRole("row", { name: `${KEY} v2, Published` }).first();
  // #313: a readable name before the key.
  await expect(published).toContainText("His reply in the rest chat");
  await expect(published).toContainText(`${account.userId}@example.invalid`);

  // Publish v1 back through a roll back from the history: v1 was active before.
  await page.goto(`/admin/prompts/${KEY}`);
  await saveBody(page, (body) => `${body}\nAnd one more.`);
  // Wait for the save, or the reload can cut it off before v3 exists.
  await expect(editor(page).getByRole("status")).toContainText("Draft v3 saved.");
  await page.reload();
  await headerActions(page).getByRole("button", { name: "Publish v3" }).click();
  await expect(editor(page).getByRole("status")).toHaveText("Published v3.");
  await page.goto("/admin/publish-history");
  const earlier = page.getByRole("row", { name: `${KEY} v2, Published` }).first();
  await earlier.getByRole("button", { name: "Roll back to v2" }).click();
  await expect(earlier.getByRole("status")).toHaveText("Rolled back to v2.");
  await page.goto(`/admin/prompts/${KEY}`);
  await expect(page.getByRole("heading", { name: "Active v2" })).toBeVisible();
});

// #446: the prompt page in the prototype's layout: the header action row, two panels side by side
// (the active version; the editor with its Versions table), then the draft's changes.
const versions = (page: Page) => page.getByRole("table", { name: "Versions" });

test("test_446_prompt_page_has_two_columns_and_header_actions", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/prompts/${KEY}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Prompts · ${KEY}`);
  const left = await page.getByRole("region", { name: "Active v1" }).boundingBox();
  // The right panel holds the editor and the Versions table.
  const right = await editor(page).locator("..").boundingBox();
  await expect(editor(page).locator("..").getByRole("table", { name: "Versions" })).toBeVisible();
  if (!left || !right) throw new Error("the two panels are not drawn");
  // Side by side, top aligned, equal widths: the prototype's two columns, 14 px apart.
  expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(right.x - (left.x + left.width) - 14)).toBeLessThanOrEqual(1);
  // No draft yet: Save draft only, no Publish.
  await expect(headerActions(page).getByRole("button")).toHaveText(["Save draft"]);
  // The Versions table: one row, v1, the active version.
  await expect(versions(page).getByRole("row")).toHaveCount(1);
  await expect(versions(page).getByRole("row", { name: /^v1 / })).toContainText("Active");
});

test("test_446_save_draft_without_a_change_writes_nothing", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/prompts/${KEY}`);
  const field = editor(page).getByLabel("Prompt", { exact: true });
  await expect(field).toBeEnabled();
  // The field holds the stored text exactly.
  await expect(field).toHaveValue((await page.getByLabel("Active prompt").textContent()) ?? "");
  await headerActions(page).getByRole("button", { name: "Save draft" }).click();
  await expect(editor(page).getByRole("status")).toHaveText(
    "Nothing changed, so no new version was saved.",
  );
  await page.reload();
  await expect(versions(page).getByRole("row")).toHaveCount(1);
  await expect(page.getByRole("region", { name: /^Draft v/ })).toHaveCount(0);
});

async function publishSecondVersion(page: Page) {
  await page.goto(`/admin/prompts/${KEY}`);
  await saveBody(page, (body) => `${body}\n${EXTRA}`);
  await expect(editor(page).getByRole("status")).toContainText("Draft v2 saved.");
  await page.reload();
  await expect(versions(page).getByRole("row", { name: /^v2 / })).toContainText("Draft");
  // A draft that was never active cannot be rolled back to.
  await expect(versions(page).getByRole("button")).toHaveCount(0);
  await headerActions(page).getByRole("button", { name: "Publish v2" }).click();
  await expect(editor(page).getByRole("status")).toHaveText("Published v2.");
  await page.reload();
  await expect(versions(page).getByRole("row", { name: /^v2 / })).toContainText("Active");
}

test("test_446_admin_rolls_back_from_the_versions_table", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await publishSecondVersion(page);
  await versions(page)
    .getByRole("row", { name: /^v1 / })
    .getByRole("button", { name: "Roll back to v1" })
    .click();
  await expect(page.getByRole("region", { name: "Versions" }).getByRole("status")).toHaveText(
    "Rolled back to v1.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Active v1" })).toBeVisible();
  await expect(versions(page).getByRole("row", { name: /^v2 / })).toContainText("Earlier version");
});

test("test_446_writer_has_no_roll_back_in_the_versions_table", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await publishSecondVersion(page);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.reload();
  await expect(versions(page).getByRole("row", { name: /^v1 / })).toContainText("Earlier version");
  await expect(versions(page).getByRole("button")).toHaveCount(0);
});
