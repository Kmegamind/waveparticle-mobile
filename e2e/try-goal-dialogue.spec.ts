import { expect, test, type Page } from "@playwright/test";

// The e2e server runs with PROTOTYPE_ENABLED=1 and no model keys, so the split uses the labelled
// test-data splitter (src/lib/prototype/test-splitter.ts). The whole flow runs at 320 px.

const STORAGE_KEY = "waveparticle.prototype";

async function openDialogue(page: Page) {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/try/goal");
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
}

async function sendGoal(page: Page, goal: string) {
  await page.getByLabel("Your goal").fill(goal);
  await page.getByRole("button", { name: "Send" }).click();
}

async function savedState(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "null"),
    STORAGE_KEY,
  );
}

async function noHorizontalScroll(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
}

const plan = (page: Page) => page.getByRole("group", { name: "Your steps" });

const timeSlider = (page: Page) => page.getByRole("slider", { name: "Your time" });

/** TIME-SLIDER: moves the time slider and sends the time. */
async function setTime(page: Page, minutes: number) {
  await timeSlider(page).fill(String(minutes));
  await page.getByRole("button", { name: "Send" }).click();
}

test("#30 AC1 AC3 AC4 /try Begin opens the dialogue; he speaks first; the input is a composer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const begin = page.getByRole("link", { name: "Begin" });
  await expect(begin).toHaveClass(/button-filled/);
  await begin.click();
  await expect(page).toHaveURL(/\/try\/goal$/);
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();

  await expect(page.locator(".try-slip").first()).toContainText("What are you working on?");
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await expect(page.getByText("Your goal", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Just split it" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("#30 GD1 an empty goal shows a hint and stays on the opening", async ({ page }) => {
  await openDialogue(page);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Write one line first")).toBeVisible();
  await page.getByRole("button", { name: "Just split it" }).click();
  await expect(page.getByText("Write one line first")).toBeVisible();
  await expect(plan(page)).toHaveCount(0);
});

test("#33 #34 #35 #36 the walk-through: goal, time, split question, plan, Start", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");

  // #34 AC1: one sentence about the shape, then the time question.
  // TIME-SLIDER (Yue, 2026-11-12; replaces #35 AC5 and the quick replies): a slider from 0 to
  // 3 hours, no fixed example times, no typed box; Not sure stays.
  await expect(page.getByText("How long do you have?")).toBeVisible();
  const slider = timeSlider(page);
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "180");
  await expect(slider).toHaveAttribute("step", "1");
  await expect(slider).toHaveValue("0");
  for (const name of ["30 min", "1 hour", "2 hours"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("textbox", { name: "Your time" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Not sure", exact: true })).toBeVisible();
  // The reason is tied to the slider, and Send stays in the Tab order while inactive.
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await expect(send).not.toHaveAttribute("disabled", /.*/);
  await expect(page.getByText("Choose a time above 0")).toBeVisible();
  const hintId = await slider.getAttribute("aria-describedby");
  expect(hintId).toBeTruthy();
  await expect(page.locator(`[id="${hintId}"]`)).toHaveText("Choose a time above 0");
  await slider.fill("60");
  await expect(slider).toHaveAttribute("aria-valuetext", "1 hour");
  await page.getByRole("button", { name: "Send" }).click();

  // #33 AC1: the split question comes after the time, with buttons only.
  await expect(page.getByRole("button", { name: "Split it finer" })).toBeVisible();
  await expect(page.getByLabel("Your goal")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep it broad" }).click();

  // #36 AC1, AC3: the Plan card, the count line, the input gone.
  await expect(plan(page)).toBeVisible();
  await expect(plan(page)).toContainText("2 steps · 60 min");
  await expect(plan(page).getByLabel("Goal", { exact: true })).toHaveValue(
    "Write the methods section of my lab report",
  );
  await expect(page.getByText("argue with it now, in ink, where it’s cheap")).toBeVisible();
  await expect(page.getByLabel("Your goal")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Split again" })).toBeVisible();
  await noHorizontalScroll(page);

  // #36 AC2 / #32 AC1 (prototype): Start saves the Plan in this browser and opens the focus page.
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/try\/focus$/);
  const state = await savedState(page);
  expect(state.goal).toEqual({ text: "Write the methods section of my lab report", minutes: 60 });
  expect(state.steps).toHaveLength(2);
  expect(state.currentStep).toBe(0);
  expect(state.steps[0].description.length).toBeGreaterThan(0);
});

test("#33 AC2 Split it finer gives more Steps", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await setTime(page, 60);
  await page.getByRole("button", { name: "Split it finer" }).click();
  await expect(plan(page)).toContainText("4 steps · 60 min");
});

test("#35 AC3 #33 AC3 Just split it makes a 30 minute Plan without the split question", async ({
  page,
}) => {
  await openDialogue(page);
  await page.getByLabel("Your goal").fill("Revise chapter four");
  await page.getByRole("button", { name: "Just split it" }).click();
  await expect(plan(page)).toContainText("· 30 min");
  await expect(page.getByRole("button", { name: "Split it finer" })).toHaveCount(0);
  await expect(page.getByText("How long do you have?")).toHaveCount(0);
});

test("#35 AC2 Not sure sets 30 minutes with one reason", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await page.getByRole("button", { name: "Not sure" }).click();
  await expect(page.getByText(/Then thirty minutes\./)).toBeVisible();
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("· 30 min");
});

test("TIME-SLIDER any time from 5 minutes to 3 hours makes a Plan of that length", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await setTime(page, 95);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("· 95 min");
});

test("GOAL-TIME a stated length skips the time question and can be changed", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "study chemistry for one hour");
  await expect(page.getByText("How long do you have?")).toHaveCount(0);
  await expect(page.getByText("Time I understood from your line: 60 min.")).toBeVisible();
  await page.getByRole("button", { name: "Change time" }).click();
  await expect(timeSlider(page)).toHaveValue("60");
  await setTime(page, 120);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("· 120 min");
});

test("US-GD-11 a length of 50 minutes is kept as written and leaves the Goal title", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "study chemistry for 50 minutes");
  await expect(page.getByText("Time I understood from your line: 50 min.")).toBeVisible();
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("· 50 min");
  await expect(plan(page).getByLabel("Goal", { exact: true })).toHaveValue("study chemistry");
});

for (const [goal, value] of [
  ["study for 7 minutes", "7"],
  ["study for 50 minutes", "50"],
  ["study for 100 minutes", "100"],
]) {
  test(`US-GD-11 Change opens the slider on exactly the time read from ${goal}`, async ({
    page,
  }) => {
    await openDialogue(page);
    await sendGoal(page, goal);
    await page.getByRole("button", { name: "Change time" }).click();
    await expect(timeSlider(page)).toHaveValue(value);
  });
}

test("US-GD-11 a 2 hour lecture is not the user's time, so the time question is asked", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "take notes on a 2 hour lecture");
  await expect(page.getByText("How long do you have?")).toBeVisible();
  await expect(page.getByText(/Time I understood from your line/)).toHaveCount(0);
});

test("#351 a goal that states 4 hours is split for 3 hours, with one sentence saying so", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "study for 4 hours");
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("· 180 min");
  await expect(page.getByText("Split for 3 hours, the most one Goal can hold.")).toHaveCount(1);
});

test("#351 a goal of 3 hours or less shows no such sentence", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "study for 3 hours");
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("· 180 min");
  await expect(page.getByText("the most one Goal can hold")).toHaveCount(0);
});

test("#30 AC5 stepping back keeps the typed text", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Your goal")).toHaveValue(
    "Write the methods section of my lab report",
  );
});

test("#5 AC3 each ‹ in the dialogue names where it goes", async ({ page }) => {
  await openDialogue(page);
  const bar = page.locator(".try-dialogue-bar");
  await expect(
    bar.getByRole("link", { name: "Back to the test home", exact: true }),
  ).toHaveAttribute("href", "/try");
  await sendGoal(page, "Write the methods section of my lab report");
  await expect(bar.getByRole("button", { name: "Back to your goal", exact: true })).toBeVisible();
});

test("#37 editing the Plan: title, description, minutes, add, remove", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await setTime(page, 60);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  const card = plan(page);
  await expect(card).toContainText("2 steps · 60 min");
  const slipsBefore = await page.locator(".try-slip").count();

  // AC1: tap a Step to edit; the stepper changes minutes by 5 (#249) with 44 by 44 controls.
  const row = (name: string) => card.getByRole("button", { name: new RegExp(`^\\d+ ${name}`) });
  await row("Gather what you need").click();
  // #32: the editor cannot go past what the server accepts.
  await expect(card.getByLabel("Step title")).toHaveAttribute("maxlength", "200");
  await expect(card.getByLabel("Description")).toHaveAttribute("maxlength", "1000");
  const more = card.getByRole("button", { name: "Five minutes more" });
  const box = await more.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await more.click();
  await expect(card).toContainText("2 steps · 65 min");

  // AC4: emptying an existing title brings it back. The description is kept but not listed
  // (#237: descriptions are not shown in the list); it is back when the Step is opened again.
  await card.getByLabel("Step title").fill("");
  await card.getByLabel("Description").fill("Find the protocol sheet.");
  await card.getByRole("button", { name: "Done editing" }).click();
  await expect(row("Gather what you need")).toBeVisible();
  await expect(card).not.toContainText("Find the protocol sheet.");
  await row("Gather what you need").click();
  await expect(card.getByLabel("Description")).toHaveValue("Find the protocol sheet.");
  await card.getByRole("button", { name: "Done editing" }).click();

  // AC2: Add a step focuses its title with 15 minutes; left empty, it is removed.
  await card.getByRole("button", { name: "+ Add a step" }).click();
  await expect(card.getByLabel("Step title")).toBeFocused();
  await expect(card).toContainText("3 steps · 80 min");
  await card.getByRole("button", { name: "Done editing" }).click();
  await expect(card).toContainText("2 steps · 65 min");

  // AC3: Remove disappears when one Step remains.
  await row("Check it through").click();
  await card.getByRole("button", { name: "Remove step" }).click();
  await expect(card).toContainText("1 step · 35 min");
  await row("Gather what you need").click();
  await expect(card.getByRole("button", { name: "Remove step" })).toHaveCount(0);
  await noHorizontalScroll(page);

  // #36 AC3: he does not react to edits.
  await expect(page.locator(".try-slip")).toHaveCount(slipsBefore);
});

test("#38 GD-F a failed split speaks in the system voice and offers ways forward", async ({
  page,
}) => {
  await openDialogue(page);
  await page.getByLabel("Your goal").fill("Write the report [fail-split]");
  await page.getByRole("button", { name: "Just split it" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "That one wouldn’t split." });
  await expect(alert).toContainText(
    "Nothing is lost. Your words are kept: “Write the report [fail-split]”.",
  );
  await expect(alert.locator(".try-slip")).toHaveCount(0);
  await expect(plan(page)).toHaveCount(0);
  for (const name of ["Try again", "Use one step", "Change my line"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await expect(page.getByText(/try later|error/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Change my line" }).click();
  await expect(page.getByLabel("Your goal")).toHaveValue("Write the report [fail-split]");
});

test("#36 AC4 GD-N1 a one-Step Plan has no Step 1 of 1, no Remove and no nudge", async ({
  page,
}) => {
  await openDialogue(page);
  await page.getByLabel("Your goal").fill("Write the report [fail-split]");
  await page.getByRole("button", { name: "Just split it" }).click();
  await page.getByRole("button", { name: "Use one step" }).click();

  const card = plan(page);
  await expect(card).toContainText("1 step · 30 min");
  await expect(page.getByText(/Step 1 of 1/)).toHaveCount(0);
  await card.getByRole("button", { name: /^1 Write the report/ }).click();
  await expect(card.getByRole("button", { name: "Remove step" })).toHaveCount(0);
  await card.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/try\/focus$/);
  expect((await savedState(page)).steps).toHaveLength(1);
});

test("a crisis goal opens the safety page and is not kept", async ({ page }) => {
  await openDialogue(page);
  await sendGoal(page, "I want to kill myself");
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  await expect(page.getByText("I want to kill myself")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to my Goal" }).click();
  await expect(page.getByLabel("Your goal")).toHaveValue("");
});

test("#30 AC2 a returning visit opens with one question that is not the previous one", async ({
  page,
}) => {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        goal: { text: "Write the report", minutes: 30 },
        steps: [{ title: "Draft", description: "", minutes: 30 }],
        currentStep: 0,
      }),
    );
    window.localStorage.setItem("waveparticle.prototype.lastOpening", "0");
  }, STORAGE_KEY);
  await page.reload();
  await expect(page.getByText("Write the report")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/try/focus");
  await expect(page.getByRole("link", { name: "Begin" })).toHaveCount(0);

  await page.getByRole("link", { name: "Start a new Goal" }).click();
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
  const opening = page.locator(".try-slip").first();
  const text = (await opening.innerText()).trim();
  expect(text).not.toBe("What are you working on?");
  expect(text).toMatch(/^[^.?!]*\?$/);
  expect(text).not.toMatch(/welcome/i);
});

test("#31 US-GD-14 every turn goes to the server; after the Plan there is no input and edits send nothing", async ({
  page,
}) => {
  const turns: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      turns.push(new URL(request.url()).pathname);
    }
  });
  await openDialogue(page);

  // AC1: goal, time and the split answer are each one turn on the server.
  await sendGoal(page, "Write the methods section of my lab report");
  await expect(page.getByText("How long do you have?")).toBeVisible();
  await expect.poll(() => turns.length).toBe(1);
  await setTime(page, 45);
  await expect(page.getByRole("button", { name: "Split it finer" })).toBeVisible();
  await expect.poll(() => turns.length).toBe(2);
  await page.getByRole("button", { name: "Split it finer" }).click();
  await expect(plan(page)).toContainText("45 min");
  expect(turns).toEqual(["/try/goal", "/try/goal", "/try/goal"]);

  // AC2: the Plan card is shown and the goal input is gone.
  await expect(page.getByLabel("Your goal")).toHaveCount(0);

  // AC3: editing the Plan sends nothing to the server and he says nothing.
  const slips = await page.locator(".try-slip").count();
  const card = plan(page);
  await card.getByRole("button", { name: /^1 / }).click();
  await card.getByLabel("Step title").fill("My own first Step");
  await card.getByRole("button", { name: "Done editing" }).click();
  await card.getByRole("button", { name: "+ Add a step" }).click();
  await card.getByLabel("Step title").fill("One more");
  await card.getByRole("button", { name: "Done editing" }).click();
  await expect(card).toContainText("My own first Step");
  await expect(card).toContainText("One more");
  expect(turns).toHaveLength(3);
  await expect(page.locator(".try-slip")).toHaveCount(slips);

  // Owner decision 1: Split again is another turn on the same dialogue, with no limit.
  await page.getByRole("button", { name: "Split again" }).click();
  await expect(plan(page)).toBeVisible();
  await page.getByRole("button", { name: "Split again" }).click();
  await expect(plan(page)).toBeVisible();
  await expect.poll(() => turns.length).toBe(5);
});

/** Server action calls to the dialogue whose body is a turn of this kind (#347). */
function isTurn(request: import("@playwright/test").Request, kind: string) {
  return (
    request.method() === "POST" &&
    Boolean(request.headers()["next-action"]) &&
    (request.postData() ?? "").includes(`"kind":"${kind}"`)
  );
}

/** Makes the first request of this kind fail before it reaches the server. */
async function dropFirstTurn(page: Page, kind: string) {
  let dropped = false;
  await page.route("**/try/goal", async (route) => {
    if (!dropped && isTurn(route.request(), kind)) {
      dropped = true;
      await route.abort("internetdisconnected");
    } else {
      await route.continue();
    }
  });
}

test("#347 AC1 a split lost on the network is sent again by Try again", async ({ page }) => {
  await openDialogue(page);
  await dropFirstTurn(page, "split");
  await sendGoal(page, "Write the methods section of my lab report");
  await setTime(page, 60);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That one wouldn’t split." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(plan(page)).toContainText("60 min");
});

test("#347 AC1 Split again lost on the network can be tried again, also after Use one step", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await setTime(page, 60);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("60 min");

  await dropFirstTurn(page, "split-again");
  await page.getByRole("button", { name: "Split again" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That one wouldn’t split." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use one step" }).click();
  await expect(plan(page)).toContainText("1 step · 60 min");

  await page.getByRole("button", { name: "Split again" }).click();
  await expect(plan(page)).toContainText("2 steps · 60 min");
});

test("#347 AC2 decision 3: a turn the server refuses shows GD-F and nothing new", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "Write the methods section of my lab report");
  await expect(page.getByText("How long do you have?")).toBeVisible();
  const slips = await page.locator(".try-slip").count();

  // A forged token: the server refuses the time turn.
  await page.route("**/try/goal", async (route) => {
    const request = route.request();
    if (isTurn(request, "time")) {
      const body = (request.postData() ?? "").replace(/"token":"[^"]*"/, '"token":"forged.token"');
      await route.continue({ postData: body });
    } else {
      await route.continue();
    }
  });
  await setTime(page, 45);

  const alert = page.getByRole("alert").filter({ hasText: "That one wouldn’t split." });
  await expect(alert).toContainText(
    "Nothing is lost. Your words are kept: “Write the methods section of my lab report”.",
  );
  await expect(page.locator(".try-slip")).toHaveCount(slips);
  await expect(plan(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Split it finer" })).toHaveCount(0);

  // A refusal is not retried: Try again stays on GD-F and sends nothing.
  const turns: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) turns.push(request.url());
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toBeVisible();
  await expect(page.getByRole("button", { name: "Split it finer" })).toHaveCount(0);
  expect(turns).toEqual([]);
});

test("#347 AC1 a goal turn lost on the network is sent again by Try again", async ({ page }) => {
  await openDialogue(page);
  await dropFirstTurn(page, "goal");
  await sendGoal(page, "Write the methods section of my lab report");
  await expect(
    page.getByRole("alert").filter({ hasText: "That one wouldn’t split." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("How long do you have?")).toBeVisible();
  await setTime(page, 45);
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("45 min");
});

test("#347 AC1 Just split it lost on the network at the goal turn is sent again by Try again", async ({
  page,
}) => {
  await openDialogue(page);
  await dropFirstTurn(page, "goal");
  await page.getByLabel("Your goal").fill("Revise chapter four");
  await page.getByRole("button", { name: "Just split it" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That one wouldn’t split." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(plan(page)).toContainText("30 min");
});

test("#347 AC1 a time turn lost on the network is sent again by Try again", async ({ page }) => {
  await openDialogue(page);
  await dropFirstTurn(page, "time");
  await sendGoal(page, "Write the methods section of my lab report");
  await setTime(page, 45);
  await expect(
    page.getByRole("alert").filter({ hasText: "That one wouldn’t split." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Split it finer" })).toBeVisible();
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await expect(plan(page)).toContainText("45 min");
});
