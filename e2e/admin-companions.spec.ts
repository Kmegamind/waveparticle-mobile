import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #441: the Companions list follows the prototype's Characters screen. A click anywhere on a row
// opens the Companion (the prototype's clickable row); the name stays a link for the keyboard and
// screen readers. Read only: nothing here writes stub rows.

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

test("test_441_a_click_anywhere_on_a_row_opens_the_companion", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/companions");
  const row = page.getByRole("row", { name: "J. Robert Oppenheimer" });
  await expect(row.getByRole("link", { name: "J. Robert Oppenheimer" })).toBeVisible();
  // The Mode cell holds no link of its own: a real mouse click on its middle lands on the name's
  // link, which covers the row.
  const box = await row.getByRole("cell", { name: "Historical" }).boundingBox();
  if (!box) throw new Error("the Mode cell is not drawn");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/admin\/companions\/oppenheimer$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("J. Robert Oppenheimer");
});

test("test_441_names_are_bold_text_and_no_new_character_button", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions");
  const name = page.getByRole("link", { name: "J. Robert Oppenheimer" });
  await expect(name).toHaveCSS("text-decoration-line", "none");
  await expect(name).toHaveCSS("font-weight", "700");
  // Nothing creates a Companion yet (#339 is Later), so the prototype's button is not built.
  await expect(page.getByRole("button", { name: "New character" })).toHaveCount(0);
  // A Companion with no story stays "Not ready" (owner decision in #441).
  await expect(
    page.getByRole("row", { name: "Professor Moriarty" }).getByText("Not ready"),
  ).toBeVisible();
});
