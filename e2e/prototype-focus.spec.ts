import { expect, test, type Page } from "@playwright/test";
import generated from "../docs/demo/site-search.generated.json";

// The e2e server runs with PROTOTYPE_ENABLED=1 and no model keys, so /try/focus uses the
// chapter 8 test data. `?speed=60` makes one minute of a Step last one second.

type Card = { kind: string; text: string };
const stepCards = generated.steps.map((step) => step.cards as Card[]);
const background = stepCards[0].find((card) => card.kind === "opening")!.text;
const step1First = stepCards[0].filter((card) => card.kind !== "opening")[0].text;
const step2Opening = stepCards[1][0].text;

type PlanStep = { title: string; description: string; minutes: number };

const threeSteps: PlanStep[] = [
  { title: "Outline", description: "List the sections.", minutes: 10 },
  { title: "Draft", description: "", minutes: 15 },
  { title: "Check", description: "Read it once.", minutes: 5 },
];

async function seed(page: Page, steps: PlanStep[], speed = 60) {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate((planSteps) => {
    window.localStorage.removeItem("waveparticle.prototype.session");
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Write the report", minutes: 30 },
        steps: planSteps,
        currentStep: 0,
      }),
    );
  }, steps);
  await page.goto(`/try/focus?speed=${speed}`);
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
}

const slip = (page: Page) => page.getByTestId("story-card");
const dots = (page: Page) => page.locator(".focus-dot");

test("#12 AC1 and #17 AC3 Step 1 opens with the background card as its only card", async ({
  page,
}) => {
  await seed(page, threeSteps);
  await expect(slip(page)).toContainText(background);
  await expect(dots(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "‹ Earlier card" })).toBeDisabled();
  await expect(page.getByText("Step 1 of 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Outline", { exact: true })).toBeVisible();
  await expect(page.getByText("List the sections.")).toBeVisible();
  await expect(page.getByText("Test data: chapter 8 cards")).toBeVisible();
});

test("#14 AC1 to AC3 a new card arrives on top and Earlier and Newer browse the stack", async ({
  page,
}) => {
  await seed(page, threeSteps);
  await expect(dots(page)).toHaveCount(2, { timeout: 15_000 });
  await expect(slip(page)).toContainText(step1First);

  await page.getByRole("button", { name: "‹ Earlier card" }).click();
  await expect(slip(page)).toContainText(background);
  await page.getByRole("button", { name: "Newer card ›" }).click();
  await expect(slip(page)).toContainText(step1First);
});

test("#24 AC1 and AC2 the clock counts down and stays at 00:00", async ({ page }) => {
  await seed(page, [{ title: "Short", description: "", minutes: 3 }]);
  const clock = page.getByRole("timer");
  await expect(clock).toHaveText("00:03");
  await expect(clock).toHaveText("00:00", { timeout: 10_000 });
  await page.waitForTimeout(1_500);
  await expect(clock).toHaveText("00:00");
  await expect(page.getByRole("button", { name: "Done" })).toBeEnabled();
});

test("#26 AC1 and AC2 Done opens the next Step with one card after a 1.2 second hold", async ({
  page,
}) => {
  await seed(page, threeSteps);
  await expect(slip(page)).toContainText(background);
  const done = page.getByRole("button", { name: "Done" });
  await done.click();

  await expect(page.getByText("Step 2 of 3", { exact: true })).toBeVisible();
  await expect(done).toBeDisabled();
  await expect(slip(page)).toContainText(step2Opening);
  await expect(dots(page)).toHaveCount(1);
  await expect(page.getByRole("timer")).toHaveText("00:15");
  await expect(done).toBeEnabled({ timeout: 3_000 });
  await expect(page.getByRole("timer")).not.toHaveText("00:15", { timeout: 3_000 });
  await expect(page).toHaveURL(/\/try\/focus/);
});

test("#27 AC1 and AC2 Undo brings the previous Step back with its own cards", async ({ page }) => {
  await seed(page, threeSteps);
  await page.getByRole("button", { name: "Done" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Step done" });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();

  await expect(page.getByText("Step 1 of 3", { exact: true })).toBeVisible();
  await expect(slip(page)).toContainText(background);
  await expect(toast).toHaveCount(0);
});

test("#26 AC3 Done on the last Step goes to the end page", async ({ page }) => {
  await seed(page, [{ title: "Only Step", description: "", minutes: 20 }]);
  await expect(page.getByText(/Step 1 of 1/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Your Steps" })).toHaveCount(0);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/try\/end$/);
});

test("#22 AC1 Your Steps lists the Step names marked done, now or to do", async ({ page }) => {
  await seed(page, threeSteps);
  await page.getByRole("button", { name: "Your Steps" }).click();
  const list = page.locator("#your-steps");
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list.getByRole("listitem").nth(0)).toContainText("now");
  await expect(list.getByRole("listitem").nth(2)).toContainText("to do");
  await expect(list).not.toContainText("min");
});

test("#18 the focus page fits 320 px and every control is at least 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page, threeSteps);
  await page.getByRole("button", { name: "Your Steps" }).click();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(320);
  for (const button of await page.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("the focus page without a Goal shows a calm line and a way back", async ({ page }) => {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/try/focus");
  await expect(page.getByText("There is no Goal to work on yet.")).toBeVisible();
  await page.getByRole("link", { name: "Go back to the test home" }).click();
  await expect(page).toHaveURL(/\/try$/);
});
