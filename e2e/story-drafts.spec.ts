import { expect, test, type BrowserContext } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #502: a Companion's stories imported as drafts (scripts/content/import-drafts.mjs). The stand-in
// loads INVENTED draft rows for one account only (e2e/support/stub-drafts.mjs), so no other test
// sees them; no text of the owner's files is used.

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

const STORY = "inv-locked-door";
const KEY = `crd.snp.${STORY}.p1.c1`;
/** The server's story content reader key in the e2e config (playwright.config.ts). */
const READER_KEY = "e2e-content-reader";

async function adminWithDrafts(
  context: BrowserContext,
  baseURL: string,
  role: "admin" | "writer" = "admin",
  extraVersions = 0,
) {
  const account = await signIn(context, baseURL, undefined, { contentRole: role });
  const loaded = await fetch(`${STUB_SUPABASE}/__drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: account.token, load: true, extraVersions }),
  });
  if (!loaded.ok) throw new Error(`stub drafts failed: ${loaded.status}`);
  return account;
}

test("test_502_ac2_the_stories_page_lists_his_imported_stories_as_drafts", async ({
  page,
  context,
}) => {
  await adminWithDrafts(context, baseUrlOf(page));
  await page.goto("/admin/stories?companion=snape");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Severus Snape");
  await expect(page.getByRole("note")).toContainText("Imported as drafts.");
  const table = page.getByRole("table", { name: "Stories" });
  const period = table.getByRole("rowgroup", { name: /^Period 1: Invented period/ });
  await expect(period.getByRole("row", { name: "Invented story 1" })).toBeVisible();
  await expect(period.getByRole("row", { name: "Invented story 2" })).toBeVisible();
  const first = table.getByRole("row", { name: "Invented story 1" });
  await expect(first).toContainText("snp.inv-locked-door");
  await expect(first.getByTestId("parts")).toHaveText("5 parts");
  await expect(first.getByTestId("cards")).toHaveText("10 part cards and a background card");
  await expect(first).toContainText("Not written yet");

  // Oppenheimer's list is unchanged: his 26 stories, none of the imported ones.
  await page.goto("/admin/stories");
  await expect(page.getByRole("note")).toContainText("Published first, read afterwards.");
  const rows = page
    .getByRole("table", { name: "Stories" })
    .locator("tbody tr:not(.admin-period-row)");
  await expect(rows).toHaveCount(26);
  await expect(page.getByText("Invented story 1")).toHaveCount(0);
});

test("test_502_ac2_a_story_shows_every_card_as_a_draft_that_can_be_edited", async ({
  page,
  context,
}) => {
  await adminWithDrafts(context, baseUrlOf(page));
  await page.goto(`/admin/stories/${STORY}`);
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumb.getByRole("link", { name: "Stories" })).toHaveAttribute(
    "href",
    "/admin/stories?companion=snape",
  );
  await expect(page.getByRole("note")).toContainText("Imported as drafts.");
  const cards = page.getByRole("region", { name: "Cards" });
  await expect(cards.locator("article")).toHaveCount(11);
  await expect(cards).toContainText("crd.snp.inv-locked-door.bg");
  const card = page.getByRole("article", { name: KEY });
  await expect(card).toContainText("Invented card 1 for aim 1 of story 1.");
  await expect(card).not.toContainText("published");
  // Without a scene table (a gap of the export) the existing checks block Publish; nothing invented.
  await expect(card).toContainText("scene table could not be read");

  await card.getByRole("button", { name: "Edit" }).click();
  await card.getByLabel(`Text for ${KEY}`).fill("An edited invented card for the first aim.");
  await card.getByRole("button", { name: "Save draft" }).click();
  await expect(card.getByRole("status")).toContainText("Draft v2 saved.");
});

test("test_502_ac2_missing_story_fields_and_inputs_say_not_written_yet", async ({
  page,
  context,
}) => {
  await adminWithDrafts(context, baseUrlOf(page));
  await page.goto(`/admin/companions/snape/stories/${STORY}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Invented story 1");
  const fields = page.getByRole("region", { name: "Story fields" });
  // The goal sentence, "Who I am" and opening are drafts: the app shows nothing until published.
  await expect(fields.getByText("Not written yet.")).toHaveCount(4);
  await expect(fields).toContainText("Invented goal sentence 1.");
  await expect(fields).toContainText("Invented place 1. What are you working on?");
  const inputs = page.getByRole("region", { name: "Model inputs (read-only)" });
  await expect(inputs).toContainText("I kept an invented promise. (not confirmed yet)");
  await expect(inputs.getByText("Not written yet")).toHaveCount(4);
});

test("test_502_ac3_phones_get_no_snape_card_and_cannot_enter_him", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page));
  for (const story of [STORY, "inv-cold-room"]) {
    const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/get_story_cards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reader_key: READER_KEY, story, versions: null }),
    });
    expect(((await answer.json()) as { cards: unknown[] }).cards).toEqual([]);
  }
  await page.goto("/companions");
  await page.getByRole("radio", { name: /Snape/ }).click();
  await expect(page.getByRole("button", { name: "Enter" })).toBeDisabled();
});

test("test_514_fix3_the_lists_read_every_card_past_the_apis_1000_row_limit", async ({
  page,
  context,
}) => {
  // 1100 later draft versions of one card: 1122 card rows, more than one API page, and the rows
  // after them (the rest of the first story) would be cut off without paging.
  await adminWithDrafts(context, baseUrlOf(page), "admin", 1100);
  await page.goto("/admin/stories?companion=snape");
  const first = page
    .getByRole("table", { name: "Stories" })
    .getByRole("row", { name: "Invented story 1" });
  await expect(first.getByTestId("parts")).toHaveText("5 parts");
  await expect(first.getByTestId("cards")).toHaveText("10 part cards and a background card");

  await page.goto(`/admin/stories/${STORY}`);
  const cards = page.getByRole("region", { name: "Cards" });
  await expect(cards.locator("article")).toHaveCount(11);
  await expect(page.getByRole("article", { name: `crd.snp.${STORY}.p5.c2` })).toBeVisible();
  await expect(page.getByRole("article", { name: KEY })).toContainText(
    "Invented later version 1101.",
  );
});
