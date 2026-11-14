import { expect, test, type Page } from "@playwright/test";

// #257. The e2e server has PROTOTYPE_ENABLED=1, no model and placeholder Supabase values, so
// nobody can sign in: /focus and /rest are checked for the sign-in redirect, and the behaviour
// they share with /try (the same screens) is checked on /try. The account writes are covered by
// tests/signed-in-focus.test.ts.

type PlanStep = { title: string; description: string; minutes: number };

const threeSteps: PlanStep[] = [
  { title: "Outline", description: "List the sections.", minutes: 30 },
  { title: "Draft", description: "", minutes: 30 },
  { title: "Check", description: "", minutes: 30 },
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
        goal: { text: "Write the report", minutes: 90 },
        steps: planSteps,
        currentStep: 0,
      }),
    );
  }, steps);
  await page.goto(`/try/focus?speed=${speed}`);
  await expect(page.locator('main.focus-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId("story-card")).toBeVisible();
}

const storedSession = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem("waveparticle.prototype.session")!));

for (const path of ["/focus", "/rest"]) {
  test(`#257 AC1 ${path} sends a signed-out visitor to sign in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
  });
}

test("#257 AC7 and #28 AC2 the system back control on the focus page acts as Pause", async ({
  page,
}) => {
  await seed(page, threeSteps);
  await page.goBack();
  await expect(page).toHaveURL(/\/try\/rest/);
  await expect(page.locator('main.rest-page[data-ready="true"]')).toBeVisible();
  const session = await storedSession(page);
  expect(session.paused).toBe(true);
  expect(session.pauses[0]).toBe(1);
});

test("#257 AC7 and #19 AC6 back on the return pop-up opens Home and the Plan stays", async ({
  page,
}) => {
  await seed(page, threeSteps);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator('main.rest-page[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Back to step" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/try$/);
  const session = await storedSession(page);
  expect(session.current).toBe(0);
  expect(session.paused).toBe(true);
  expect(session.returnPending).toBe("rest");
});

test("#257 AC8 and #25 AC3 one light haptic when the clock reaches 00:00", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { haptics: unknown[] }).haptics = calls;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: unknown) => {
        calls.push(pattern);
        return true;
      },
    });
  });
  await seed(page, [{ title: "Short", description: "", minutes: 3 }]);
  await expect(page.getByRole("timer")).toHaveText("00:00", { timeout: 10_000 });
  await page.waitForTimeout(1_500);
  const calls = await page.evaluate(() => (window as unknown as { haptics: unknown[] }).haptics);
  expect(calls).toHaveLength(1);
});

test("#257 AC9 and #18 AC1 the seam shows one mark per Step with the current one on", async ({
  page,
}) => {
  await seed(page, threeSteps);
  const marks = page.locator(".focus-seam .focus-mark");
  await expect(marks).toHaveCount(3);
  await expect(page.locator(".focus-seam .focus-mark-now")).toHaveCount(1);
  await expect(marks.nth(0)).toHaveClass(/focus-mark-now/);
});

test("#257 AC9 and #23 AC1 a one-Step Plan has no seam marks", async ({ page }) => {
  await seed(page, [{ title: "Only", description: "", minutes: 30 }]);
  await expect(page.locator(".focus-seam .focus-mark")).toHaveCount(0);
  await expect(page.getByText("Step 1 of 1")).toHaveCount(0);
});
