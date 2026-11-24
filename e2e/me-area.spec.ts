import { expect, test } from "@playwright/test";

// #81: the Me area's child pages need an account; the e2e server has none, so they send a
// signed-out visitor to sign in. The screens are covered by tests/me-*.test.ts.
for (const path of ["/me/signals", "/me/country", "/me/history/x", "/me/history/x/chapter"]) {
  test(`#81 ${path} sends a signed-out visitor to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });
}
