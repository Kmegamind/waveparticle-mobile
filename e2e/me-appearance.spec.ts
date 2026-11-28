import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/account";

// #83 (US-GM-9): Appearance (Day, Night, System), Plain text and reduced motion on Me, against the
// Supabase stub. Replay intro is in e2e/me-replay-intro.spec.ts.

const LIGHT_BG = "#eae9e7";
const DARK_BG = "#110f0d";

const pageBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--bg").trim());
const rootClasses = (page: Page) =>
  page.evaluate(() => Array.from(document.documentElement.classList));

/** Stops every Next.js script, so only the inline first-paint script in <head> runs. */
async function withoutAppScripts(page: Page) {
  await page.route(/\/_next\/static\/chunks\/.*\.js/, (route) => route.abort());
}

async function openMe(page: Page) {
  await page.goto("/me");
  const appearance = page.getByRole("group", { name: "Appearance" });
  await expect(appearance).toBeVisible();
  return appearance;
}

test.describe("dark device", () => {
  test.use({ colorScheme: "dark" });

  test("#83 AC1 System is the default and follows the device; Day overrides it", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    const appearance = await openMe(page);
    await expect(appearance.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const name of ["Day", "Night"]) {
      await expect(appearance.getByRole("button", { name })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    expect(await pageBg(page)).toBe(DARK_BG);

    // By keyboard: a tap does not focus a button in mobile Safari.
    const day = appearance.getByRole("button", { name: "Day" });
    await day.focus();
    await page.keyboard.press("Enter");
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(day).toBeFocused();
    expect(await pageBg(page)).toBe(LIGHT_BG);
    await expect(page.getByTestId("me-setting-announce")).toHaveText("Appearance: Day.");
  });
});

test.describe("light device", () => {
  test.use({ colorScheme: "light" });

  test("#83 AC1 Night is applied at once and again before the first paint after a reload", async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    const appearance = await openMe(page);
    expect(await pageBg(page)).toBe(LIGHT_BG);
    await appearance.getByRole("button", { name: "Night" }).click();
    expect(await pageBg(page)).toBe(DARK_BG);
    await expect(page.getByTestId("me-setting-announce")).toHaveText("Appearance: Night.");

    // With the app's scripts blocked, React never runs: the dark page comes from the <head>
    // script alone, so there is no light flash before hydration.
    await withoutAppScripts(page);
    await page.goto("/me");
    expect(await rootClasses(page)).toContain("theme-dark");
    expect(await pageBg(page)).toBe(DARK_BG);
    await page.unrouteAll();

    // Other pages keep the choice; System goes back to the device.
    await page.goto("/goals");
    expect(await pageBg(page)).toBe(DARK_BG);
    await (await openMe(page)).getByRole("button", { name: "System" }).click();
    expect(await pageBg(page)).toBe(LIGHT_BG);
    expect(await rootClasses(page)).not.toContain("theme-dark");
  });
});

test("#83 AC2 Plain text swaps the hand font and marks for the body face and straight lines", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await openMe(page);
  // No screen uses the hand layer yet (DESIGN.md 3.6), so the page gets one label and one mark,
  // with the same markup as src/app/hand-layer.tsx.
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "hand-probe";
    host.innerHTML =
      '<span class="hand" id="probe-label">Now</span>' +
      '<svg aria-hidden="true" class="mark-svg" id="probe-mark" preserveAspectRatio="none" viewBox="0 0 100 8" style="width:120px;height:10px">' +
      '<path class="mark-hand" d="M2 5 C 18 2, 34 7, 52 4 S 84 3, 98 5"/>' +
      '<path class="mark-straight" d="M2 4 H 98"/></svg>';
    document.body.append(host);
  });
  const probe = () =>
    page.evaluate(() => {
      const label = getComputedStyle(document.getElementById("probe-label")!);
      const mark = document.getElementById("probe-mark")!;
      const shown = (name: string) =>
        getComputedStyle(mark.querySelector(name)!).display !== "none";
      const box = mark.getBoundingClientRect();
      return {
        font: label.fontFamily,
        hand: shown(".mark-hand"),
        straight: shown(".mark-straight"),
        box: [Math.round(box.width), Math.round(box.height)],
      };
    });

  const before = await probe();
  expect(before.font).toMatch(/^"?Shantell Sans/);
  expect(before).toMatchObject({ hand: true, straight: false });

  const toggle = page.getByRole("switch", { name: "Plain text" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(toggle).toBeFocused();
  await expect(page.getByTestId("me-setting-announce")).toHaveText("Plain text on.");
  expect(await rootClasses(page)).toContain("plain-text");

  const after = await probe();
  expect(after.font).not.toMatch(/Shantell/);
  expect(after.font).toMatch(/Atkinson/);
  expect(after).toMatchObject({ hand: false, straight: true });
  // The mark keeps its box, so the layout does not move.
  expect(after.box).toEqual(before.box);

  // Kept on this device and applied before the first paint.
  await withoutAppScripts(page);
  await page.goto("/me");
  expect(await rootClasses(page)).toContain("plain-text");
  await page.unrouteAll();

  await openMe(page);
  await page.getByRole("switch", { name: "Plain text" }).click();
  await expect(page.getByTestId("me-setting-announce")).toHaveText("Plain text off.");
  expect(await rootClasses(page)).not.toContain("plain-text");
});

/** Every element whose animation or transition lasts longer than a hundredth of a second. */
async function movingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seconds = (value: string) =>
      Math.max(
        ...value.split(",").map((part) => {
          const number = parseFloat(part);
          return part.trim().endsWith("ms") ? number / 1000 : number;
        }),
      );
    const found: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        const animates = style.animationName !== "none" && seconds(style.animationDuration) > 0.01;
        const transitions =
          style.transitionProperty !== "none" && seconds(style.transitionDuration) > 0.01;
        if (animates || transitions) {
          found.push(`${element.tagName.toLowerCase()}.${element.className}${pseudo ?? ""}`);
        }
      }
    }
    return found;
  });
}

test("#83 AC3 with reduced motion nothing on Me and its pages animates or transitions", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  // Without the device setting Me does have transitions (Sign out), so the check below means something.
  await page.goto("/me");
  await expect(page.locator("main").first()).toBeVisible();
  expect((await movingElements(page)).length).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/me", "/me/signals", "/me/country", "/me/about", "/me/data"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await movingElements(page), path).toEqual([]);
  }
  // After a setting change, too.
  await page.goto("/me");
  await page
    .getByRole("group", { name: "Appearance" })
    .getByRole("button", { name: "Night" })
    .click();
  await page.getByRole("button", { name: "History" }).click();
  expect(await movingElements(page)).toEqual([]);
});
