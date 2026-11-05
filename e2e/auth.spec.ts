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
  await expect(page.getByRole("link", { name: "Reset your password" })).toHaveAttribute(
    "href",
    "/auth/forgot-password",
  );
});

test("a signed-out visitor is redirected from the product route", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});
