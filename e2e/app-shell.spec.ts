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

test("sign-in controls meet the 44px target and expose visible focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/auth/sign-in");

  const controls = page.locator("a, button, input");
  const sizes = await controls.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }),
  );
  expect(sizes.every(({ height, width }) => height >= 44 && width >= 44)).toBe(true);

  const signUpLink = page.getByRole("link", { name: "Create an account" });
  await signUpLink.focus();
  await expect(signUpLink).toBeFocused();
  await expect
    .poll(() => signUpLink.evaluate((element) => getComputedStyle(element).outlineStyle))
    .toBe("solid");
});
