import { expect, test } from "@playwright/test";

// The e2e server has PROTOTYPE_ENABLED=1 and placeholder Supabase values, so nobody is signed in.
// The signed-in save itself is covered by tests/start-goal.test.ts (CI has no account).

test("#32 /goal sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/goal");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test("#32 AC6 Start on /try calls no server action, so nothing reaches the account", async ({
  page,
}) => {
  await page.goto("/try/goal");
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Your goal").fill("Revise chapter four");
  await page.getByRole("button", { name: "Just split it" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();

  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/try\/focus$/);
  expect(posts.filter((url) => new URL(url).pathname === "/try/goal")).toEqual([]);
});
