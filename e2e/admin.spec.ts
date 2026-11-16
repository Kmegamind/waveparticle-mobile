import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #287: the content admin at /admin. The role comes from the Supabase stub's content_role().

const ADMIN_PATHS = [
  "/admin",
  "/admin/app-text",
  "/admin/publish-history",
  "/admin/stories",
  "/admin/stories/site-search",
  "/admin/no-such-page",
];

/** The visible text of the app's normal 404 page, for a path that never existed. */
async function normalNotFoundText(page: Page) {
  const response = await page.goto("/no-such-page-287");
  expect(response?.status()).toBe(404);
  return page.locator("body").innerText();
}

test("test_287_ac2_signed_out_gets_404", async ({ page }) => {
  for (const path of ADMIN_PATHS) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    expect(new URL(page.url()).pathname, path).toBe(path);
    await expect(page.getByText("Content admin")).toHaveCount(0);
  }
});

test("test_287_ac2_signed_in_without_a_role_gets_the_normal_404", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page));
  const normal = await normalNotFoundText(page);
  for (const path of ADMIN_PATHS) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    expect(await page.locator("body").innerText(), path).toBe(normal);
    await expect(page.getByText("Content admin")).toHaveCount(0);
  }
});

async function expectAdminShell(page: Page) {
  const menu = page.getByRole("navigation", { name: "Admin pages" });
  // The product name and "Content admin" (the app's own header, with its hidden logo text, does
  // not show inside the admin).
  const brand = page.getByRole("link", { name: "WaveParticle Content admin" });
  await expect(brand).toBeVisible();
  await expect(brand.getByText("WaveParticle", { exact: true })).toBeVisible();
  await expect(brand.getByText("Content admin", { exact: true })).toBeVisible();
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Content" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Review and logs" })).toBeAttached();
  await expect(menu.getByRole("link", { name: /App text/ })).toContainText("ADM-07");
  await expect(menu.getByRole("link", { name: /Publish history/ })).toContainText("ADM-12");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  // The app's own tab bar does not show inside the admin.
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
}

test("test_287_ac3_a_writer_sees_the_admin_shell", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  await expectAdminShell(page);

  const menu = page.getByRole("navigation", { name: "Admin pages" });
  await menu.getByRole("link", { name: /App text/ }).click();
  await expect(page).toHaveURL(/\/admin\/app-text$/);
  await expect(page.getByRole("heading", { level: 1, name: "App text" })).toBeVisible();
  // #288 replaced the placeholder with the App text editor.
  await expect(page.getByRole("region", { name: "ui.F3.fail.body" })).toBeVisible();
  await expect(menu.getByRole("link", { name: /App text/ })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await menu.getByRole("link", { name: /Publish history/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Publish history" })).toBeVisible();
  // #289 replaced the placeholder with the history list.
  await expect(page.getByText(/#289/)).toHaveCount(0);
});

test("test_287_ac3_an_admin_sees_the_admin_shell", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const response = await page.goto("/admin/publish-history");
  expect(response?.status()).toBe(200);
  await expectAdminShell(page);
});

test("test_287_ac3_sign_out_leaves_the_admin", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

for (const width of [360, 1280]) {
  test(`test_287_ac5_no_sideways_scroll_at_${width}_px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    for (const path of ["/admin", "/admin/app-text", "/admin/publish-history"]) {
      await page.goto(path);
      await expect(page.getByText("Content admin", { exact: true })).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, path).toBeLessThanOrEqual(width);
    }
  });
}
