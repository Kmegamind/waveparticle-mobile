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

async function toPlan(page: Page) {
  await toSplit(page);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(planCard(page)).toBeVisible();
}

const planCard = (page: Page) => page.getByRole("group", { name: "Your steps" });

test.describe("the plan", () => {
  test("#237 AC1 the card starts with YOUR STEPS and an editable Goal field", async ({ page }) => {
    await toPlan(page);
    const card = planCard(page);
    await expect(card.locator(".try-over")).toHaveText("Your steps");
    await expect(card.locator(".try-over")).toHaveCSS("text-transform", "uppercase");
    const field = card.getByLabel("Goal", { exact: true });
    await expect(field).toHaveValue(/.+/);
    expect(Math.round((await box(field)).height)).toBe(48);
    await expect(field).toHaveAttribute("maxlength", "1000");
  });

  test("#237 AC2 rows have a number, title, minutes and arrows; no descriptions", async ({
    page,
  }) => {
    await toPlan(page);
    const card = planCard(page);
    const rows = card.locator(".try-step-button");
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator(".try-step-number")).toHaveText("1");
    const minutes = rows.first().locator(".try-minutes");
    await expect(minutes).toHaveText("30 min");
    await expect(minutes).toHaveCSS("font-family", /Atkinson Hyperlegible Mono/);
    await expect(card.getByText(/Put the notes and files/)).toHaveCount(0);
    const first = (await rows.first().locator(".try-step-title").textContent()) ?? "";
    const second = (await rows.nth(1).locator(".try-step-title").textContent()) ?? "";
    await expect(card.getByRole("button", { name: `Move up: ${first}` })).toBeDisabled();
    await expect(card.getByRole("button", { name: `Move down: ${second}` })).toBeDisabled();
    const arrow = card.getByRole("button", { name: `Move down: ${first}` });
    const drawn = await box(arrow);
    expect(Math.round(drawn.width)).toBe(40);
    expect(Math.round(drawn.height)).toBe(26);
    // The 44 by 44 hit area comes from a transparent ::before around the drawn box.
    const hit = await arrow.evaluate((element) => {
      const before = getComputedStyle(element, "::before");
      return { content: before.content, inset: before.inset };
    });
    expect(hit.content).not.toBe("none");
    await arrow.click();
    await expect(rows.first().locator(".try-step-title")).toHaveText(second);
    await expect(rows.first().locator(".try-step-number")).toHaveText("1");
  });

  test("#237 AC3 Add a step and the count share a row; Split again is centred in the card", async ({
    page,
  }) => {
    await toPlan(page);
    const card = planCard(page);
    const add = await box(card.getByRole("button", { name: "+ Add a step" }));
    const count = await box(card.getByText("2 steps · 60 min"));
    expect(Math.abs(add.y + add.height / 2 - (count.y + count.height / 2))).toBeLessThan(6);
    const again = await box(card.getByRole("button", { name: "Split again" }));
    const cardBox = await box(card);
    expect(Math.abs(again.x + again.width / 2 - (cardBox.x + cardBox.width / 2))).toBeLessThan(4);
  });

  test("#237 AC4 AC5 his line, then Start as a full-width paper tag pinned at the bottom", async ({
    page,
  }) => {
    await toPlan(page);
    await expect(page.locator(".try-slip").last()).toHaveText(
      "Here is how I would cut it. Argue with it now, in ink, where it’s cheap.",
    );
    const start = dock(page).getByRole("button", { name: "Start", exact: true });
    const startBox = await box(start);
    expect(startBox.width).toBeGreaterThan(340);
    expect(Math.round(startBox.height)).toBe(56);
    expect(startBox.y + startBox.height).toBeGreaterThan(760);
  });

  test("#249 AC1 AC2 AC3 the editor moves minutes by 5, takes typed minutes, keeps 1 as the floor", async ({
    page,
  }) => {
    await toPlan(page);
    const card = planCard(page);
    await card.locator(".try-step-button").first().click();
    await expect(card.locator(".try-step-open")).toContainText("Editing");
    await expect(card.getByLabel("Step title")).toHaveAttribute("maxlength", "200");
    const more = card.getByRole("button", { name: "Five minutes more" });
    expect((await box(more)).width).toBeGreaterThanOrEqual(44);
    await more.click();
    await expect(card).toContainText("2 steps · 65 min");
    const minutes = card.getByRole("spinbutton", { name: "Minutes" });
    await minutes.fill("1");
    await minutes.blur();
    await expect(card).toContainText("2 steps · 31 min");
    const fewer = card.getByRole("button", { name: "Five minutes fewer" });
    await expect(fewer).toHaveAttribute("aria-disabled", "true");
    await expect(card.getByText("A Step is at least 1 minute.")).toBeVisible();
    await fewer.click({ force: true });
    await expect(card).toContainText("2 steps · 31 min");
    await minutes.fill("2000");
    await minutes.blur();
    await expect(card).toContainText("2 steps · 1470 min");
    await expect(card.getByText("A Step is at most 24 hours.")).toBeVisible();
    await expect(card.getByRole("button", { name: "Remove step" })).toHaveClass(/try-link/);
    await card.getByRole("button", { name: "Done editing" }).click();
    await expect(card.getByLabel("Step title")).toHaveCount(0);
  });

  test("#237 an emptied Goal field starts the focus page with the typed goal", async ({ page }) => {
    await toPlan(page);
    await planCard(page).getByLabel("Goal", { exact: true }).fill("   ");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page).toHaveURL(/\/try\/focus$/);
    await expect(page.locator(".focus-panel-goal")).toHaveText(GOAL);
  });

  test("#237 a renamed Goal is what the focus page shows", async ({ page }) => {
    await toPlan(page);
    await planCard(page).getByLabel("Goal", { exact: true }).fill("Methods, first draft");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.locator(".focus-panel-goal")).toHaveText("Methods, first draft");
  });

  test("#237 crisis words in the Goal field open the safety page", async ({ page }) => {
    await toPlan(page);
    await planCard(page).getByLabel("Goal", { exact: true }).fill("I want to kill myself");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  });

  test("GD-F the failed split is a system box with three ways forward", async ({ page }) => {
    await openDialogue(page);
    await page.getByLabel("Your goal").fill("Write the report [fail-split]");
    await page.getByRole("button", { name: "Just split it" }).click();
    const alert = page.getByRole("alert", { name: "That one wouldn’t split." });
    await expect(alert.getByRole("heading", { name: "That one wouldn’t split." })).toBeVisible();
    await expect(alert).toHaveCSS("border-radius", "18px");
    await expect(alert.getByRole("button", { name: "Try again" })).toHaveClass(/button-filled/);
    await expect(alert.getByRole("button", { name: "Use one step" })).toHaveClass(/button-gray/);
    await expect(alert.getByRole("button", { name: "Change my line" })).toHaveClass(/try-link/);
  });
});
