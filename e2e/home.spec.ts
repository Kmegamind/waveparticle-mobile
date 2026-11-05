import { expect, test } from "@playwright/test";

test("a visitor opens the app and sees the Home title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WaveParticle" })).toBeVisible();
  await expect(page).toHaveTitle(/WaveParticle/);
});
