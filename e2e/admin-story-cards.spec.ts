import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #444 (#430 phase 2): the Story cards page (ADM-06, one story) has the layout of the admin
// prototype's Story cards screen: a header, then two columns, the cards (one panel for the
// background card and one per part, a row per card: kind, text, state and actions) and a phone
// preview that shows a card as the app draws it, read only. These tests only read: they open
// "site-search", which no test changes (the visual gate reads it too).

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

const STORY = "site-search";

test("test_444_ac1_the_page_has_the_prototype_header_and_two_columns", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumb).toHaveText(/Stories\s*›\s*Story 8 · The Canyon and the Mesa/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Story cards");
  // The menu marks the row this detail page belongs to, Stories (ADM-06), as current (#435).
  const menu = page.getByRole("navigation", { name: "Admin pages" });
  await expect(menu.getByRole("link", { name: /Stories/ })).toHaveAttribute("aria-current", "true");

  // Cards on the left, the preview on the right, 16 px apart, the preview 300 px wide.
  const cards = page.getByRole("region", { name: "Cards" });
  const preview = page.getByRole("complementary", { name: "Preview" });
  const left = (await cards.boundingBox())!;
  const right = (await preview.boundingBox())!;
  expect(Math.round(right.width)).toBe(300);
  expect(Math.round(right.x - (left.x + left.width))).toBe(16);
  expect(Math.round(right.y)).toBe(Math.round(left.y));

  // One panel for the background card, then one per part, in order.
  const panels = cards.locator(":scope > section");
  await expect(panels).toHaveCount(5);
  await expect(panels.first().getByRole("heading", { level: 2 })).toHaveText("Background card");
  await expect(panels.first()).toContainText("crd.opp.site-search.bg");
  const part1 = page.getByRole("region", { name: /^Part 1 · / });
  await expect(part1.getByRole("heading", { level: 2 })).toHaveText(
    "Part 1 · Walk the canyon floor and see it plainly",
  );
  await expect(part1).toContainText("crd.opp.site-search.p1");
});

test("test_444_ac1_each_card_is_a_row_with_kind_text_state_and_actions", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  const card = page.getByRole("article", { name: "crd.opp.site-search.p1.c1" });
  // Kind column: the story slice and the card's short key.
  const kind = card.getByTestId("card-kind");
  await expect(kind).toHaveText(/Slice s1\s*p1\.c1/);
  // Text column: the card text and its length and checks.
  await expect(card.getByTestId("card-text")).toContainText(
    "Dudley thinks well of this canyon, and I remember it kindly.",
  );
  await expect(card).toContainText("Passes CARD-LENGTH");
  // Meta column: the state pill, the version and Edit.
  const meta = card.getByTestId("card-meta");
  await expect(meta.locator(".admin-pill")).toHaveText(["Published"]);
  await expect(meta).toContainText("v1, published");
  await expect(meta.getByRole("button", { name: "Edit" })).toBeVisible();
  const [k, t, m] = await Promise.all(
    [kind, card.getByTestId("card-text"), meta].map(async (item) => (await item.boundingBox())!),
  );
  expect(Math.round(k.width)).toBe(86);
  expect(t.x).toBeGreaterThan(k.x + k.width);
  expect(m.x).toBeGreaterThan(t.x + t.width);

  // The text box is closed until Edit; Cancel closes it again without saving anything.
  await expect(card.getByLabel("Text for crd.opp.site-search.p1.c1")).toHaveCount(0);
  await meta.getByRole("button", { name: "Edit" }).click();
  await expect(meta.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-expanded", "true");
  const field = card.getByLabel("Text for crd.opp.site-search.p1.c1");
  await expect(field).toBeVisible();
  await card.getByRole("button", { name: "Cancel" }).click();
  await expect(field).toHaveCount(0);
  await expect(card).toContainText("v1, published");
  await expect(card.getByRole("status")).toHaveText("");
});

test("test_444_ac1_the_phone_preview_shows_a_card_as_the_app_draws_it_read_only", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto(`/admin/stories/${STORY}`);
  const preview = page.getByRole("complementary", { name: "Preview" });
  // The app's own card (the focus page's slip), the background card first.
  const slip = preview.getByTestId("story-card");
  await expect(slip).toHaveClass(/focus-slip/);
  await expect(slip.locator(".focus-card-label")).toHaveText("Where I am");
  await expect(slip).toContainText("I am on the road northwest of Santa Fe");
  await expect(preview).toContainText("Background card");
  // Read only: nothing in it can be typed in or pressed.
  await expect(preview.locator("button, input, textarea, a")).toHaveCount(0);

  // A click on a card's text shows that card, labelled as the newest card of a Step.
  const card = page.getByRole("article", { name: "crd.opp.site-search.p2.c1" });
  await card.getByTestId("card-text").locator("p").first().click();
  await expect(slip.locator(".focus-card-label")).toHaveText("Right now");
  await expect(slip).toContainText("Once we stood in it, the flat land at the bottom");
  await expect(preview).toContainText("Part 2, card 1");
});

test("test_444_ac4_no_dead_buttons_for_features_without_data", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto(`/admin/stories/${STORY}`);
  await expect(page.locator(".admin-main h1")).toHaveText("Story cards");
  for (const name of [/^Regenerate/, /^Lock$/, /^Unlock$/, /^Mark read$/, /^Publish story$/]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
});
