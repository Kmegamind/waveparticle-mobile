import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, stubTables, type StubAccount } from "./support/account";
import { GOAL, sampleGoals } from "./support/goals-seed";

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

test("#271 AC1 #92 AC2 a Quick Replay chip opens the goal dialogue with its text, not started", async ({
  page,
}) => {
  // Nothing in progress: Home shows HOME-NONE with the finished Goals as chips.
  await signIn(page.context(), baseUrlOf(page), (userId) => {
    const tables = sampleGoals(userId);
    return {
      ...tables,
      goals: tables.goals?.map((goal) =>
        goal.status === "in_progress" ? { ...goal, status: "done" } : goal,
      ),
    };
  });
  await page.goto("/");
  const replay = page.getByRole("region", { name: "Quick Replay" });
  await replay.getByRole("link", { name: "Lab report" }).click();
  await expect(page).toHaveURL(/\/goal\?line=Lab(%20|\+)report$/);
  await expect(page.getByLabel("Your goal")).toHaveValue("Lab report");
  // It waits for Send: no Plan and no reply yet.
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(page.getByText("This is outside the story.")).toHaveCount(0);
});

test("#271 AC2 Start something else opens the goal dialogue as today", async ({ page }) => {
  await openHome(page);
  await page.getByRole("link", { name: "Start something else" }).click();
  await expect(page).toHaveURL(/\/goal$/);
  await expect(page.getByLabel("Your goal")).toHaveValue("");
});
