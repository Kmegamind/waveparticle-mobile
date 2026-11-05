import { expect, test } from "@playwright/test";

const screens = [
  { path: "/", title: "Home" },
  { path: "/companions", title: "Companions" },
  { path: "/goals", title: "Goals" },
  { path: "/me", title: "Me" },
] as const;

test("a user can walk the four top-level tabs", async ({ page }) => {
  for (const screen of screens) {
    await page.goto(screen.path);

    await expect(page.getByRole("heading", { name: screen.title, level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: screen.title, exact: true }).getAttribute("aria-current"),
    ).resolves.toBe("page");
  }
});

test("the app shell keeps navigation keyboard accessible at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation).toBeVisible();

  for (const screen of screens.slice(1)) {
    await page.getByRole("link", { name: screen.title, exact: true }).focus();
    await expect(page.getByRole("link", { name: screen.title, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${screen.path}$`));
  }
});
