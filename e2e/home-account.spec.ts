import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, stubTables, type StubAccount } from "./support/account";
import { GOAL, SESSION, sampleGoals } from "./support/goals-seed";

// Signed-in Home and the Companions list against the test-only Supabase stub: findings left by
// #268 (a second toast closing early, Esc during a change hiding its error, Moriarty's reason).

async function openHome(page: Page): Promise<StubAccount> {
  const account = await signIn(page.context(), baseUrlOf(page), sampleGoals);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Goal options" })).toBeVisible();
  return account;
}

async function goalStatus(account: StubAccount, id: string) {
  return (await stubTables(account)).goals.find((goal) => goal.id === id)?.status;
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Goal options" });

test("finding: a second Home toast gets its own five seconds", async ({ page }) => {
  const account = await openHome(page);
  await page.getByRole("button", { name: "Goal options" }).click();
  await sheet(page).getByRole("button", { name: "Put on hold" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Goal put on hold" })).toBeVisible();
  await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("on_hold");

  // Three seconds into the first toast, a second change shows its own toast.
  // By keyboard, so no pointer passes over the toast (hovering it holds it).
  await page.waitForTimeout(3_000);
  await page.getByRole("button", { name: "Goal options" }).focus();
  await page.keyboard.press("Enter");
  await sheet(page).getByRole("button", { name: "Mark done" }).focus();
  await page.keyboard.press("Enter");
  const second = page.getByRole("status").filter({ hasText: "Goal marked done" });
  await expect(second).toBeVisible();
  // Past the first toast's five seconds, the second one is still there.
  await page.waitForTimeout(3_000);
  await expect(second).toBeVisible();
});

test("finding: Esc while a Home change is saving keeps the sheet and shows its error", async ({
  page,
}) => {
  await openHome(page);
  // The change is slow and then fails.
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.abort();
  });
  await page.getByRole("button", { name: "Goal options" }).click();
  await sheet(page).getByRole("button", { name: "Put on hold" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("alert")).toHaveText(
    "Could not change the Goal. Please try again.",
  );
  // Once the change is over, Esc closes the sheet as usual.
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
});

test("finding: Moriarty's reason is announced and describes Enter", async ({ page }) => {
  await signIn(page.context(), baseUrlOf(page));
  await page.goto("/companions");
  // The live region exists before anything is chosen, so its later text is announced.
  const reason = page.locator("#comp-reason");
  await expect(reason).toHaveAttribute("aria-live", "polite");
  await expect(reason).toBeEmpty();
  await page.getByRole("radio", { name: /Moriarty/ }).click();
  await expect(reason).toHaveText("His stories are not ready yet.");
  const enter = page.getByRole("button", { name: "Enter" });
  await expect(enter).toBeDisabled();
  await expect(enter).toHaveAttribute("aria-describedby", "comp-reason");
  await page.getByRole("radio", { name: /Oppenheimer/ }).click();
  await expect(reason).toBeEmpty();
  await expect(enter).not.toHaveAttribute("aria-describedby", /.+/);
});

/** The sample account with every time moved four days back: Home is HOME-3 (#87). */
function fourDaysAway(userId: string) {
  const shift = 4 * 24 * 60 * 60_000;
  const older = (value: unknown) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)
      ? new Date(Date.parse(value) - shift).toISOString()
      : value;
  const tables = sampleGoals(userId) as Record<string, Record<string, unknown>[]>;
  return Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [
      name,
      rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, older(v)]))),
    ]),
  );
}

test("#87 AC1 AC2 after more than three days Home shows a calm welcome back card", async ({
  page,
}) => {
  await signIn(page.context(), baseUrlOf(page), fourDaysAway);
  await page.goto("/");
  const card = page.getByRole("region", { name: "Goal" });
  await expect(card.getByText("Welcome back")).toBeVisible();
  await expect(
    card.getByRole("heading", { name: "Your Goal is where you left it." }),
  ).toBeVisible();
  await expect(card.getByText("Methods section for Friday")).toBeVisible();
  await expect(card.getByRole("link", { name: "Pick it back up" })).toHaveAttribute(
    "href",
    `/focus?goal=${GOAL.methods}`,
  );
  await expect(card.getByRole("button", { name: "Start over" })).toBeVisible();
  await expect(card).not.toContainText(/\d+\s*days?|abandon|meanwhile/i);
});

test("#87 AC3 AC4 Start over asks calmly; Not now returns; confirming restarts at Step 1", async ({
  page,
}) => {
  const account = await signIn(page.context(), baseUrlOf(page), fourDaysAway);
  await page.goto("/");
  const startOver = page.getByRole("button", { name: "Start over" });
  await startOver.click();
  const sheet = page.getByRole("dialog", { name: "Start over?" });
  await expect(sheet).toContainText("Nothing is lost.");
  await expect(sheet).not.toContainText(/lose|\d+ of \d+/i);
  await sheet.getByRole("button", { name: "Not now" }).click();
  await expect(sheet).toBeHidden();
  await expect(startOver).toBeFocused();

  await startOver.click();
  await sheet.getByRole("button", { name: "Start from Step 1" }).click();
  await expect(page).toHaveURL(new RegExp(`/focus\\?goal=${GOAL.methods}$`));
  // The open session is marked restarted. Opening the new session at Step 1 is the focus page's
  // insert, which the test-only Supabase stub does not support (GET and PATCH only); the unit test
  // test_87_ac4_the_focus_page_then_opens_a_new_session_at_step_1 covers it.
  await expect
    .poll(async () => {
      const { sessions } = await stubTables(account);
      return sessions
        .filter((row) => (row as { goal_id: string }).goal_id === GOAL.methods)
        .map(
          (row) =>
            `${(row as { id: string }).id === SESSION.methods ? "old" : "new"}:${(row as { state: string }).state}`,
        );
    })
    .toEqual(["old:restarted"]);
});
