import { expect, test } from "@playwright/test";

// The e2e server runs with PROTOTYPE_ENABLED=1 (playwright.config.ts).

test("#208 AC2 a signed-out visitor can open the test path", async ({ page }) => {
  await page.goto("/try");
  await expect(page).toHaveURL(/\/try$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("#208 AC3 the test path shows a Test build label and no account tab bar", async ({ page }) => {
  await page.goto("/try");
  await expect(page.getByText("Test build", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
});

test("#208 AC4 progress survives a reload and Reset test data clears it", async ({ page }) => {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate(() => {
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Write the report", minutes: 60 },
        steps: [],
        currentStep: 0,
      }),
    );
  });
  await page.reload();
  await expect(page.getByText("Write the report")).toBeVisible();

  await page.getByRole("button", { name: "Reset test data" }).click();
  await expect(page.getByText("Write the report")).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByText("Write the report")).toHaveCount(0);
});
