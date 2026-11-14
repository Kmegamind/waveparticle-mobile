import { expect, test } from "@playwright/test";

// Issue #258. The e2e servers have no account, so the signed-in screens are reached only as far as
// sign-in; their logic is covered by tests/finish-run.test.ts and tests/life-path.test.ts.

test("#258 AC1 /end sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/end");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test("#258 AC7 the Life Path sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/companions/oppenheimer");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test("#258 the focus page's /try/end no longer answers 404 when signed out", async ({ page }) => {
  const response = await page.goto("/try/end");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("There is no summary to show.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go back to the test home" })).toHaveAttribute(
    "href",
    "/try",
  );
});
