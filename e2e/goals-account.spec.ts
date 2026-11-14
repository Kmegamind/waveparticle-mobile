import { expect, test, type Page } from "@playwright/test";
import { signIn, stubTables, type StubAccount, type StubTables } from "./support/account";
import { GOAL, SESSION, manyGoals, sampleGoals } from "./support/goals-seed";

// The signed-in Goals area (#73, #77, #78, #39, #79, #80) against the test-only Supabase stub
// (e2e/support/stub-supabase.mjs), at prototype v4's phone size.

test.use({ viewport: { width: 390, height: 800 } });

async function openGoals(
  page: Page,
  baseURL: string,
  tables: (userId: string) => StubTables = sampleGoals,
  path = "/goals",
): Promise<StubAccount> {
  const account = await signIn(page.context(), baseURL, tables);
  await page.goto(path);
  await expect(page.locator('main[data-ready="true"]')).toBeVisible();
  return account;
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name},`) });
const row = (page: Page, title: string) => page.locator(".goals-row").filter({ hasText: title });

async function goalStatus(account: StubAccount, id: string) {
  return (await stubTables(account)).goals.find((goal) => goal.id === id)?.status;
}

async function sessionState(account: StubAccount, id: string) {
  return (await stubTables(account)).sessions.find((session) => session.id === id)?.state;
}

test.describe("the Goals page", () => {
  test("#73 a signed-in account opens /goals and sees its Goal titles", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!);
    await expect(page.getByRole("heading", { name: "Goals", level: 1 })).toBeVisible();
    await expect(row(page, "Methods section for Friday")).toBeVisible();
  });

  test("#73 AC1 four tabs: In progress, On hold, Done and History; the tab is kept in the URL", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!);
    const list = page.getByRole("tablist", { name: "Goal lists" });
    await expect(list.getByRole("tab")).toHaveText(["In progress", "On hold", "Done", "History"]);
    await expect(tab(page, "In progress")).toHaveAttribute("aria-selected", "true");
    await tab(page, "On hold").click();
    await expect(page).toHaveURL(/\/goals\?tab=hold$/);
    await expect(tab(page, "On hold")).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(tab(page, "On hold")).toHaveAttribute("aria-selected", "true");
    await tab(page, "On hold").press("ArrowRight");
    await expect(tab(page, "Done")).toBeFocused();
  });

  test("#73 AC2 In progress groups Ongoing then One-time", async ({ page, baseURL }) => {
    await openGoals(page, baseURL!);
    const panel = page.getByRole("tabpanel");
    await expect(panel.locator(".goals-group")).toHaveText(["Ongoing", "One-time"]);
    await expect(panel.locator(".goals-row-title")).toHaveText([
      "IELTS listening, section 3",
      "Methods section for Friday",
    ]);
  });

  test("#73 AC3 AC5 a row shows his portrait, the title, what was done, and Continue as a plain link", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!);
    const methods = row(page, "Methods section for Friday");
    await expect(methods.locator("img")).toHaveAttribute("src", "/companions/oppenheimer.png");
    await expect(methods).toContainText("1 done today");
    const go = methods.getByRole("link", { name: "Continue Methods section for Friday" });
    await expect(go).toHaveAttribute("href", `/focus?goal=${GOAL.methods}`);
    expect(await go.evaluate((element) => element.tagName)).toBe("A");
    await expect(methods).not.toContainText(/ of |%|min/);
    const ielts = row(page, "IELTS listening, section 3");
    await expect(
      ielts.getByRole("link", { name: "Start IELTS listening, section 3" }),
    ).toHaveAttribute("href", `/goal?line=${encodeURIComponent("IELTS listening, section 3")}`);
  });

  test("#73 AC4 more than five Goals show five rows and Show more with no number", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!, (userId) => manyGoals(userId, 7));
    await expect(page.locator(".goals-row")).toHaveCount(5);
    const more = page.getByRole("button", { name: "Show more" });
    await expect(more).toHaveText("Show more");
    await more.click();
    await expect(page.locator(".goals-row")).toHaveCount(7);
  });

  test("#79 AC1 AC4 the ⋯ menu puts a Goal on hold with a five-second Undo and no confirmation", async ({
    page,
    baseURL,
  }) => {
    const account = await openGoals(page, baseURL!);
    await row(page, "Methods section for Friday")
      .getByRole("button", { name: "More actions for Methods section for Friday" })
      .click();
    const menu = page.getByRole("dialog", { name: "Goal menu" });
    await expect(menu.getByRole("button")).toHaveText(["Put on hold", "Mark done", "Close"]);
    await menu.getByRole("button", { name: "Put on hold" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Put on hold." })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("on_hold");
    await expect.poll(() => sessionState(account, SESSION.methods)).toBe("on_hold");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(row(page, "Methods section for Friday")).toBeVisible();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("in_progress");
    await expect.poll(() => sessionState(account, SESSION.methods)).toBe("open");
  });

  test("#79 Undo is gone after five seconds and cannot be sent twice", async ({
    page,
    baseURL,
  }) => {
    const account = await openGoals(page, baseURL!);
    await row(page, "Lab report").count();
    await tab(page, "Done").click();
    await row(page, "Lab report").getByRole("button", { name: "Reopen Lab report" }).click();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(undo).toHaveCount(0);
    await expect.poll(() => goalStatus(account, GOAL.lab)).toBe("done");
    await tab(page, "On hold").click();
    await row(page, "Portfolio case study")
      .getByRole("button", { name: "Resume Portfolio case study" })
      .click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await page.waitForTimeout(5_600);
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  });

  test("#79 AC2 On hold rows have Resume, with no dates, and Resume reopens the parked session", async ({
    page,
    baseURL,
  }) => {
    const account = await openGoals(page, baseURL!, sampleGoals, "/goals?tab=hold");
    const portfolio = row(page, "Portfolio case study");
    await expect(portfolio).not.toContainText(/\d/);
    await portfolio.getByRole("button", { name: "Resume Portfolio case study" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Back in progress." })).toBeVisible();
    await expect.poll(() => goalStatus(account, GOAL.portfolio)).toBe("in_progress");
    await expect.poll(() => sessionState(account, SESSION.portfolio)).toBe("open");
    await expect(page).toHaveURL(/\/goals\?tab=hold$/);
    await expect(page.getByText("Nothing on hold.")).toBeVisible();
  });

  test("#79 AC3 Mark done moves the Goal to the Done tab", async ({ page, baseURL }) => {
    const account = await openGoals(page, baseURL!);
    await row(page, "Methods section for Friday")
      .getByRole("button", { name: "More actions for Methods section for Friday" })
      .click();
    await page
      .getByRole("dialog", { name: "Goal menu" })
      .getByRole("button", { name: "Mark done" })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "Marked done." })).toBeVisible();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("done");
    await tab(page, "Done").click();
    await expect(row(page, "Methods section for Friday")).toBeVisible();
  });

  test("#79 AC5 Reopen moves a Done Goal back to In progress", async ({ page, baseURL }) => {
    const account = await openGoals(page, baseURL!, sampleGoals, "/goals?tab=done");
    await row(page, "Lab report").getByRole("button", { name: "Reopen Lab report" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Reopened." })).toBeVisible();
    await expect.poll(() => goalStatus(account, GOAL.lab)).toBe("in_progress");
    await tab(page, "In progress").click();
    await expect(row(page, "Lab report")).toBeVisible();
  });

  test("#80 AC1 AC2 AC4 AC5 History lists sessions with a done Step: date, minutes, Steps; no totals", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!, sampleGoals, "/goals?tab=history");
    const rows = page.locator(".goals-history li");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("· Methods section for Friday");
    await expect(rows.nth(0)).toContainText("15 min");
    await expect(rows.nth(0)).toContainText("Gather what you need");
    await expect(rows.nth(1)).toContainText("· Lab report");
    await expect(rows.nth(2)).toContainText("· Portfolio case study");
    await expect(page.getByRole("tabpanel")).not.toContainText(/total|streak|%|partial|week/i);
  });

  test("#77 AC1 New goal opens one input and one arrow, with no pickers", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!);
    await page.getByRole("button", { name: "New goal" }).click();
    const sheet = page.getByRole("dialog", { name: "New goal" });
    await expect(sheet.getByText("What are you working on?")).toBeVisible();
    await expect(sheet.getByRole("textbox")).toHaveCount(1);
    await expect(sheet.getByRole("textbox", { name: "Your goal" })).toHaveAttribute(
      "placeholder",
      "e.g. Methods section for Friday",
    );
    await expect(sheet.getByRole("button", { name: "Next: choose steps" })).toBeVisible();
    await expect(
      sheet.locator("select, [role=radio], [role=combobox], input[type=date]"),
    ).toHaveCount(0);
  });

  test("#77 AC2 the arrow opens the goal dialogue with the line; Close keeps the draft", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!);
    await page.getByRole("button", { name: "New goal" }).click();
    const sheet = page.getByRole("dialog", { name: "New goal" });
    await sheet.getByRole("textbox", { name: "Your goal" }).fill("Read chapter four");
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole("button", { name: "New goal" }).click();
    await expect(sheet.getByRole("textbox", { name: "Your goal" })).toHaveValue(
      "Read chapter four",
    );
    await sheet.getByRole("button", { name: "Next: choose steps" }).click();
    await expect(page).toHaveURL(/\/goal\?line=Read(%20|\+)chapter(%20|\+)four$/);
  });

  test("#73 search filters Goals and History by title", async ({ page, baseURL }) => {
    await openGoals(page, baseURL!);
    const search = page.getByRole("searchbox", { name: "Search goals and history" });
    await search.fill("ielts");
    await expect(page.locator(".goals-row-title")).toHaveText(["IELTS listening, section 3"]);
    await search.fill("zzz");
    await expect(page.getByText("No matches.")).toBeVisible();
    await search.fill("lab");
    await tab(page, "History").click();
    await expect(page.locator(".goals-history li")).toHaveCount(1);
  });

  test("#73 #79 #80 each tab has its quiet empty line", async ({ page, baseURL }) => {
    await openGoals(page, baseURL!, () => ({}));
    await expect(page.getByText("No goals yet.")).toBeVisible();
    await tab(page, "On hold").click();
    await expect(page.getByText("Nothing on hold.")).toBeVisible();
    await tab(page, "Done").click();
    await expect(page.getByText("Nothing finished yet.")).toBeVisible();
    await tab(page, "History").click();
    await expect(page.getByText("Your sessions will show up here.")).toBeVisible();
  });
});
