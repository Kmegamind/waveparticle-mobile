import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signIn, stubTables, type StubTables } from "./support/account";

// #103 (and #8 AC3): Data under Me, Export my data and Delete my data, against the Supabase stub.

const OTHER = "99999999-9999-4999-8999-999999999999";

function accountRows(userId: string): StubTables {
  const goal = randomUUID();
  const step = randomUUID();
  const session = randomUUID();
  const sessionStep = randomUUID();
  const otherGoal = randomUUID();
  return {
    profiles: [
      { user_id: userId, nickname: "Ada", keep_clock_running: false },
      { user_id: OTHER, nickname: "Someone else", keep_clock_running: false },
    ],
    goals: [
      { id: goal, user_id: userId, title: "Lab report", text: "Lab report", status: "in_progress" },
      { id: otherGoal, user_id: OTHER, title: "Not mine", text: "Not mine", status: "planned" },
    ],
    steps: [
      { id: step, goal_id: goal, position: 0, title: "Outline", description: "", minutes: 20 },
    ],
    sessions: [
      {
        id: session,
        user_id: userId,
        goal_id: goal,
        step_count: 1,
        state: "open",
        seed: "s",
        companion_id: "oppenheimer",
        story_id: "trinity",
      },
    ],
    session_steps: [{ id: sessionStep, session_id: session, step_id: step, position: 0 }],
    session_lines: [
      {
        id: randomUUID(),
        session_id: session,
        session_step_id: sessionStep,
        seq: 0,
        kind: "story_card",
        source: "generated",
        text: "The desert is quiet tonight.",
      },
    ],
  };
}

test("#103 AC2 AC3 Delete account removes every row and the sign-in user, then signs out", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, accountRows);
  await page.goto("/me/delete-account");
  await expect(page.getByRole("heading", { name: "Delete your account" })).toBeVisible();
  await page.getByRole("button", { name: "Delete account" }).click();

  await expect(page).toHaveURL(/\/auth\/sign-in\?deleted=1/);
  await expect(page.getByText("Your account and your data are deleted.")).toBeVisible();

  const tables = await stubTables(account);
  expect(tables.auth_users).toEqual([]);
  for (const name of ["session_lines", "session_steps", "sessions", "steps"] as const) {
    expect(tables[name], name).toEqual([]);
  }
  // Only the caller's rows go: another account's rows stay.
  expect(tables.goals.map((row) => row.user_id)).toEqual([OTHER]);
  expect(tables.profiles.map((row) => row.user_id)).toEqual([OTHER]);

  await page.goto("/me");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("#103 a refused deletion keeps the account, says so and stays on the page", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, accountRows, {
    missingFunctions: ["delete_my_account"],
  });
  await page.goto("/me/delete-account");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not delete your account" }),
  ).toHaveText("Could not delete your account. Nothing was removed. Please try again.");
  await expect(page).toHaveURL(/\/me\/delete-account/);
  const tables = await stubTables(account);
  expect(tables.auth_users).toHaveLength(1);
  expect(tables.goals).toHaveLength(2);
  expect(tables.session_lines).toHaveLength(1);
});

test("#103 Keep my account goes back to Data", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL!, accountRows);
  await page.goto("/me/delete-account");
  await expect(page.getByRole("link", { name: "Keep my account" })).toHaveAttribute(
    "href",
    "/me/data",
  );
});
