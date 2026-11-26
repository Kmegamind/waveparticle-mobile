import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #293: ADM-06 Stories, read-only, for an account with the admin or writer role. The Supabase stub
// serves the seed (story-decks.json) as version 1, published.

test("test_293_ac3_a_writer_sees_the_26_stories_in_story_order_with_parts_and_cards", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const response = await page.goto("/admin/stories");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Stories" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Published first, read afterwards.");
  await expect(page.getByRole("note")).toContainText("has not been read by a person yet");
  const menu = page.getByRole("navigation", { name: "Admin pages" });
  await expect(menu.getByRole("link", { name: /Stories/ })).toContainText("ADM-06");

  // #443: the stories are rows of the Life path table (one row per story, with its link), not
  // one panel each; the counts are the same.
  const stories = page
    .getByRole("table", { name: "Stories" })
    .getByRole("row")
    .filter({ has: page.getByRole("link") });
  await expect(stories).toHaveCount(26);
  await expect(stories.first()).toHaveAccessibleName("The Trade of a Theorist");
  await expect(stories.first().getByTestId("parts")).toHaveText("4 parts");
  await expect(stories.first().getByTestId("cards")).toHaveText(
    "9 part cards and a background card",
  );
  await expect(stories.last()).toHaveAccessibleName("The Fermi Award");
  await expect(page.getByRole("button")).toHaveText(["Sign out"]);
});

// #443: the prototype's Life path table. Stories grouped by Life Path period (a grey period row
// with the period's key), each with #, the story and its key, its Life path description and the
// state of that description. Only story 1 and period 1 are asserted by name: the #309 field tests
// rename and move later periods and publish the last story's description while this runs.
test("test_443_ac1_stories_are_a_life_path_table_grouped_by_period", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/stories");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
    /Companions›J\. Robert Oppenheimer/,
  );
  const table = page.getByRole("table", { name: "Stories" });
  await expect(table.getByRole("columnheader")).toHaveText([
    "#",
    "Story",
    "Life path description",
    "Description state",
  ]);
  const first = table.getByRole("rowgroup", { name: /^Period 1: / });
  const periodRow = first.getByRole("row").first();
  await expect(periodRow.locator(".admin-chip")).toHaveText("chr.opp.period.1");
  const story = first.getByRole("row", { name: "The Trade of a Theorist" });
  await expect(story.getByRole("cell").first()).toHaveText("1");
  await expect(story.locator(".admin-chip")).toHaveText("opp.bohr-difficulties");
  // The stand-in's descriptions start empty (#309): no text, and the state says so.
  await expect(story.getByRole("cell").nth(2)).toHaveText("Not written yet");
  await expect(story.getByRole("cell").nth(3)).toHaveText("Not written");
  await story.getByRole("link", { name: "The Trade of a Theorist" }).click();
  await expect(page).toHaveURL(/\/admin\/stories\/bohr-difficulties$/);
});

test("test_293_ac3_opening_a_story_shows_its_background_card_and_cards_by_part", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/stories");
  await page.getByRole("link", { name: "The Canyon and the Mesa" }).click();
  await expect(page).toHaveURL(/\/admin\/stories\/site-search$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Canyon and the Mesa");
  await expect(page.getByRole("note")).toBeVisible();

  const background = page.getByRole("region", { name: "Background card" });
  await expect(background.getByRole("article", { name: "crd.opp.site-search.bg" })).toContainText(
    "v1, published",
  );
  const part1 = page.getByRole("region", { name: /^Part 1: / });
  await expect(part1).toBeVisible();
  const first = part1.getByRole("article", { name: "crd.opp.site-search.p1.c1" });
  await expect(first).toContainText("v1, published");
  await expect(first).toContainText("Slice");
  await expect(first).toContainText("Passes CARD-LENGTH");
  await expect(page.getByRole("region", { name: /^Part \d/ })).toHaveCount(4);
});

test("test_293_ac4_an_account_without_a_role_gets_page_not_found", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page));
  for (const path of ["/admin/stories", "/admin/stories/site-search"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByText("crd.opp.")).toHaveCount(0);
  }
});

test("test_293_an_unknown_story_shows_page_not_found", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  // The admin layout streams before the story is read, so the status stays 200 (a soft 404); the
  // page is the app's normal not-found page, with no story content.
  await page.goto("/admin/stories/no-such-story");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});
