import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #440: the Overview (/admin) is the prototype's Status board (ADM-01): four count tiles, one panel
// per Companion and Oppenheimer's story-by-story table with stage dots and a legend, all from the
// admin's own data. Other tests save drafts in the same stub, so draft counts are not pinned here.

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test("test_440_ac1_the_overview_is_the_status_board", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Status board" })).toBeVisible();
  const menu = page.getByRole("navigation", { name: "Admin pages" });
  await expect(menu.getByRole("link", { name: /Status board/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(menu.getByRole("link", { name: /Status board/ })).toContainText("ADM-01");
  // Only the Status board row is current: the other rows do not sit "under" /admin.
  await expect(menu.locator("[aria-current]")).toHaveCount(1);

  // Four count tiles from the seed: two Companions (Oppenheimer has stories), 26 stories with cards.
  const tiles = page.getByRole("region", { name: "Counts" }).locator(".admin-tile");
  await expect(tiles).toHaveCount(4);
  await expect(tiles.nth(0)).toHaveText("2Companions (1 shown to users, 1 not ready)");
  await expect(tiles.nth(1)).toHaveText("26stories with cards, of 26");
  await expect(tiles.nth(2)).toContainText(/^\d+drafts waiting for an admin to publish$/);
  await expect(tiles.nth(3)).toContainText(/^\d+stories with every card published$/);

  // One panel per Companion.
  const companions = page.getByRole("region", { name: "Companions" });
  const oppenheimer = companions.getByRole("group", { name: "Oppenheimer" });
  await expect(oppenheimer.getByRole("heading", { level: 2 })).toHaveText("Oppenheimer chr.opp");
  await expect(oppenheimer).toContainText("Historical · 26 stories · shown to users ·");
  await expect(companions.getByRole("group", { name: "Moriarty" })).toContainText(
    "Fictional · no stories yet · not ready",
  );

  // The story table: the stages with data, one row per story, three dots in words.
  const table = page.getByRole("table", { name: "Oppenheimer, story by story" });
  await expect(table.getByRole("columnheader")).toHaveText([
    "#",
    "Story",
    "Cards made",
    "Checks",
    "Published",
  ]);
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(26);
  const first = rows.first();
  await expect(first.getByRole("cell").first()).toHaveText("1");
  await expect(first.getByRole("img")).toHaveCount(3);
  await expect(first.getByRole("img").first()).toHaveAttribute(
    "aria-label",
    /^Cards made: done, \d+ cards$/,
  );
  await expect(first.getByRole("img").nth(1)).toHaveAttribute(
    "aria-label",
    /^Checks: (checks passed, every card passes|a check failed, \d+ cards? fails? a check)$/,
  );
  await expect(first.getByRole("img").nth(2)).toHaveAttribute(
    "aria-label",
    /^Published: (done|not done yet), \d+ of \d+ cards published/,
  );
  await expect(page.locator(".admin-legend")).toHaveText(
    "donechecks passeda check failednot done yet",
  );
  // Nothing on the page is the prototype's sample data.
  await expect(page.getByText(/sample data/i)).toHaveCount(0);

  // A story opens its cards.
  const title = await first.getByRole("link").textContent();
  await first.getByRole("link").click();
  await expect(page).toHaveURL(/\/admin\/stories\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title ?? "");
});
