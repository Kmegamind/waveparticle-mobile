import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #308: ADM-08 Prompts. The Supabase stub keeps one set of prompt versions for every test (and the
// server reads the active ones for live calls), so these tests run one after the other, change
// only rest_reply with a harmless extra line, and put the prompts back before and after each test.

test.describe.configure({ mode: "serial" });

const KEY = "rest_reply";
const EXTRA = "Keep each sentence plain.";

async function resetPrompts() {
  const answer = await fetch(`${STUB_SUPABASE}/__prompts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  if (!answer.ok) throw new Error(`stub prompts failed: ${answer.status}`);
}

test.beforeEach(resetPrompts);
test.afterEach(resetPrompts);

const editor = (page: Page) => page.getByRole("region", { name: "Edit" });

async function saveBody(page: Page, change: (body: string) => string) {
  const field = editor(page).getByLabel("Prompt", { exact: true });
  await expect(field).toBeEnabled();
  await field.fill(change(await field.inputValue()));
  await editor(page).getByRole("button", { name: "Save draft" }).click();
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
  const list = page.getByRole("list", { name: "Prompts" });
  // #56 added `pause_predicament`, call two of the pause message.
  await expect(list.getByRole("article")).toHaveCount(8);
  await expect(list.getByRole("article", { name: "pause_predicament" })).toBeVisible();
  const rest = list.getByRole("article", { name: KEY });
  await expect(rest).toContainText("v1");
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
  const publish = editor(page).getByRole("button", { name: "Publish v2" });
  await expect(publish).toBeDisabled();
  await expect(editor(page)).toContainText("Only an admin can publish.");
});

test("test_308_ac3_bad_settings_json_is_refused_in_words", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/prompts/${KEY}`);
  const settings = editor(page).getByLabel("Settings (JSON)");
  await expect(settings).toBeEnabled();
  await settings.fill("[1, 2]");
  await editor(page).getByRole("button", { name: "Save draft" }).click();
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
  await expect(editor(page).getByRole("button", { name: "Publish v2" })).toBeDisabled();
});

test("test_308_ac5_ac6_admin_publishes_and_rolls_back_from_history", async ({ page, context }) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/prompts/${KEY}`);
  await saveBody(page, (body) => `${body}\n${EXTRA}`);
  await expect(editor(page).getByRole("status")).toContainText("Draft v2 saved.");
  await page.reload();
  await editor(page).getByRole("button", { name: "Publish v2" }).click();
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
  await editor(page).getByRole("button", { name: "Publish v3" }).click();
  await expect(editor(page).getByRole("status")).toHaveText("Published v3.");
  await page.goto("/admin/publish-history");
  const earlier = page.getByRole("row", { name: `${KEY} v2, Published` }).first();
  await earlier.getByRole("button", { name: "Roll back to v2" }).click();
  await expect(earlier.getByRole("status")).toHaveText("Rolled back to v2.");
  await page.goto(`/admin/prompts/${KEY}`);
  await expect(page.getByRole("heading", { name: "Active v2" })).toBeVisible();
});
