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
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
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
