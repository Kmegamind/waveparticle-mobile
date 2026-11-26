import { expect, test, type Page } from "@playwright/test";
import { PREFS_KEY } from "../src/lib/me/prefs";
import { signIn } from "./support/account";

// #490: right after Me or Signals loads, the device settings controls show what is stored, and a
// tap acts on what is stored. The CI failure only appeared on a slow machine, so these tests slow
// the page down: Chromium with the CPU throttled 20 times through the DevTools protocol (WebKit has
// no such switch, so this file runs in Chromium only). Before the fix the first test failed in
// about 2 runs out of 3; after it the result no longer depends on timing.
test.use({ browserName: "chromium" });

async function slowCpu(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
}

const storedPrefs = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PREFS_KEY);

async function turnPlainTextOn(page: Page) {
  await page.goto("/me");
  const plainText = page.getByRole("switch", { name: "Plain text" });
  await plainText.click();
  await expect(plainText).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("me-setting-announce")).toHaveText("Plain text on.");
}

test("#490 right after a reload, Plain text shows On and a tap turns it off", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await turnPlainTextOn(page);
  await slowCpu(page);

  await page.goto("/me");
  // Tapped at once, with no wait for the page to settle: this is the moment the CI run hit.
  const plainText = page.getByRole("switch", { name: "Plain text" });
  await plainText.click();
  await expect(page.getByTestId("me-setting-announce")).toHaveText("Plain text off.");
  await expect(plainText).toHaveAttribute("aria-checked", "false");
  await expect(plainText).toHaveText("Off");
  expect(await page.evaluate(() => document.documentElement.classList.contains("plain-text"))).toBe(
    false,
  );
  expect((await storedPrefs(page)).plainText).toBe(false);
});

test("#490 right after a reload, before any tap, the Plain text switch shows the stored state", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await turnPlainTextOn(page);
  await slowCpu(page);
  // Reading storage during hydration must not make React report a mismatch (in a production build
  // that is a minified error 418, 423 or 425).
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/me");
  const plainText = page.getByRole("switch", { name: "Plain text" });
  await expect(plainText).toHaveAttribute("aria-checked", "true");
  await expect(plainText).toHaveText("On");
  await expect(page.getByTestId("me-setting-announce")).toHaveText("");
  expect(errors.filter((text) => /hydrat|#418|#423|#425/i.test(text))).toEqual([]);
});

test("#490 a signal tap right after a reload flips the stored signal and keeps Plain text on", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await turnPlainTextOn(page);
  await page.goto("/me/signals");
  const newCard = page.getByRole("switch", { name: "New-card signal" });
  await newCard.click();
  await expect(newCard).toHaveAttribute("aria-checked", "true");
  await slowCpu(page);

  await page.goto("/me/signals");
  // Tapped at once: the stored value is on, so the tap turns it off.
  await page.getByRole("switch", { name: "New-card signal" }).click();
  await expect(page.getByRole("switch", { name: "New-card signal" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(await storedPrefs(page)).toMatchObject({
    plainText: true,
    signals: { newCard: false },
  });
  expect(await page.evaluate(() => document.documentElement.classList.contains("plain-text"))).toBe(
    true,
  );
});
