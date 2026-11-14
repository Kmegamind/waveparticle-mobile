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

  test("finding: after a change from the ⋯ menu, a row button or Undo, focus is on the selected tab", async ({
    page,
    baseURL,
  }) => {
    const account = await openGoals(page, baseURL!);
    await row(page, "Methods section for Friday")
      .getByRole("button", { name: "More actions for Methods section for Friday" })
      .click();
    await page
      .getByRole("dialog", { name: "Goal menu" })
      .getByRole("button", { name: "Put on hold" })
      .click();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("on_hold");
    await expect(row(page, "Methods section for Friday")).toHaveCount(0);
    await expect(tab(page, "In progress")).toBeFocused();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("in_progress");
    await expect(tab(page, "In progress")).toBeFocused();

    await tab(page, "On hold").click();
    await row(page, "Portfolio case study")
      .getByRole("button", { name: "Resume Portfolio case study" })
      .click();
    await expect.poll(() => goalStatus(account, GOAL.portfolio)).toBe("in_progress");
    await expect(page.getByText("Nothing on hold.")).toBeVisible();
    await expect(tab(page, "On hold")).toBeFocused();
  });

  test("finding: after a change that fails, the error is read and focus is on the selected tab", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!, sampleGoals, "/goals?tab=hold");
    await page.route("**/*", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await row(page, "Portfolio case study")
      .getByRole("button", { name: "Resume Portfolio case study" })
      .click();
    await expect(page.locator(".goals-toast[role=alert]")).toHaveText(
      "Could not change the Goal. Please try again.",
    );
    await expect(tab(page, "On hold")).toBeFocused();
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

  test("#77 #79 Close on a sheet returns focus to the button that opened it", async ({
    page,
    baseURL,
  }) => {
    await openGoals(page, baseURL!);
    const opener = page.getByRole("button", { name: "New goal" });
    await opener.click();
    await page
      .getByRole("dialog", { name: "New goal" })
      .getByRole("button", { name: "Close" })
      .click();
    await expect(opener).toBeFocused();
    const more = page.getByRole("button", { name: "More actions for Methods section for Friday" });
    await more.click();
    await page
      .getByRole("dialog", { name: "Goal menu" })
      .getByRole("button", { name: "Close" })
      .click();
    await expect(more).toBeFocused();
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

test.describe("the Goal detail", () => {
  const detail = (page: Page, baseURL: string, id: string, tables = sampleGoals) =>
    openGoals(page, baseURL, tables, `/goals/${id}`);

  test("#78 AC1 the detail shows the title, status, Companion, type, Steps and Continue", async ({
    page,
    baseURL,
  }) => {
    await detail(page, baseURL!, GOAL.methods);
    await expect(page.getByRole("textbox", { name: "Goal" })).toHaveValue(
      "Methods section for Friday",
    );
    await expect(page.getByText("In progress · with Oppenheimer")).toBeVisible();
    const type = page.getByRole("radiogroup", { name: "Type" });
    await expect(type.getByRole("radio", { name: /One-time/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(type.getByRole("radio", { name: /Ongoing/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(page.locator(".goal-steps .goal-step-title")).toHaveText([
      "Gather what you need",
      "Rough first pass",
      "Second pass",
      "Check and tidy",
    ]);
    const go = page.getByRole("link", { name: "Continue", exact: true });
    await expect(go).toHaveAttribute("href", `/focus?goal=${GOAL.methods}`);
    await expect(page.getByRole("link", { name: "Back to Goals" })).toHaveAttribute(
      "href",
      "/goals",
    );
  });

  test("#78 AC2 #39 AC2 each Step shows its title and description; tapping one says how Steps get done", async ({
    page,
    baseURL,
  }) => {
    await detail(page, baseURL!, GOAL.methods);
    const first = page.locator(".goal-steps li").first();
    await expect(first).toContainText(
      "Collect the notes and sources you will use; watch for anything missing before you start writing.",
    );
    await expect(first).toContainText("(done)");
    await expect(page.locator(".goal-steps li").nth(2)).toContainText("(not done)");
    await first.getByRole("button").click();
    await expect(
      page.getByRole("status").filter({ hasText: "Complete steps in your session." }),
    ).toBeVisible();
    for (const word of [/add a step/i, /remove/i, /rename/i]) {
      await expect(page.getByRole("button", { name: word })).toHaveCount(0);
    }
  });

  test("#78 AC3 nothing open: Nothing open right now. and Start", async ({ page, baseURL }) => {
    await detail(page, baseURL!, GOAL.ielts);
    await expect(page.getByText("Nothing open right now.")).toBeVisible();
    // A short detail keeps its controls at their own size (no stretched rows).
    const field = await page.getByRole("textbox", { name: "Goal" }).boundingBox();
    expect(Math.round(field!.height)).toBeLessThanOrEqual(56);
    const chip = await page.getByRole("radio", { name: /Ongoing/ }).boundingBox();
    expect(Math.round(chip!.height)).toBeLessThanOrEqual(48);
    await expect(page.getByRole("link", { name: "Start", exact: true })).toHaveAttribute(
      "href",
      `/goal?line=${encodeURIComponent("IELTS listening, section 3")}`,
    );
  });

  test("#78 AC4 on hold: Resume, and the Steps exactly as they were left", async ({
    page,
    baseURL,
  }) => {
    const account = await detail(page, baseURL!, GOAL.portfolio);
    await expect(page.getByText("On hold · with Oppenheimer")).toBeVisible();
    await expect(page.locator(".goal-steps li").first()).toContainText("(done)");
    await expect(page.locator(".goal-steps li").nth(1)).toContainText("(not done)");
    await expect(page.getByRole("button", { name: "Put on hold" })).toHaveCount(0);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Back in progress." })).toBeVisible();
    await expect.poll(() => sessionState(account, SESSION.portfolio)).toBe("open");
    await expect(page.getByText("In progress · with Oppenheimer")).toBeVisible();
  });

  test("#78 AC5 the detail shows no total minutes, Step x of N or last-active date", async ({
    page,
    baseURL,
  }) => {
    await detail(page, baseURL!, GOAL.methods);
    const main = page.locator("main");
    await expect(main).not.toContainText(/Step \d+ of \d+|last active|total/i);
    await expect(main.locator(".goal-steps")).not.toContainText(/\d+ min/);
  });

  test("#77 AC4 the type chip saves Ongoing", async ({ page, baseURL }) => {
    const account = await detail(page, baseURL!, GOAL.methods);
    await page.getByRole("radio", { name: /Ongoing/ }).click();
    await expect(page.getByRole("radio", { name: /Ongoing/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect
      .poll(
        async () =>
          (await stubTables(account)).goals.find((goal) => goal.id === GOAL.methods)?.kind,
      )
      .toBe("ongoing");
  });

  test("#78 renaming saves on blur; an empty field brings the old title back; crisis words open the safety page", async ({
    page,
    baseURL,
  }) => {
    const account = await detail(page, baseURL!, GOAL.methods);
    const title = page.getByRole("textbox", { name: "Goal" });
    const stored = async () =>
      (await stubTables(account)).goals.find((goal) => goal.id === GOAL.methods)?.title;
    await title.fill("Methods, first draft");
    await title.blur();
    await expect.poll(stored).toBe("Methods, first draft");
    await title.fill("   ");
    await title.blur();
    await expect(title).toHaveValue("Methods, first draft");
    await title.fill("I want to kill myself");
    await title.press("Enter");
    await expect(page).toHaveURL(/\/safety/);
    expect(await stored()).toBe("Methods, first draft");
  });

  test("#79 AC1 AC4 the footer puts on hold and marks done, each with Undo", async ({
    page,
    baseURL,
  }) => {
    const account = await detail(page, baseURL!, GOAL.methods);
    await page.getByRole("button", { name: "Put on hold" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Put on hold." })).toBeVisible();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("on_hold");
    await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("in_progress");
    await page.getByRole("button", { name: "Mark done" }).click();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("done");
    await expect(page.getByRole("button", { name: "Reopen", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(0);
  });

  test("finding: after Put on hold or Undo on the detail, focus is on the status line", async ({
    page,
    baseURL,
  }) => {
    const account = await detail(page, baseURL!, GOAL.methods);
    // What a screen reader reads when focus arrives: the line must already say the new status.
    await page.evaluate(() => {
      const heard: string[] = [];
      (window as unknown as { heard: string[] }).heard = heard;
      document
        .getElementById("goal-status")!
        .addEventListener("focus", (event) =>
          heard.push((event.target as HTMLElement).textContent ?? ""),
        );
    });
    const heard = () => page.evaluate(() => (window as unknown as { heard: string[] }).heard);
    await page.getByRole("button", { name: "Put on hold" }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("on_hold");
    await expect(page.locator(".goal-status")).toBeFocused();
    expect(await heard()).toEqual([expect.stringMatching(/^On hold/)]);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => goalStatus(account, GOAL.methods)).toBe("in_progress");
    await expect(page.locator(".goal-status")).toBeFocused();
    await expect
      .poll(heard)
      .toEqual([expect.stringMatching(/^On hold/), expect.stringMatching(/^In progress/)]);
  });

  test("#78 the footer stays at the bottom of the screen while the Steps scroll", async ({
    page,
    baseURL,
  }) => {
    await detail(page, baseURL!, GOAL.methods);
    const go = await page.getByRole("link", { name: "Continue", exact: true }).boundingBox();
    expect(go!.y + go!.height).toBeLessThanOrEqual(800);
    expect(go!.y + go!.height).toBeGreaterThan(700);
  });

  test("#80 recent sessions on the detail, with See all", async ({ page, baseURL }) => {
    await detail(page, baseURL!, GOAL.lab);
    await expect(page.locator(".goals-history li")).toHaveCount(1);
    await expect(page.locator(".goals-history li")).not.toContainText("Lab report");
    await expect(page.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/goals?tab=history",
    );
    await page.goto(`/goals/${GOAL.ielts}`);
    await expect(page.getByText("None yet.")).toBeVisible();
  });

  test("#78 another account's Goal and a bad id are not found", async ({ page, baseURL }) => {
    await signIn(page.context(), baseURL!, sampleGoals);
    // Next 16 streams the shell first, so the not-found page comes with status 200; what matters
    // is that it is the not-found page and shows nothing of any Goal.
    for (const path of ["/goals/99999999-9999-4999-8999-999999999999", "/goals/not-a-uuid"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "This page could not be found." }),
      ).toBeVisible();
      await expect(page.locator("main")).toHaveCount(0);
      await expect(page.getByText("Methods section for Friday")).toHaveCount(0);
    }
  });
});

test.describe("the goal dialogue from Goals", () => {
  test("#77 AC2 /goal?line= opens the dialogue with the line in the composer; the safety gate still runs on Send", async ({
    page,
    baseURL,
  }) => {
    await signIn(page.context(), baseURL!, sampleGoals);
    await page.goto(`/goal?line=${encodeURIComponent("Read chapter four")}`);
    await expect(page.getByLabel("Your goal")).toHaveValue("Read chapter four");
    await page.goto(`/goal?line=${encodeURIComponent("I want to kill myself")}`);
    await expect(page.getByLabel("Your goal")).toHaveValue("I want to kill myself");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  });
});
