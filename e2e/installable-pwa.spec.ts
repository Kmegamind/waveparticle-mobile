import { expect, test } from "@playwright/test";

const portraitWidths = [320, 430] as const;
const screens = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/auth/update-password",
] as const;

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      root: root.scrollWidth - root.clientWidth,
      body: body.scrollWidth - body.clientWidth,
    };
  });
}

test("US-PLAT-1 the app can be installed with a name, an icon and a standalone window", async ({
  page,
}) => {
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    name: string;
    short_name: string;
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; type: string }[];
  };

  expect(manifest.name).toBe("WaveParticle");
  expect(manifest.short_name).toBe("WaveParticle");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );

  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(icon.src);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"] ?? "").toContain("image/png");
  }

  await page.goto("/auth/sign-in");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /.+/);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
});

test("US-PLAT-1 portrait widths from 320 to 430 do not scroll sideways", async ({ page }) => {
  for (const width of portraitWidths) {
    await page.setViewportSize({ width, height: 700 });
    for (const path of screens) {
      await page.goto(path);
      const overflow = await horizontalOverflow(page);
      expect(overflow.root, `${path} at ${width}px`).toBeLessThanOrEqual(1);
      expect(overflow.body, `${path} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test("US-PLAT-1 a wider screen keeps the phone layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/auth/sign-in");

  const shell = await page.locator(".app-shell").boundingBox();
  const tabBar = await page.locator(".app-tab-bar").boundingBox();
  expect(shell?.width ?? 999).toBeLessThanOrEqual(430);
  expect(tabBar?.width ?? 999).toBeLessThanOrEqual(430);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.locator(".app-tab")).toHaveCount(4);
});
