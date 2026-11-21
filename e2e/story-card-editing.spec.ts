import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #304: editing, checking and publishing story cards in ADM-06. The Supabase stub keeps one set of
// card versions for every test, so these tests run one after the other, change only the story
// "eagle-hill-garden" (no other test reads it) and put the cards back before and after each test.

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
async function phoneCard(versions: Record<string, number> | null): Promise<string | undefined> {
  const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/get_story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reader_key: READER_KEY, story: STORY, versions }),
  });
  const document = (await answer.json()) as { cards: { key: string; body: string }[] };
  return document.cards.find((card) => card.key === KEY)?.body;
}

const cardOf = (page: Page, key = KEY) => page.getByRole("article", { name: key });

async function saveDraft(page: Page, text: string) {
  const card = cardOf(page);
  await card.getByLabel(`Text for ${KEY}`).fill(text);
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
