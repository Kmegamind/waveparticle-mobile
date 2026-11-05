import { expect, test } from "@playwright/test";

const screens = ["/", "/companions", "/goals", "/me"] as const;

test("signed-out visitors are redirected from the four top-level routes", async ({ page }) => {
  for (const path of screens) {
    await page.goto(path);

    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  }
});

test("the sign-in page keeps authentication links keyboard accessible at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/auth/sign-in");

  const signUpLink = page.getByRole("link", { name: "Create an account" });
  await signUpLink.focus();
  await expect(signUpLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/auth\/sign-up$/);
});
