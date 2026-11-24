import { expect, test, type Page } from "@playwright/test";

// Send is disabled until React has hydrated the form (#204), so these tests wait until the form
// is ready before pressing it. The page scripts are delayed on purpose, so this wait matters on
// every run and not only on a slow CI machine.
async function openStep(page: Page) {
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto("/safety");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
}

test("a crisis message opens the system page and back clears the field", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openStep(page);

  const message = page.getByLabel("Message");
  await message.fill("I want to kill myself");
  await page.getByRole("button", { name: "Send" }).click();

  const crisis = page.locator("main.crisis-page");
  await expect(crisis.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  // #398: focus moves to the S1 title, so a screen reader announces it.
  await expect(crisis.getByRole("heading", { name: "This is outside the story." })).toBeFocused();
  await expect(
    crisis.getByText("PLACEHOLDER: legal body text is not available yet."),
  ).toBeVisible();
  await expect(page.getByText("I want to kill myself")).toHaveCount(0);
  await expect(crisis).not.toContainText(/companion/i);
  await expect(crisis).not.toContainText(/tape/i);

  const font = await crisis.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(font.toLowerCase()).not.toContain("newsreader");
  expect(font.toLowerCase()).not.toContain("georgia");

  // #118: a signed-out visitor has no country, so S1 is S1-0 and Get support now opens the
  // directory (the S1 states are in e2e/hotlines.spec.ts).
  const support = crisis.getByRole("link", { name: "Get support now" });
  await expect(support).toHaveClass(/button-filled/);
  await expect(support).toHaveAttribute("href", "https://findahelpline.com");

  const back = crisis.getByRole("button", { name: "Back to my Goal" });
  await expect(back).toHaveClass(/button-tinted/);
  const backBox = await back.boundingBox();
  expect(backBox?.height).toBeGreaterThanOrEqual(44);

  await back.click();
  await expect(page.getByRole("heading", { name: "Step", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveValue("");
});

test("ordinary pressure stays on the step and keeps the field", async ({ page }) => {
  await openStep(page);
  await page.getByLabel("Message").fill("This deadline is killing me");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { name: "Step", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveValue("This deadline is killing me");
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toHaveCount(0);
});

// Issue #204: on a slow network the user can type and press Send before the page scripts load.
// The script chunks are held back until the test releases them, so the text is typed while the
// form is certainly not ready yet.
async function openStepBeforeScripts(page: Page) {
  let releaseScripts = () => {};
  const scriptsReleased = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  // Only the script chunks: the style chunks block rendering, and the text must be typed on a
  // visible page.
  const scriptChunk = (url: URL) =>
    url.pathname.startsWith("/_next/static/chunks/") && url.pathname.endsWith(".js");
  await page.route(scriptChunk, async (route) => {
    await scriptsReleased;
    await route.continue();
  });
  await page.goto("/safety", { waitUntil: "commit" });
  await expect(page.locator('form[data-ready="false"]')).toBeVisible();
  return releaseScripts;
}

test("text typed before the page scripts load is kept", async ({ page }) => {
  const releaseScripts = await openStepBeforeScripts(page);
  await page.getByLabel("Message").fill("This deadline is killing me");
  releaseScripts();

  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveValue("This deadline is killing me");
});

test("Send stays disabled, with a visible reason, until the page is ready", async ({ page }) => {
  const releaseScripts = await openStepBeforeScripts(page);
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  await expect(page.getByText("Send is ready once the page has loaded.")).toBeVisible();
  // A press before the page is ready does nothing: no reload, the field keeps its text.
  await page.getByLabel("Message").fill("I want to kill myself");
  await send.click({ force: true });
  await expect(page.getByLabel("Message")).toHaveValue("I want to kill myself");
  releaseScripts();

  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await expect(send).toBeEnabled();
  await expect(page.getByText("Send is ready once the page has loaded.")).toHaveCount(0);
});

test("a crisis message typed before the scripts load still opens the crisis page", async ({
  page,
}) => {
  const sent: string[] = [];
  page.on("request", (request) => {
    sent.push(`${request.url()} ${request.postData() ?? ""}`);
  });

  const releaseScripts = await openStepBeforeScripts(page);
  await page.getByLabel("Message").fill("I want to kill myself");
  releaseScripts();
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  await expect(page.getByText("I want to kill myself")).toHaveCount(0);
  // The crisis text never leaves the device.
  const leaked = sent.filter((line) => /kill(\+|%20| )myself/i.test(line));
  expect(leaked).toEqual([]);
});
