import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/account";

// #480 (US-GM-9 AC4): Replay intro on Me, against the Supabase stub.

const storage = (page: Page) =>
  page.evaluate(() => JSON.stringify(Object.entries(window.localStorage).sort()));

test("#480 Replay intro plays the slides and Next reaches the last one", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await page.goto("/me");
  await page.getByRole("link", { name: "Replay intro" }).click();
  await expect(page).toHaveURL(/\/me\/intro$/);
  await expect(page.getByText(/^1 of \d$/)).toBeVisible();
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toBeVisible();
  const next = page.getByRole("button", { name: "Next" });
  while (await next.isVisible()) {
    await next.click();
    // Focus follows to the new heading, also on the last slide where Next becomes Done.
    await expect(title).toBeFocused();
  }
  await expect(page.getByRole("link", { name: "Done" })).toBeVisible();
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/me$/);
});

test("#480 Replay intro can be skipped at once and nothing about the person changes", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await page.goto("/me");
  await expect(page.getByRole("group", { name: "Appearance" })).toBeVisible();
  await page.getByRole("button", { name: "Night" }).click();
  const before = await storage(page);
  await page.getByRole("link", { name: "Replay intro" }).click();
  await page.getByRole("link", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("button", { name: "Night" })).toHaveAttribute("aria-pressed", "true");
  expect(await storage(page)).toBe(before);
});

test("#480 the intro page sends a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/me/intro");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});
