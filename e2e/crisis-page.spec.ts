import { expect, test, type Page } from "@playwright/test";

// The Message field is controlled by React state. Text typed before React has hydrated the form
// is wiped at hydration, and Send then submits an empty message, so wait until the form is ready.
async function openStep(page: Page) {
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
  await expect(
    crisis.getByText("PLACEHOLDER: legal body text is not available yet."),
  ).toBeVisible();
  await expect(page.getByText("I want to kill myself")).toHaveCount(0);
  await expect(crisis).not.toContainText(/companion/i);
  await expect(crisis).not.toContainText(/tape/i);

  const font = await crisis.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(font.toLowerCase()).not.toContain("newsreader");
  expect(font.toLowerCase()).not.toContain("georgia");

  const support = crisis.getByRole("link", { name: "Get support now" });
  await expect(support).toHaveClass(/button-filled/);
  await expect(support).toHaveAttribute("href", "#region-resource");
  await support.click();
  await expect(
    crisis.getByText(
      "PLACEHOLDER: no regional support resource is listed in docs/DECISIONS.md or docs/CONTENT_MODEL.md.",
    ),
  ).toBeVisible();

  const back = crisis.getByRole("button", { name: "Back to my Step" });
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
