import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, stubTables } from "./support/account";

// #114 (US-MAP-11, decision M4): the internal research flag. The Supabase stub answers
// research_condition() with the seeded condition, as the migration does for the signed-in account.

const GOAL = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
const STEP = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04"];

/** A Goal of two Steps with no session yet. */
async function signInWithGoal(page: Page, researchCondition?: "no_story") {
  const now = new Date().toISOString();
  return signIn(
    page.context(),
    baseUrlOf(page),
    (userId) => ({
      goals: [
        {
          id: GOAL,
          user_id: userId,
          title: "Write the report",
          text: "Write the report",
          status: "in_progress",
          kind: "one_time",
          created_at: now,
          updated_at: now,
        },
      ],
      steps: STEP.map((id, position) => ({
        id,
        goal_id: GOAL,
        position,
        title: position === 0 ? "Outline" : "Draft",
        description: position === 0 ? "List the sections." : null,
        minutes: 15,
      })),
    }),
    researchCondition ? { researchCondition } : {},
  );
}

test("test_114_ac1_the_study_condition_shows_the_timer_the_step_pause_and_done_and_no_cards", async ({
  page,
}) => {
  await signInWithGoal(page, "no_story");
  await page.goto(`/focus?goal=${GOAL}`);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await expect(focus.getByText("Step 1 of 2", { exact: true })).toBeVisible();
  await expect(focus.locator(".focus-panel-now").first()).toContainText("Outline");
  await expect(focus.getByText("List the sections.")).toBeVisible();
  await expect(focus.getByRole("button", { name: "Done" })).toBeVisible();
  await expect(focus.getByRole("button", { name: "Pause" })).toBeVisible();
  // No Cards, no portrait, no "My goal" line, no failure screen.
  await expect(focus.getByTestId("story-card")).toHaveCount(0);
  await expect(focus.getByRole("button", { name: "Where I am now" })).toHaveCount(0);
  await expect(focus.getByText("My goal")).toHaveCount(0);
  await expect(focus.getByRole("button", { name: "Retry" })).toHaveCount(0);
  // The clock starts at once (it does not wait for cards).
  const clock = focus.getByRole("timer", { name: "Time left" });
  await expect(clock).not.toHaveText("15:00", { timeout: 5_000 });
});

test("test_114_ac1_pause_opens_a_plain_paused_page_and_back_restarts_the_clock", async ({
  page,
}) => {
  await signInWithGoal(page, "no_story");
  await page.goto(`/focus?goal=${GOAL}`);
  await expect(page.locator('main.focus-page[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  const rest = page.locator('main.rest-page[data-ready="true"]');
  await expect(rest).toBeVisible();
  await expect(rest.getByText("Paused")).toBeVisible();
  await expect(rest.getByRole("textbox")).toHaveCount(0);
  await expect(rest.getByTestId("his-message")).toHaveCount(0);
  await page.waitForTimeout(1_500);
  await expect(rest.getByRole("button", { name: "Retry" })).toHaveCount(0);

  await rest.getByRole("button", { name: "Back to step" }).click();
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const clock = focus.getByRole("timer", { name: "Time left" });
  const before = await clock.textContent();
  await expect(clock).not.toHaveText(before ?? "", { timeout: 5_000 });
});

test("test_114_ac2_the_story_freezes_and_history_records_the_goal_and_steps", async ({ page }) => {
  const account = await signInWithGoal(page, "no_story");
  await page.goto(`/focus?goal=${GOAL}`);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await focus.getByRole("button", { name: "Done" }).click();
  await expect(focus.getByText("Step 2 of 2", { exact: true })).toBeVisible();
  await page.waitForTimeout(1_400);
  await focus.getByRole("button", { name: "Done" }).click();
  // No summary: the page keeps the Undo toast (END is his closing line).
  await expect(page.getByText("Step done")).toBeVisible();
  await expect(page).toHaveURL(/\/focus/);

  await expect
    .poll(async () => {
      const tables = await stubTables(account);
      const session = (
        tables.sessions as { companion_id: string; story_id: string; state: string }[]
      )[0];
      const done = (tables.session_steps as { done_at: string | null }[]).filter(
        (step) => step.done_at !== null,
      ).length;
      return session ? [session.companion_id, session.story_id, session.state, done] : null;
    })
    .toEqual(["none", "none", "completed", 2]);
  const tables = await stubTables(account);
  expect(tables.session_lines).toEqual([]);

  // The Life Path has no finished story: the first story is still the current one.
  await page.goto("/companions/oppenheimer");
  await expect(page.locator('.life-row[data-state="current"]')).toHaveCount(1);
  await expect(page.locator('.life-row[data-state="finished"]')).toHaveCount(0);
  await expect(page.locator(".life-row").first()).toHaveAttribute("data-state", "current");

  // History (ME-CAL) lists the session with its Goal and minutes, without the Companion.
  await page.goto("/me");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "List" }).click();
  const row = page.locator(".me-row-link").first();
  await expect(row).toContainText("Write the report");
  await expect(row.locator(".me-row-meta")).toHaveText("30 min");
  await row.click();
  await expect(page.getByText("Outline")).toBeVisible();
  await expect(page.getByText("Draft")).toBeVisible();
  await expect(page.getByRole("link", { name: /chapter/i })).toHaveCount(0);
});

// Every Me page with settings, and the page that explains the stories ("About the stories").
for (const path of ["/me", "/me/signals", "/me/about"]) {
  test(`test_114_ac3_${path.replaceAll("/", "_")}_has_no_control_that_turns_the_story_off`, async ({
    page,
  }) => {
    await signInWithGoal(page);
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    // "History" is a word of its own, not a Story switch.
    const words = /\bstory\b|\bstories\b|research|study|plain timer|turn off/i;
    // Controls that change something; a link only opens another page, and those pages are checked.
    for (const role of ["switch", "checkbox", "radio", "button", "combobox"] as const) {
      await expect(page.locator("main").getByRole(role, { name: words })).toHaveCount(0);
    }
  });
}
