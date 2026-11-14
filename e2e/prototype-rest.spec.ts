import { expect, test, type Page } from "@playwright/test";
import generated from "../docs/demo/site-search.generated.json";

// The e2e server runs with PROTOTYPE_ENABLED=1 and no model keys, so /try/rest and the return
// pop-up use the chapter 8 test data. `?speed=60` makes one minute last one second, so the
// 5-minute absence rule takes 5 seconds.

type Chat = { chosen?: { reply?: string; checks?: { ok?: boolean } } };
const pauseMessage = generated.pause.stuck.text;
const returnLine = generated.pause.back.text;
const restReplies = (generated.pause.chat as Chat[])
  .filter((turn) => turn.chosen?.checks?.ok && turn.chosen.reply)
  .map((turn) => turn.chosen!.reply!);

type PlanStep = { title: string; description: string; minutes: number };
const steps: PlanStep[] = [
  { title: "Outline", description: "List the sections.", minutes: 30 },
  { title: "Draft", description: "", minutes: 30 },
];

async function seed(page: Page, speed = 60) {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate((planSteps) => {
    window.localStorage.removeItem("waveparticle.prototype.session");
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Write the report", minutes: 60 },
        steps: planSteps,
        currentStep: 0,
      }),
    );
  }, steps);
  await page.goto(`/try/focus?speed=${speed}`);
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId("story-card")).toBeVisible();
}

async function pause(page: Page) {
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page).toHaveURL(/\/try\/rest/);
  await expect(page.locator('main.rest-page[data-ready="true"]')).toBeVisible();
}

const slips = (page: Page) => page.getByTestId("his-message");
const popup = (page: Page) => page.getByRole("dialog");
const storedSession = (page: Page) =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem("waveparticle.prototype.session")!));

test("#28 AC1 and #66 AC1 AC2 AC5 Pause freezes the clock and he writes first", async ({
  page,
}) => {
  await seed(page);
  await pause(page);

  await expect(slips(page).first()).toContainText(pauseMessage);
  await expect(page.getByRole("button", { name: "Back to step" })).toBeVisible();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByText("Test data: chapter 8 rest lines")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /extend|skip/i })).toHaveCount(0);
  expect((await storedSession(page)).paused).toBe(true);
});

test("#67 AC1 AC2 AC5 the conversation has no limit and he answers each message", async ({
  page,
}) => {
  await seed(page);
  await pause(page);
  await expect(slips(page)).toHaveCount(1);

  const field = page.getByLabel("Message");
  const total = restReplies.length + 1;
  for (let i = 0; i < total; i += 1) {
    await field.fill(`message ${i}`);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(slips(page)).toHaveCount(i + 2);
    await expect(slips(page).nth(i + 1)).toContainText(restReplies[i % restReplies.length]);
  }
  await expect(page.getByTestId("your-message")).toHaveCount(total);
  await expect(page.getByRole("button", { name: "Back to step" })).toBeVisible();
  await expect(field).toBeEnabled();
});

test("#67 AC4 a crisis message opens the safety page and is never kept", async ({ page }) => {
  await seed(page);
  await pause(page);
  await expect(slips(page)).toHaveCount(1);

  await page.getByLabel("Message").fill("I want to kill myself");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  await expect(page.getByText("I want to kill myself")).toHaveCount(0);
  expect(JSON.stringify(await storedSession(page))).not.toContain("kill myself");

  await page.getByRole("button", { name: "Back to my Goal" }).click();
  await expect(page.getByLabel("Message")).toHaveValue("");
  await expect(slips(page)).toHaveCount(1);
  await expect(page.getByTestId("your-message")).toHaveCount(0);
});

test("#68 AC1 AC2 AC4 and #69 AC1 AC5 AC7 Back to step opens the pop-up, Start continues", async ({
  page,
}) => {
  await seed(page);
  const clock = page.getByRole("timer");
  await expect(clock).not.toHaveText("00:30", { timeout: 5_000 });
  await pause(page);
  const frozen = (await storedSession(page)).steps[0].clock.elapsedBeforeRunMs;
  await page.waitForTimeout(2_000);

  await page.getByRole("button", { name: "Back to step" }).click();
  await expect(page).toHaveURL(/\/try\/focus/);
  await expect(popup(page)).toContainText(returnLine);
  // #5 AC5: the pop-up is named, his line describes it, and focus is on Start at once.
  await expect(page.getByRole("dialog", { name: "Back to your step" })).toHaveAttribute(
    "aria-describedby",
    "return-line",
  );
  const start = popup(page).getByRole("button", { name: "Start" });
  await expect(start).toBeFocused();
  await expect(popup(page).getByRole("button")).toHaveCount(1);
  await expect(popup(page)).not.toContainText(/\d|away|welcome|you/i);

  const shown = await clock.textContent();
  const expected = 30 - Math.floor(frozen / 1_000);
  expect(Number(shown!.split(":")[1])).toBeGreaterThanOrEqual(expected - 1);
  await page.waitForTimeout(1_500);
  await expect(clock).toHaveText(shown!);

  await start.click();
  await expect(popup(page)).toHaveCount(0);
  await expect(clock).not.toHaveText(shown!, { timeout: 3_000 });
  expect((await storedSession(page)).paused).toBe(false);
});

test("#19 AC2 and #69 AC2 a short absence resumes with no pop-up", async ({ page }) => {
  await seed(page);
  await page.goto("/try");
  await page.goto("/try/focus?speed=60");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(popup(page)).toHaveCount(0);
  expect((await storedSession(page)).paused).toBe(false);
});

test("#19 AC3 and #69 AC2 AC6 back after 5 minutes or more shows the pop-up first", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/try");
  await page.waitForTimeout(5_500);
  await page.goto("/try/focus?speed=60");
  await expect(popup(page)).toContainText(returnLine);
  const clock = await page.getByRole("timer").textContent();
  await page.waitForTimeout(1_500);
  await expect(page.getByRole("timer")).toHaveText(clock!);
  await popup(page).getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("timer")).not.toHaveText(clock!, { timeout: 3_000 });
  await expect(page.getByText("Step 1 of 2", { exact: true })).toBeVisible();
});

test("#66 AC4 Home opens the test home and the Step stays paused", async ({ page }) => {
  await seed(page);
  await pause(page);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/try$/);
  const session = await storedSession(page);
  expect(session.paused).toBe(true);
  expect(session.rest).toBeNull();
});

test("#29 AC1 AC2 AC4 every Pause opens the same rest page with no warning", async ({ page }) => {
  await seed(page);
  for (let n = 1; n <= 3; n += 1) {
    await pause(page);
    await expect(slips(page)).toHaveCount(1);
    await expect(page.locator("main.rest-page")).not.toContainText(/pause number|third|warning/i);
    await page.getByRole("button", { name: "Back to step" }).click();
    await popup(page).getByRole("button", { name: "Start" }).click();
    await expect(popup(page)).toHaveCount(0);
  }
  expect((await storedSession(page)).pauses[0]).toBe(3);
});

test("FLOW 3.3 a reopened rest page keeps the conversation and the draft", async ({ page }) => {
  await seed(page);
  await pause(page);
  await page.getByLabel("Message").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(slips(page)).toHaveCount(2);
  await page.getByLabel("Message").fill("half a thought");
  await page.reload();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(slips(page)).toHaveCount(2);
  await expect(page.getByLabel("Message")).toHaveValue("half a thought");
});

test("the rest page and the pop-up fit 320 px with 44 px targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page);
  await pause(page);
  await expect(slips(page)).toHaveCount(1);
  for (const control of [
    page.getByRole("button", { name: "Back to step" }),
    page.getByRole("link", { name: "Home" }),
    page.getByRole("button", { name: "Send" }),
    page.getByLabel("Message"),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole("button", { name: "Back to step" }).click();
  const start = popup(page).getByRole("button", { name: "Start" });
  await expect(start).toBeVisible();
  expect((await start.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
