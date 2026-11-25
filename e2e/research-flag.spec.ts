import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, stubTables } from "./support/account";

// #114 (US-MAP-11, decision M4): the internal research flag. The Supabase stub answers
// research_condition() with the seeded condition, as the migration does for the signed-in account.

const GOAL = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
const STEP = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04"];

/** A Goal of two Steps with no session yet. */
async function signInWithGoal(page: Page, researchCondition?: "no_story" | "fail") {
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
        tables.sessions as {
          companion_id: string;
          story_id: string;
          state: string;
          story_off_at?: string | null;
        }[]
      )[0];
      const done = (tables.session_steps as { done_at: string | null }[]).filter(
        (step) => step.done_at !== null,
      ).length;
      // I3: the session keeps its Companion and story and carries the time the Story went off.
      return session
        ? [
            session.companion_id,
            typeof session.story_id === "string" && session.story_id.length > 0,
            typeof session.story_off_at === "string",
            session.state,
            done,
          ]
        : null;
    })
    .toEqual(["oppenheimer", true, true, "completed", 2]);
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

test("test_114_i2_the_focus_page_does_not_open_when_the_flag_cannot_be_read", async ({ page }) => {
  const account = await signInWithGoal(page, "fail");
  await page.goto(`/focus?goal=${GOAL}`);
  await expect(page.getByText("Could not open this Goal. Try again.")).toBeVisible();
  await expect(page.locator("main.focus-page")).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);
  // Nothing was opened on the account.
  expect((await stubTables(account)).sessions).toEqual([]);
});

const SESSION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02";

test("test_114_ac2_an_open_story_session_freezes_when_the_flag_is_set", async ({ page }) => {
  const now = new Date();
  const earlier = new Date(now.getTime() - 20 * 60_000).toISOString();
  const account = await signIn(
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
          created_at: earlier,
          updated_at: earlier,
        },
      ],
      steps: STEP.map((id, position) => ({
        id,
        goal_id: GOAL,
        position,
        title: position === 0 ? "Outline" : "Draft",
        description: null,
        minutes: 15,
      })),
      // An open Story session: Step 1 was done with his background card shown.
      sessions: [
        {
          id: SESSION,
          goal_id: GOAL,
          user_id: userId,
          state: "open",
          companion_id: "oppenheimer",
          story_id: "site-search",
          seed: "s",
          step_count: 2,
          started_at: earlier,
          last_active_at: earlier,
          completed_at: null,
        },
      ],
      session_steps: STEP.map((stepId, position) => ({
        id: `eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1${position}`,
        session_id: SESSION,
        step_id: stepId,
        position,
        opened_at: earlier,
        done_at: position === 0 ? earlier : null,
      })),
      session_lines: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20",
          session_id: SESSION,
          session_step_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10",
          seq: 0,
          kind: "background",
          card_id: null,
          source: "authored",
          text: "His background card.",
          pause_number: null,
          shown_at: earlier,
        },
      ],
    }),
    { researchCondition: "no_story" },
  );
  await page.goto(`/focus?goal=${GOAL}`);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  // The done Step stays done; no card comes back, not even the one shown before.
  await expect(focus.getByText("Step 2 of 2", { exact: true })).toBeVisible();
  await expect(focus.getByTestId("story-card")).toHaveCount(0);
  await expect(page.getByText("His background card.")).toHaveCount(0);

  await expect
    .poll(async () => {
      const session = (await stubTables(account)).sessions.find(
        (row) => (row as { id: string }).id === SESSION,
      ) as { story_off_at?: string } | undefined;
      return typeof session?.story_off_at === "string";
    })
    .toBe(true);
  const tables = await stubTables(account);
  const session = tables.sessions.find((row) => (row as { id: string }).id === SESSION) as {
    companion_id: string;
    story_id: string;
    state: string;
    story_off_at: string;
  };
  // Kept: the Companion, the story, the state, the shown card and the done Step.
  expect([session.companion_id, session.story_id, session.state]).toEqual([
    "oppenheimer",
    "site-search",
    "open",
  ]);
  expect(tables.sessions).toHaveLength(1);
  expect((tables.session_lines as { text: string }[]).map((line) => line.text)).toEqual([
    "His background card.",
  ]);
  // Step 1 was done before the Story went off.
  const steps = tables.session_steps as { position: number; done_at: string | null }[];
  const first = steps.find((step) => step.position === 0)!;
  expect(Date.parse(first.done_at!)).toBeLessThan(Date.parse(session.story_off_at));
});
