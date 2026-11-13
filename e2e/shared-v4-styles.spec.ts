import { expect, test, type Page } from "@playwright/test";

// Shared styling from prototype version 4, issue #240, at the prototype's phone size.
test.use({ viewport: { width: 390, height: 800 } });

async function loadedFamilies(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family);
  });
}

test("#240 C1 the typefaces are loaded on sign in", async ({ page }) => {
  await page.goto("/auth/sign-in");
  const families = await loadedFamilies(page);
  const distinct = new Set(families.map((family) => family.toLowerCase().replace(/['"]/g, "")));

  expect(families.some((family) => /atkinson hyperlegible next/i.test(family))).toBe(true);
  expect(families.some((family) => /bricolage/i.test(family))).toBe(true);
  expect(distinct.size).toBeGreaterThanOrEqual(2);
  const title = await page
    .locator("h1")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(title).toMatch(/bricolage/i);
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    test(`#240 C2 C3 sign in uses the paper-tag filled button (${colorScheme})`, async ({
      page,
    }) => {
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

test("#240 C9 text links are ink, 15 pixels, bold, underlined", async ({ page }) => {
  await page.goto("/auth/sign-in");
  const style = await page.getByRole("link", { name: "Create an account" }).evaluate((element) => {
    const computed = getComputedStyle(element);
    return [computed.color, computed.fontSize, computed.fontWeight, computed.textDecorationLine];
  });
  expect(style).toEqual(["rgb(27, 26, 25)", "15px", "700", "underline"]);
});

async function pageBackground(page: Page): Promise<{ color: string; image: string }> {
  return page.locator("body").evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.backgroundColor, image: computed.backgroundImage };
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} session skin`, () => {
    test.use({ colorScheme });

    test(`#240 C5 C6 the goal dialogue and focus page use the Oppenheimer skin (${colorScheme})`, async ({
      page,
    }) => {
      await page.goto("/try/goal");
      await expect(page.locator(".try-shell.skin-opp")).toHaveCount(1);
      const goal = await pageBackground(page);
      expect(goal.color).toBe("rgb(20, 13, 18)");
      expect(goal.image).toContain("rgb(18, 38, 26)");

      await page.goto("/try/focus");
      await expect(page.locator(".try-shell.skin-opp")).toHaveCount(1);
      expect((await pageBackground(page)).color).toBe("rgb(20, 13, 18)");
    });
  });
}

test("#240 C6 the test path start page keeps the Shell with its glow", async ({ page }) => {
  await page.goto("/try");
  await expect(page.locator(".skin-opp")).toHaveCount(0);
  const start = await pageBackground(page);
  expect(start.color).toBe("rgb(234, 233, 231)");
  expect(start.image).toContain("rgb(207, 231, 211)");
});

test("#240 C5 text on a session page uses the skin's ink", async ({ page }) => {
  await page.goto("/try/goal");
  const color = await page.locator("main").evaluate((element) => getComputedStyle(element).color);
  expect(color).toBe("rgb(241, 237, 240)");
});

for (const path of ["/auth/sign-in", "/safety"]) {
  test(`#240 C7 C8 ${path} has no header and no tab bar`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".app-header")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  });
}

test("#240 C1 page titles are heavy Bricolage Grotesque", async ({ page }) => {
  await page.goto("/auth/sign-in");
  const style = await page.locator("h1").evaluate((element) => {
    const computed = getComputedStyle(element);
    return [computed.fontWeight, computed.letterSpacing];
  });
  expect(style).toEqual(["800", "-0.8px"]);
});
