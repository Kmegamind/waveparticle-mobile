import { expect, test, type Locator, type Page } from "@playwright/test";

// Issue #263: the goal dialogue (#234 to #237) and the focus page (#238) as prototype v4, at the
// prototype's phone size. The e2e server has no model keys, so /try uses its labelled test data.
// /goal and /focus render the same components; their sign-in redirect is tested elsewhere.

const GOAL = "Methods section for Friday";

async function openDialogue(page: Page) {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/try/goal");
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
}

async function toTime(page: Page) {
  await openDialogue(page);
  await page.getByLabel("Your goal").fill(GOAL);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("slider", { name: "Your time" })).toBeVisible();
}

async function toSplit(page: Page) {
  await toTime(page);
  await page.getByRole("slider", { name: "Your time" }).fill("60");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("button", { name: "Keep it broad" })).toBeVisible();
}

const dock = (page: Page) => page.locator(".try-dock");

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error("no box");
  return value;
}

test.describe("goal dialogue", () => {
  test("#234 AC1 the header shows back, his 40 px portrait and his name", async ({ page }) => {
    await openDialogue(page);
    const bar = page.locator(".try-dialogue-bar");
    await expect(bar.getByRole("link", { name: "Back" })).toBeVisible();
    await expect(bar.locator("img")).toHaveAttribute("src", "/companions/oppenheimer.png");
    const portrait = await box(bar.locator(".try-avatar"));
    expect(Math.round(portrait.width)).toBe(40);
    expect(Math.round(portrait.height)).toBe(40);
    await expect(bar.getByText("Oppenheimer", { exact: true })).toBeVisible();
  });

  test("#234 AC2 the composer sits at the bottom with a 52 px paper-tag Send", async ({ page }) => {
    await openDialogue(page);
    const field = page.getByLabel("Your goal");
    await expect(field).toHaveAttribute("placeholder", "Say it in one line");
    await expect(field).toHaveCSS("border-radius", "14px");
    const send = await box(page.getByRole("button", { name: "Send" }));
    expect(Math.round(send.width)).toBe(52);
    expect(Math.round(send.height)).toBe(52);
    await expect(page.getByRole("button", { name: "Send" })).toHaveCSS("border-radius", "14px");
    const dockBox = await box(dock(page));
    expect(dockBox.y + dockBox.height).toBeGreaterThan(776);
    const link = await box(page.getByRole("button", { name: "Just split it" }));
    expect(Math.abs(link.x + link.width / 2 - 195)).toBeLessThan(4);
  });

  test("#234 AC3 his slip leaves space on the right", async ({ page }) => {
    await openDialogue(page);
    const slip = await box(page.locator(".try-slip").first());
    expect(slip.width).toBeLessThan(330);
    expect(slip.width).toBeGreaterThan(310);
  });

  test("#235 AC1 AC2 AC3 one slip, a surface bubble, and the time controls at the bottom", async ({
    page,
  }) => {
    await toTime(page);
    const slips = page.locator(".try-slip");
    await expect(slips).toHaveCount(2);
    await expect(slips.nth(1)).toHaveText(/^That .+\. How long do you have\?$/);
    const mine = page.locator(".try-you").first();
    await expect(mine).toHaveText(GOAL);
    await expect(mine).toHaveCSS("border-radius", "16px 16px 4px");
    await expect(dock(page).getByRole("slider", { name: "Your time" })).toBeVisible();
    await expect(dock(page).getByRole("button", { name: "Not sure" })).toHaveCSS(
      "border-radius",
      "12px",
    );
    await expect(page.getByRole("button", { name: "Just split it" })).toHaveCount(0);
  });

  test("#236 AC1 AC2 the answer reads 60 min and the choices are chips at the bottom", async ({
    page,
  }) => {
    await toSplit(page);
    await expect(page.locator(".try-you").last()).toHaveText("60 min");
    await expect(page.locator(".try-slip").last()).toHaveText(
      "Do you want it cut fine, or kept in a few broad pieces?",
    );
    await expect(page.getByText("Then I will keep to the same span.")).toHaveCount(0);
    for (const name of ["Split it finer", "Keep it broad"]) {
      const chip = dock(page).getByRole("button", { name });
      await expect(chip).toHaveClass(/try-chip/);
      await expect(chip).toHaveCSS("border-radius", "12px");
    }
  });

  test("#236 a long thread keeps the dock pinned and the newest turn in view", async ({ page }) => {
    await toSplit(page);
    const dockBox = await box(dock(page));
    expect(dockBox.y + dockBox.height).toBeGreaterThan(776);
    await expect(page.locator(".try-slip").last()).toBeInViewport();
  });

  test("#235 Not sure answers with the prototype's line", async ({ page }) => {
    await toTime(page);
    await page.getByRole("button", { name: "Not sure" }).click();
    await expect(page.locator(".try-you").last()).toHaveText("Not sure");
    await expect(
      page.getByText("Then thirty minutes. Long enough to start, short enough to keep."),
    ).toBeVisible();
  });

  test("GOAL-TIME the time read from the line is a caption with Change", async ({ page }) => {
    await openDialogue(page);
    await page.getByLabel("Your goal").fill("Write the methods for 45 minutes");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("status")).toHaveText("Time I understood from your line: 45 min.");
    await expect(page.locator(".try-slip")).toHaveCount(2);
    await expect(page.getByText(/How long do you have/)).toHaveCount(0);
    const change = page.getByRole("button", { name: "Change time" });
    await expect(change).toHaveText("Change");
    await change.click();
    await expect(page.locator(".try-slip").nth(1)).toHaveText(/How long do you have\?$/);
    await expect(page.getByRole("slider", { name: "Your time" })).toHaveValue("45");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator(".try-you").last()).toHaveText("45 min");
    await expect(page.getByText(/Time I understood/)).toHaveCount(0);
  });
});
