import { expect, test } from "@playwright/test";

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
