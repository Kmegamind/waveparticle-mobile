import { expect, test } from "@playwright/test";

test("a signed-out visitor can open sign in and the auth links", async ({ page }) => {
  await page.goto("/auth/sign-in");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/auth/sign-up",
  );
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/auth/forgot-password",
  );
  await expect(page.getByRole("link", { name: "Privacy notice" })).toHaveAttribute(
    "href",
    "/privacy",
  );
});

test("#262 #102 a signed-out visitor can open the privacy notice", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await expect(page.getByText("Last changed: November 23, 2026")).toBeVisible();
});

test("#262 the account screens fit a 320 pixel wide phone without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of [
    "/auth/sign-in",
    "/auth/sign-up",
    "/auth/forgot-password",
    "/auth/update-password",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("a signed-out visitor is redirected from the product route", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});
