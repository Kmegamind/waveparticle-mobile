import { expect, test, type Page } from "@playwright/test";

// Shared styling from prototype version 4, issue #240, at the prototype's phone size.
test.use({ viewport: { width: 390, height: 800 } });

async function loadedFamilies(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((face) => face.status === "loaded").map((face) => face.family);
  });
}

test("#240 C1 the typefaces are loaded on sign in", async ({ page }) => {
  await page.goto("/auth/sign-in");
  const families = await loadedFamilies(page);
  const distinct = new Set(families.map((family) => family.toLowerCase().replace(/['"]/g, "")));

  expect(families.some((family) => /atkinson hyperlegible next/i.test(family))).toBe(true);
  expect(families.some((family) => /bricolage/i.test(family))).toBe(true);
  expect(distinct.size).toBeGreaterThanOrEqual(2);
  const title = await page.locator("h1").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(title).toMatch(/bricolage/i);
});
