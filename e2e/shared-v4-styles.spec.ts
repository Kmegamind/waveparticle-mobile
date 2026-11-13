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

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    test(`#240 C2 C3 sign in uses the paper-tag filled button (${colorScheme})`, async ({ page }) => {
      await page.goto("/auth/sign-in");
      const button = page.getByRole("button", { name: "Sign in" });
      const style = await button.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          radius: computed.borderTopLeftRadius,
          height: element.getBoundingClientRect().height,
          weight: computed.fontWeight,
          spacing: computed.letterSpacing,
          border: computed.borderTopWidth,
          shadow: computed.boxShadow,
          background: computed.backgroundColor,
        };
      });
      expect(style.radius).toBe("14px");
      expect(style.height).toBeGreaterThanOrEqual(56);
      expect(style.weight).toBe("700");
      expect(style.spacing).toBe("normal");
      expect(style.border).toBe("1px");
      expect(style.shadow).toContain("0px 2px 0px 0px");
      expect(style.background).toBe(
        colorScheme === "light" ? "rgb(195, 224, 200)" : "rgb(161, 202, 168)",
      );
    });
  });
}

test("#240 C2 sign in has no horizontal scroll at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/auth/sign-in");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("#240 C4 the crisis page's second button is a secondary paper tag", async ({ page }) => {
  await page.goto("/safety");
  await page.locator("textarea, input").first().fill("test input: suicide");
  await page.getByRole("button", { name: "Send" }).click();
  const second = page.locator(".crisis-actions .button-tinted");
  await expect(second).toBeVisible();
  const style = await second.evaluate((element) => {
    const computed = getComputedStyle(element);
    return [computed.backgroundColor, computed.borderTopColor, computed.color];
  });
  expect(style).toEqual(["rgb(255, 255, 255)", "rgb(129, 128, 125)", "rgb(27, 26, 25)"]);
});
