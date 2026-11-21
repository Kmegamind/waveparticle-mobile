import { expect, test, type Locator, type Page } from "@playwright/test";
import { largeText, overflowReport } from "./support/large-text";

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

/** The touch area of each Move button, as the ::before box around the drawn button. */
async function moveTouchAreas(page: Page) {
  return planCard(page)
    .locator(".try-move button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const before = getComputedStyle(button, "::before");
        // An inset of -9px reaches 9px beyond the button; 0 stops at its edge.
        return {
          top: rect.top + parseFloat(before.top),
          bottom: rect.bottom - parseFloat(before.bottom),
          left: rect.left + parseFloat(before.left),
          right: rect.right - parseFloat(before.right),
        };
      }),
    );
}

type Area = { top: number; bottom: number; left: number; right: number };

/** Touch areas may touch but never overlap, so a tap always reaches the button it is on. */
function expectNoOverlap(areas: Area[]) {
  for (const [index, a] of areas.entries()) {
    for (const b of areas.slice(index + 1)) {
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(overlapX > 0.5 && overlapY > 0.5).toBe(false);
    }
  }
}

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

  test("#237 moving a Step with the keyboard keeps focus on it and says where it went", async ({
    page,
  }) => {
    await toPlan(page);
    const card = planCard(page);
    const rows = card.locator(".try-step-button");
    const first = (await rows.first().locator(".try-step-title").textContent()) ?? "";
    await card.getByRole("button", { name: `Move down: ${first}` }).focus();
    await page.keyboard.press("Enter");
    await expect(rows.nth(1).locator(".try-step-title")).toHaveText(first);
    // Now the last Step, so Move down is disabled: focus goes to its Move up button.
    await expect(card.getByRole("button", { name: `Move up: ${first}` })).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "moved" })).toHaveText(
      `${first} moved to step 2.`,
    );
    await page.keyboard.press("Enter");
    await expect(rows.first().locator(".try-step-title")).toHaveText(first);
    await expect(card.getByRole("button", { name: `Move down: ${first}` })).toBeFocused();
  });

  test("#111 each move button is 44 wide and 44 tall to touch (TAP-SIZE), and no two touch areas overlap", async ({
    page,
  }) => {
    await toPlan(page);
    const areas = await moveTouchAreas(page);
    expect(areas.length).toBe(4);
    for (const area of areas) {
      expect(Math.round(area.right - area.left)).toBe(44);
      expect(Math.round(area.bottom - area.top)).toBe(44);
    }
    expectNoOverlap(areas);
  });

  // #340: the buttons are stacked, as in prototype v4. Side by side they left the Step title 38 px
  // wide (7 lines for "Outline the methods section") at 320 px, and 28 px at 200% text.
  for (const scale of ["100%", "200%"]) {
    test(`#340 at 320 px and ${scale} text the Move buttons are stacked and stay inside the row`, async ({
      page,
    }) => {
      await toPlan(page);
      await page.setViewportSize({ width: 320, height: 640 });
      if (scale === "200%") await largeText(page);
      const rows = planCard(page).locator(".try-step-row");
      // The touch size is 2.75rem, so it follows the text size.
      const target = await page.evaluate(
        () => parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.75,
      );
      for (const row of await rows.all()) {
        const [up, down] = await row.locator(".try-move button").all();
        const upBox = await box(up);
        const downBox = await box(down);
        // Stacked: one above the other, in one column.
        expect(Math.abs(upBox.x - downBox.x)).toBeLessThan(1);
        expect(downBox.y).toBeGreaterThan(upBox.y + upBox.height - 1);
        // Each row is at least two touch sizes high (88 px at 100%).
        expect((await box(row)).height).toBeGreaterThanOrEqual(target * 2 - 1);
      }
      const areas = await moveTouchAreas(page);
      expect(areas.length).toBe(4);
      for (const area of areas) {
        expect(Math.round(area.right - area.left)).toBe(Math.round(target));
        expect(Math.round(area.bottom - area.top)).toBe(Math.round(target));
      }
      // No overlap between the two buttons of a row, or with the neighbouring row.
      expectNoOverlap(areas);
    });
  }

  test("#340 at 320 px a typical Step title is at most four lines (side by side it was seven)", async ({
    page,
  }) => {
    await toPlan(page);
    const card = planCard(page);
    const rows = card.locator(".try-step-button");
    // A typical title (27 characters), the one the large-text spec uses for its two-Step plan.
    const title = "Outline the methods section";
    await rows.first().click();
    await card.getByLabel("Step title").fill(title);
    await card.getByRole("button", { name: "Done editing" }).click();
    await expect(rows.first().locator(".try-step-title")).toHaveText(title);
    await page.setViewportSize({ width: 320, height: 640 });
    const measured = await rows
      .first()
      .locator(".try-step-title")
      .evaluate((element) => {
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, lines: Math.round(rect.height / lineHeight) };
      });
    expect(measured.width).toBeGreaterThan(70);
    expect(measured.lines).toBeLessThanOrEqual(4);
  });

  // #341: the owner's rule also asks for at most two lines at 200% text. Before #341 the Plan card
  // was 152 px wide inside there, so the number, minutes and arrows left the title 28 px (21 lines)
  // and the row ran past the card. Now the card gives up some padding and the title takes a line of
  // its own below the number and the minutes, with the stacked arrows beside those two.
  test("#340 #341 at 320 px and 200% text a typical Step title is at most two lines", async ({
    page,
  }) => {
    await toPlan(page);
    const card = planCard(page);
    const rows = card.locator(".try-step-button");
    const title = "Outline the methods section";
    await rows.first().click();
    await card.getByLabel("Step title").fill(title);
    await card.getByRole("button", { name: "Done editing" }).click();
    await expect(rows.first().locator(".try-step-title")).toHaveText(title);
    await page.setViewportSize({ width: 320, height: 640 });
    await largeText(page);
    const measured = await rows
      .first()
      .locator(".try-step-title")
      .evaluate((element) => {
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, lines: Math.round(rect.height / lineHeight) };
      });
    expect(measured.lines).toBeLessThanOrEqual(2);
    // Nothing in a Step row runs past the card's inner edge.
    const cardBox = await box(card);
    for (const row of await card.locator(".try-step-row").all()) {
      for (const part of await row.locator("*").all()) {
        const partBox = await box(part);
        expect(partBox.x).toBeGreaterThanOrEqual(cardBox.x);
        expect(partBox.x + partBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      }
    }
    expect(await overflowReport(page)).toEqual([]);
  });

  test("#341 at 375 px and 100% text the Step row keeps number, title and minutes on one line", async ({
    page,
  }) => {
    await toPlan(page);
    await page.setViewportSize({ width: 375, height: 800 });
    const row = planCard(page).locator(".try-step-row").first();
    const number = await box(row.locator(".try-step-number"));
    const title = await box(row.locator(".try-step-title"));
    const minutes = await box(row.locator(".try-minutes"));
    const move = await box(row.locator(".try-move"));
    // Side by side, left to right, as before #341: the narrow layout is for large text only.
    expect(title.x).toBeGreaterThan(number.x + number.width);
    expect(minutes.x).toBeGreaterThan(title.x + title.width - 1);
    expect(move.x).toBeGreaterThan(minutes.x + minutes.width);
    const middle = (b: { y: number; height: number }) => b.y + b.height / 2;
    expect(Math.abs(middle(number) - middle(minutes))).toBeLessThan(4);
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

  test("#234 AC1 the header stays at the top while the thread scrolls", async ({ page }) => {
    await toPlan(page);
    const bar = await box(page.locator(".try-dialogue-bar"));
    expect(bar.y).toBeGreaterThanOrEqual(0);
    expect(bar.y).toBeLessThan(120);
    const back = await box(page.getByRole("button", { name: "Back" }));
    const glyph = await page.getByRole("button", { name: "Back" }).evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return rect.x + rect.width / 2;
    });
    expect(Math.abs(glyph - (back.x + back.width / 2))).toBeLessThan(3);
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

  test("GD-F the failed split is a system box with three ways forward (prototype v4)", async ({
    page,
  }) => {
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

const FOUR_STEPS = [
  { title: "Gather what you need", description: "Collect the notes and sources.", minutes: 9 },
  { title: "Do the first part", description: "", minutes: 10 },
  { title: "Do the middle part", description: "", minutes: 10 },
  { title: "Check it through", description: "", minutes: 10 },
];

async function openFocus(page: Page) {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate((steps) => {
    window.localStorage.removeItem("waveparticle.prototype.session");
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Methods section for Friday", minutes: 39 },
        steps,
        currentStep: 0,
      }),
    );
  }, FOUR_STEPS);
  await page.goto("/try/focus");
  await expect(page.locator('main.focus-page[data-ready="true"]')).toBeVisible();
}

test.describe("focus page", () => {
  test("#238 AC1 a top row with Step 1 of 4 and the ticks, then the timer centred", async ({
    page,
  }) => {
    await openFocus(page);
    const label = page.locator(".focus-step-label");
    await expect(label).toHaveText("Step 1 of 4");
    await expect(label).toHaveCSS("text-transform", "uppercase");
    const ticks = page.locator(".focus-ticks");
    await expect(ticks.locator(".focus-mark")).toHaveCount(4);
    await expect(ticks.locator(".focus-mark-now")).toHaveCount(1);
    const labelBox = await box(label);
    const ticksBox = await box(ticks);
    expect(ticksBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
    expect(ticksBox.x + ticksBox.width).toBeGreaterThan(360);
    const clock = page.getByRole("timer", { name: "Time left" });
    await expect(clock).toHaveCSS("font-size", "46px");
    await expect(clock).toHaveCSS("font-family", /Atkinson Hyperlegible Mono/);
    const clockBox = await box(clock);
    expect(clockBox.y).toBeGreaterThan(labelBox.y + labelBox.height - 1);
    const text = await clock.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return rect.x + rect.width / 2;
    });
    expect(Math.abs(text - 195)).toBeLessThan(4);
  });

  test("#238 AC2 MY GOAL sits beside his round portrait", async ({ page }) => {
    await openFocus(page);
    const row = page.locator(".focus-mygoal");
    const ring = await box(row.locator(".focus-avatar"));
    expect(Math.round(ring.width)).toBe(48);
    // Inside the 48 px ring, the same 40 px portrait on the pale green tag fill as the dialogue.
    const portrait = row.locator(".focus-avatar .try-avatar");
    expect(Math.round((await box(portrait)).width)).toBe(40);
    const fill = await page
      .locator(".try-shell")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--tag-fill").trim());
    const asRgb = await page.evaluate((colour) => {
      const probe = document.createElement("span");
      probe.style.color = colour;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, fill);
    await expect(portrait).toHaveCSS("background-color", asRgb);
    await expect(row.locator(".focus-avatar img")).toHaveAttribute("alt", "");
    await expect(row.getByRole("heading", { name: "My goal" })).toBeVisible();
  });

  test("#238 AC3 his slip holds the label, the dots and the chevrons", async ({ page }) => {
    await openFocus(page);
    const slip = page.getByTestId("story-card");
    await expect(slip.locator(".focus-card-label")).toHaveText("Where I am");
    const earlier = slip.getByRole("button", { name: "Earlier card" });
    const newer = slip.getByRole("button", { name: "Newer card" });
    await expect(earlier).toHaveText("‹");
    await expect(newer).toHaveText("›");
    await expect(earlier).toBeDisabled();
    await expect(slip.locator(".focus-dot")).toHaveCount(1);
    await expect(slip.locator(".focus-card-text")).toHaveCSS("height", "124px");
  });

  test("#238 AC4 the YOUR GOAL panel with Now, the description and Your steps", async ({
    page,
  }) => {
    await openFocus(page);
    const panel = page.locator("section[aria-labelledby=your-side]");
    await expect(panel).toHaveCSS("border-radius", "14px");
    await expect(panel.locator(".focus-panel-goal")).toHaveText("Methods section for Friday");
    await expect(panel.locator(".focus-panel-now").first()).toHaveText("Now Gather what you need");
    await expect(panel).toContainText("Collect the notes and sources.");
    // The arrow shows but is not part of the name (a finding left by #263).
    const more = panel.getByRole("button", { name: "Your steps", exact: true });
    await expect(more).toHaveText("Your steps ▾");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(more).toHaveText("Your steps ▴");
    await expect(more).toHaveAttribute("aria-expanded", "true");
  });

  test("#238 F1 the open list marks done, now and to do with ✓ ● ○", async ({ page }) => {
    await openFocus(page);
    await page.getByRole("button", { name: "Your steps", exact: true }).click();
    const rows = page.locator("#your-steps li");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0).locator(".focus-steps-mark")).toHaveText("●");
    await expect(rows.nth(1).locator(".focus-steps-mark")).toHaveText("○");
    await expect(rows.nth(0)).toContainText("Collect the notes and sources.");
    await expect(rows.nth(0)).toHaveCSS("font-weight", "700");
  });

  test("#238 AC5 Done and Pause are 56 px paper tags pinned at the bottom", async ({ page }) => {
    await openFocus(page);
    const done = await box(page.getByRole("button", { name: "Done", exact: true }));
    const pause = await box(page.getByRole("button", { name: "Pause" }));
    expect(Math.round(done.height)).toBe(56);
    expect(Math.round(pause.height)).toBe(56);
    expect(done.width).toBeGreaterThan(pause.width);
    expect(done.y + done.height).toBeGreaterThan(750);
  });
});
