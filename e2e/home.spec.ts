import { expect, test } from "@playwright/test";

test("a visitor opens the app and sees the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "WaveParticle" })).toBeVisible();
  await expect(page).toHaveTitle(/WaveParticle/);
});
