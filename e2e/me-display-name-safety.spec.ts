import { expect, test } from "@playwright/test";
import { signIn, stubTables, type StubAccount } from "./support/account";

// #392: the display name on Me passes the server's safety check before it is saved. The e2e app
// has no model, so the keyword layer decides; the classifier path is covered by
// tests/me-display-name-safety-392.test.ts with a fake.

test.use({ viewport: { width: 390, height: 800 } });

const nickname = async (account: StubAccount) =>
  (await stubTables(account)).profiles.find((row) => row.user_id === account.userId)?.nickname;

test("#392 crisis words in the display name show S1 on Me; Back returns to an empty field and nothing is saved", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, (userId) => ({
    profiles: [{ user_id: userId, nickname: "Ada", keep_clock_running: false }],
  }));
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Me", level: 1 })).toBeVisible();

  // AC3: ordinary text is saved as today.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill("Grace");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Grace", { exact: true })).toBeVisible();
  await expect.poll(() => nickname(account)).toBe("Grace");

  // AC1 and AC2: a crisis saves nothing and shows S1 in place of Me, at the same address.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill("I want to kill myself");
  await page.getByRole("button", { name: "Save changes" }).click();
  const s1 = page.getByRole("heading", { name: "This is outside the story." });
  await expect(s1).toBeVisible();
  // #398: focus moves to the S1 title, so a screen reader announces it.
  await expect(s1).toBeFocused();
  await expect(page.getByRole("heading", { name: "Me", level: 1 })).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Display name" })).toBeHidden();
  await expect(page).toHaveURL(/\/me$/);
  expect(await nickname(account)).toBe("Grace");

  // Back returns to Me in edit mode with the field emptied; the saved name is unchanged.
  await page.getByRole("button", { name: "Back to my Goal" }).click();
  await expect(page.getByRole("heading", { name: "Me", level: 1 })).toBeVisible();
  const field = page.getByRole("textbox", { name: "Display name" });
  await expect(field).toHaveValue("");
  await expect(field).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Grace", { exact: true })).toBeVisible();
  expect(await nickname(account)).toBe("Grace");
});

test("#398 Save shows a pending state and sends once; a crisis that arrives after Cancel does not open S1", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, (userId) => ({
    profiles: [{ user_id: userId, nickname: "Ada", keep_clock_running: false }],
  }));
  // Hold every Save (a server action is a POST to /me) for a moment, as a slow classifier would.
  let saves = 0;
  await page.route("**/me", async (route) => {
    if (route.request().method() === "POST") {
      saves += 1;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    await route.continue();
  });
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Me", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill("Grace");
  await page.getByRole("button", { name: "Save changes" }).click();
  const saving = page.getByRole("button", { name: "Saving…" });
  await expect(saving).toBeDisabled();
  await saving.click({ force: true });
  await expect(page.getByText("Grace", { exact: true })).toBeVisible();
  expect(saves).toBe(1);
  await expect.poll(() => nickname(account)).toBe("Grace");

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill("I want to kill myself");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => saves).toBe(2);
  // Wait past the held answer: it arrives, and S1 still does not open.
  await page.waitForTimeout(2000);
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Me", level: 1 })).toBeVisible();
  await expect(page.getByText("Grace", { exact: true })).toBeVisible();
  expect(await nickname(account)).toBe("Grace");

  // Fix round 1: a Save that the server finishes after Cancel did write the name, so Me shows it.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Display name" }).fill("Lise");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Grace", { exact: true })).toBeVisible();
  await expect(page.getByText("Lise", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect.poll(() => nickname(account)).toBe("Lise");
});

test("#398 after an invalid save from the keyboard, focus returns to the name field", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, (userId) => ({
    profiles: [{ user_id: userId, nickname: "Ada", keep_clock_running: false }],
  }));
  await page.goto("/me");
  await page.getByRole("button", { name: "Edit" }).click();
  const field = page.getByRole("textbox", { name: "Display name" });
  await field.fill("x".repeat(61));
  await page.getByRole("button", { name: "Save changes" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Use 1 to 60" })).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("x".repeat(61));
});
