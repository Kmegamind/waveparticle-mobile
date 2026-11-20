import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, stubTables, type StubAccount } from "./support/account";

// #27 AC4: the last Done opens the summary (END) with the same "Step done" Undo toast. Undo
// brings the last Step back on the focus page and reopens the finished run on the account, and
// both survive a reload.

const GOAL = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
const SESSION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02";
const STEP = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04"];

async function signInWithOpenSession(page: Page) {
  const now = new Date().toISOString();
  return signIn(page.context(), baseUrlOf(page), (userId) => ({
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
      description: null,
      minutes: 15,
    })),
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
        started_at: now,
        last_active_at: now,
        completed_at: null,
      },
    ],
    session_steps: STEP.map((stepId, position) => ({
      id: `eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1${position}`,
      session_id: SESSION,
      step_id: stepId,
      position,
      opened_at: null,
      done_at: null,
    })),
  }));
}

async function accountState(account: StubAccount) {
  const tables = await stubTables(account);
  const goal = (tables.goals as { id: string; status: string }[]).find((row) => row.id === GOAL);
  const session = (tables.sessions as { id: string; state: string }[]).find(
    (row) => row.id === SESSION,
  );
  const last = (tables.session_steps as { step_id: string; done_at: string | null }[]).find(
    (row) => row.step_id === STEP[1],
  );
  return { goal: goal?.status, session: session?.state, lastDone: last?.done_at != null };
}

async function finishBothSteps(page: Page) {
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await expect(focus.getByTestId("story-card")).toBeVisible();
  const done = focus.getByRole("button", { name: "Done", exact: true });
  if (await focus.getByText("Step 1 of 2", { exact: true }).isVisible()) {
    await done.click();
    await expect(focus.getByText("Step 2 of 2", { exact: true })).toBeVisible();
    // The 1.2 second hold after Done: a Done inside it does nothing.
    await page.waitForTimeout(1_400);
  }
  await done.click();
  await expect(page).toHaveURL(new RegExp(`/end\\?session=${SESSION}$`));
}

test("test_27_ac4_the_summary_shows_the_undo_toast_and_undo_reopens_the_finished_run", async ({
  page,
}) => {
  const account = await signInWithOpenSession(page);
  await page.goto(`/focus?goal=${GOAL}`);
  await finishBothSteps(page);

  const summary = page.locator('main.end-page[data-ready="true"]');
  await expect(summary).toBeVisible();
  const toast = summary.getByRole("status").filter({ hasText: "Step done" });
  await expect(toast).toBeVisible();
  await expect
    .poll(() => accountState(account))
    .toEqual({
      goal: "done",
      session: "completed",
      lastDone: true,
    });

  // A reload inside the toast's time shows the same toast.
  await page.reload();
  await expect(toast).toBeVisible();

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(page).toHaveURL(new RegExp(`/focus\\?goal=${GOAL}$`));
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus.getByText("Step 2 of 2", { exact: true })).toBeVisible();
  await expect(focus.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect
    .poll(() => accountState(account))
    .toEqual({
      goal: "in_progress",
      session: "open",
      lastDone: false,
    });

  // After a reload the last Step is still open, on this device and on the account.
  await page.reload();
  await expect(focus.getByText("Step 2 of 2", { exact: true })).toBeVisible();
  expect(await accountState(account)).toEqual({
    goal: "in_progress",
    session: "open",
    lastDone: false,
  });

  // Done again finishes the run again.
  await page.waitForTimeout(1_400);
  await finishBothSteps(page);
  await expect
    .poll(() => accountState(account))
    .toEqual({
      goal: "done",
      session: "completed",
      lastDone: true,
    });
});

test("test_27_ac4_after_the_toast_has_gone_the_summary_has_no_undo", async ({ page }) => {
  await signInWithOpenSession(page);
  await page.goto(`/focus?goal=${GOAL}`);
  await finishBothSteps(page);
  const summary = page.locator('main.end-page[data-ready="true"]');
  await expect(summary.getByRole("status").filter({ hasText: "Step done" })).toBeVisible();
  await expect(summary.getByRole("button", { name: "Undo" })).toHaveCount(0, { timeout: 12_000 });
  // The summary itself stays: only the toast is gone.
  await expect(summary.getByRole("heading", { name: "Your goal" })).toBeVisible();
  await expect(page.getByText("There is no finished Step to sum up.")).toHaveCount(0);
});
