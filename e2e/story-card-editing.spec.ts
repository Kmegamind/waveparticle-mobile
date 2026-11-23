import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #304: editing, checking and publishing story cards in ADM-06. The Supabase stub keeps one set of
// card versions for every test, so these tests run one after the other, change only the stories
// "eagle-hill-garden" and "cross-examination" (no other test reads them) and put the cards back
// before and after each test.

test.describe.configure({ mode: "serial" });

const STORY = "eagle-hill-garden";
const KEY = `crd.opp.${STORY}.p1.c1`;
const ORIGINAL =
  "Haakon had a look I knew from old friends. He was about to tell me something, and the first guests were not here yet. I wanted every word of it before the lamps filled with people.";
/** The server's story content reader key in the e2e config (playwright.config.ts). */
const READER_KEY = "e2e-content-reader";

async function resetCards() {
  const answer = await fetch(`${STUB_SUPABASE}/__story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  if (!answer.ok) throw new Error(`stub story cards failed: ${answer.status}`);
}

test.beforeEach(resetCards);
test.afterEach(resetCards);

/** The phone's read of the card (#300): published, or pinned to the given versions. */
async function phoneCard(
  versions: Record<string, number> | null,
  key = KEY,
): Promise<string | undefined> {
  const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/get_story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reader_key: READER_KEY, story: STORY, versions }),
  });
  const document = (await answer.json()) as { cards: { key: string; body: string }[] };
  return document.cards.find((card) => card.key === key)?.body;
}

const cardOf = (page: Page, key = KEY) => page.getByRole("article", { name: key });

async function saveDraft(page: Page, text: string, key = KEY) {
  const card = cardOf(page, key);
  await card.getByLabel(`Text for ${key}`).fill(text);
  await card.getByRole("button", { name: "Save draft" }).click();
}

test("test_304_ac1_ac3_ac5_a_writer_saves_a_draft_sees_its_problems_and_cannot_publish", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/stories/${STORY}`);
  await saveDraft(page, "Haakon said the name Eltenton before the guests came.");
  const card = cardOf(page);
  await expect(card.getByRole("status")).toHaveText(
    "Draft v2 saved. It fails 1 check; see the problems above.",
  );
  await expect(card.getByRole("list", { name: "Problems of the draft" })).toHaveText(
    'Mentions "eltenton", which comes in a later part.',
  );
  const publish = card.getByRole("button", { name: "Publish v2" });
  await expect(publish).toBeDisabled();
  await expect(card).toContainText("Only an admin can publish.");
  // The published version is untouched: the page and the phone still show v1.
  await expect(card).toContainText("v1, published");
  expect(await phoneCard(null)).toBe(ORIGINAL);
});

test("test_304_ac2_a_writer_renames_a_part", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/stories/${STORY}`);
  const part1 = page.getByRole("region", { name: /^Part 1: / });
  await part1.getByLabel("Title of part 1").fill("Hear Haakon out in the kitchen.");
  await part1.getByRole("button", { name: "Save title" }).click();
  await expect(part1.getByRole("status").first()).toHaveText("Title saved.");
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 2, name: "Part 1: Hear Haakon out in the kitchen." }),
  ).toBeVisible();
});

test("test_304_ac4_a_draft_with_a_year_cannot_be_published", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  await saveDraft(page, "In 1943 Haakon came to the kitchen door.");
  const card = cardOf(page);
  await expect(card.getByRole("status")).toContainText("Draft v2 saved. It fails 1 check");
  await expect(card.getByRole("list", { name: "Problems of the draft" })).toHaveText(
    'Mentions a year ("1943"). Years and dates stay in the admin.',
  );
  await expect(card.getByRole("button", { name: "Publish v2" })).toBeDisabled();
  await expect(card).toContainText("Publish is off: this draft fails 1 check.");
});

test("test_304_ac6_ac7_ac8_an_admin_publishes_rolls_back_and_pinned_sessions_keep_their_version", async ({
  page,
  context,
}) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  const text = "Haakon stood by the kitchen door with his hat in his hands.";
  await saveDraft(page, text);
  const card = cardOf(page);
  await expect(card.getByRole("status")).toHaveText("Draft v2 saved. It passes every check.");
  await card.getByRole("button", { name: "Publish v2" }).click();
  await expect(card.getByRole("status")).toHaveText("Published v2.");

  // Phones read v2; a session that pinned v1 keeps v1 (#300).
  expect(await phoneCard(null)).toBe(text);
  expect(await phoneCard({ [KEY]: 1 })).toBe(ORIGINAL);
  // A draft is never read, even when a session names it.
  await page.reload();
  await saveDraft(page, "Haakon waited by the stove.");
  await expect(cardOf(page).getByRole("status")).toContainText("Draft v3 saved.");
  expect(await phoneCard({ [KEY]: 3 })).toBeUndefined();

  await page.goto("/admin/publish-history");
  const published = page.getByRole("row", { name: `${KEY} v2, Published` }).first();
  // #313: a readable name before the key.
  await expect(published).toContainText("The Garden at Eagle Hill · part 1, card 1");
  await expect(published).toContainText(`${account.userId}@example.invalid`);
  await expect(published).toContainText("Published now");

  // Roll back to v1 on the story page; the history then offers v2 again.
  await page.goto(`/admin/stories/${STORY}`);
  await cardOf(page)
    .getByText(/^Versions \(/)
    .click();
  await cardOf(page).getByRole("button", { name: "Roll back to v1" }).click();
  await expect(cardOf(page).getByRole("status")).toHaveText("Rolled back to v1.");
  expect(await phoneCard(null)).toBe(ORIGINAL);

  await page.goto("/admin/publish-history");
  await expect(page.getByRole("row", { name: `${KEY} v1, Rolled back` }).first()).toContainText(
    "Published now",
  );
  const again = page.getByRole("row", { name: `${KEY} v2, Published` }).first();
  await again.getByRole("button", { name: "Roll back to v2" }).click();
  await expect(again.getByRole("status")).toHaveText("Rolled back to v2.");
  expect(await phoneCard(null)).toBe(text);
});

test("test_304_ac3_published_cards_with_years_show_as_failing", async ({ page, context }) => {
  // The seed card was fixed (#46); the database can still hold the published version with the year.
  const answer = await fetch(`${STUB_SUPABASE}/__story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      published: {
        key: "crd.opp.cross-examination.p4.c2",
        body: "Robb read from the 1943 transcript. I didn't recall saying it but would not deny it.",
      },
    }),
  });
  expect(answer.ok).toBe(true);
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/stories/cross-examination");
  const failing = cardOf(page, "crd.opp.cross-examination.p4.c2");
  await expect(failing).toContainText("v1, published");
  await expect(failing.getByRole("list", { name: "Problems" })).toContainText(
    'Mentions a year ("1943").',
  );
});

// #377: the whole-Story checks (repeated lines in story order) on a saved draft and on Publish.
const SECOND = `crd.opp.${STORY}.p1.c2`;
const SECOND_ORIGINAL =
  "Haakon told me about his visit from the FBI, and I felt my face go dark. The house has thin doors and too many ears. I did not want one person near enough to hear.";

test("test_377_ac2_a_saved_draft_that_repeats_an_earlier_card_shows_the_problem", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  await saveDraft(page, ORIGINAL, SECOND);
  const card = cardOf(page, SECOND);
  await expect(card.getByRole("status")).toHaveText(
    "Draft v2 saved. It fails 1 check; see the problems above.",
  );
  await expect(card.getByRole("list", { name: "Problems of the draft" })).toHaveText(
    `Repeats part 1, card 1 (${KEY}), an earlier card of this story.`,
  );
  await expect(card.getByRole("button", { name: "Publish v2" })).toBeDisabled();
  await expect(card).toContainText("Publish is off: this draft fails 1 check.");
});

test("test_377_ac1_publish_is_refused_when_the_story_changed_and_the_draft_now_repeats_a_card", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  const text = "Haakon stood by the kitchen door with his hat in his hands.";
  await saveDraft(page, text, SECOND);
  const card = cardOf(page, SECOND);
  await expect(card.getByRole("status")).toHaveText("Draft v2 saved. It passes every check.");

  // Meanwhile card 1 of part 1 is published with the same text (as by another admin).
  const answer = await fetch(`${STUB_SUPABASE}/__story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ published: { key: KEY, body: text } }),
  });
  expect(answer.ok).toBe(true);

  await card.getByRole("button", { name: "Publish v2" }).click();
  await expect(card.getByRole("status")).toContainText(
    "This draft fails a check, so it was not published.",
  );
  await expect(card.getByRole("list", { name: "Problems that stopped Publish" })).toHaveText(
    `Repeats part 1, card 1 (${KEY}), an earlier card of this story.`,
  );
  // Phones still read the published version.
  expect(await phoneCard(null, SECOND)).toBe(SECOND_ORIGINAL);

  // The reloaded page shows the problem on the draft, and Publish is off.
  await page.reload();
  const reloaded = cardOf(page, SECOND);
  await expect(reloaded.getByRole("list", { name: "Problems of the draft" })).toHaveText(
    `Repeats part 1, card 1 (${KEY}), an earlier card of this story.`,
  );
  await expect(reloaded.getByRole("button", { name: "Publish v2" })).toBeDisabled();
});

// #377, owner decision 2026-11-23 (decision 0028): Roll back warns, never blocks. Both roll back
// buttons check the version that would become live; with problems the admin confirms first.
async function publishCardBody(key: string, body: string) {
  const answer = await fetch(`${STUB_SUPABASE}/__story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ published: { key, body } }),
  });
  expect(answer.ok).toBe(true);
}

const LATER_REPEAT = `Part 1, card 2 (${SECOND}), a later card of this story, repeats this card.`;

test("test_377_rollback_on_the_story_page_warns_and_rolls_back_after_confirm", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  const text = "Haakon stood by the kitchen door with his hat in his hands.";
  await saveDraft(page, text);
  const card = cardOf(page);
  await expect(card.getByRole("status")).toHaveText("Draft v2 saved. It passes every check.");
  await card.getByRole("button", { name: "Publish v2" }).click();
  await expect(card.getByRole("status")).toHaveText("Published v2.");

  // Meanwhile card 2 is published with v1's text, so rolling back to v1 would repeat it.
  await publishCardBody(SECOND, ORIGINAL);
  await page.reload();
  await cardOf(page)
    .getByText(/^Versions \(/)
    .click();
  await cardOf(page).getByRole("button", { name: "Roll back to v1" }).click();
  const warning = cardOf(page).getByRole("region", { name: "Roll back to v1: warning" });
  await expect(warning).toContainText(
    "v1 fails 1 check. Rolling back puts it live on phones anyway. Roll back anyway?",
  );
  await expect(warning.getByRole("list", { name: "Problems of v1" })).toHaveText(LATER_REPEAT);

  // Cancel: nothing changes.
  await warning.getByRole("button", { name: "Cancel" }).click();
  await expect(warning).toBeHidden();
  expect(await phoneCard(null)).toBe(text);

  // Confirm: the roll back runs as before; the server accepts it.
  await cardOf(page).getByRole("button", { name: "Roll back to v1" }).click();
  await warning.getByRole("button", { name: "Roll back anyway" }).click();
  await expect(cardOf(page).getByRole("status")).toHaveText("Rolled back to v1.");
  await expect(warning).toBeHidden();
  expect(await phoneCard(null)).toBe(ORIGINAL);
});

test("test_377_rollback_in_publish_history_warns_and_rolls_back_after_confirm", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  const second = "Haakon stood by the kitchen door with his hat in his hands.";
  await saveDraft(page, second);
  await cardOf(page).getByRole("button", { name: "Publish v2" }).click();
  await expect(cardOf(page).getByRole("status")).toHaveText("Published v2.");
  await page.reload();
  const third = "Haakon waited by the stove and said nothing at all.";
  await saveDraft(page, third);
  await cardOf(page).getByRole("button", { name: "Publish v3" }).click();
  await expect(cardOf(page).getByRole("status")).toHaveText("Published v3.");

  // Card 2 now holds v2's text, so rolling back to v2 would repeat it.
  await publishCardBody(SECOND, second);
  await page.goto("/admin/publish-history");
  const row = page.getByRole("row", { name: `${KEY} v2, Published` }).first();
  await row.getByRole("button", { name: "Roll back to v2" }).click();
  const warning = row.getByRole("region", { name: "Roll back to v2: warning" });
  await expect(warning.getByRole("list", { name: "Problems of v2" })).toHaveText(LATER_REPEAT);

  // Cancel: nothing is rolled back; v3 stays published and no new history row is written.
  const rows = page.getByRole("row", { name: new RegExp(`^${KEY.replaceAll(".", "\\.")} v`) });
  const rowCount = await rows.count();
  await warning.getByRole("button", { name: "Cancel" }).click();
  await expect(warning).toBeHidden();
  await expect(row.getByRole("status")).toHaveText("");
  expect(await phoneCard(null)).toBe(third);
  await page.reload();
  await expect(rows).toHaveCount(rowCount);
  await expect(page.getByRole("row", { name: `${KEY} v3, Published` }).first()).toContainText(
    "Published now",
  );

  // Confirm: the roll back runs as before.
  await row.getByRole("button", { name: "Roll back to v2" }).click();
  await warning.getByRole("button", { name: "Roll back anyway" }).click();
  await expect(row.getByRole("status")).toHaveText("Rolled back to v2.");
  expect(await phoneCard(null)).toBe(second);
});
