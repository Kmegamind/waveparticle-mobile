import { expect, test } from "@playwright/test";
import { signIn } from "./support/account";
import { hotlineRows, useOwnHotlines } from "./support/hotlines";

// #448: ADM-14 Hotlines and ADM-15 Hotline entry in the layout of
// docs/design/prototype/admin-hotlines_2026-11-23_v1.html. Each test's account reads its own copy
// of the seed list, so no test here writes a row that another test (or the visual gate) reads.

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// Review of #465, I-1: the country list starts with no country, so Add an entry opens nothing
// until one is chosen (the browser's required check), and the server refuses an empty country.
test("test_448_add_an_entry_without_a_country_opens_nothing", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, undefined, { contentRole: "admin" });
  await useOwnHotlines(account.token, "seeded");
  await page.goto("/admin/hotlines");
  const list = page.getByLabel("Add an entry for a country with none");
  await expect(list).toHaveValue("");
  await expect(list.locator("option:checked")).toHaveText("Choose a country");
  await page
    .locator(".admin-head .admin-actions")
    .getByRole("button", { name: "Add an entry" })
    .click();
  // The browser stops the submit and names the missing value.
  expect(await list.evaluate((field: HTMLSelectElement) => field.validity.valueMissing)).toBe(true);
  expect(await list.evaluate((field: HTMLSelectElement) => field.validationMessage)).not.toBe("");
  await expect(page).toHaveURL(/\/admin\/hotlines$/);

  // Sent without the browser's check, the server opens no entry either.
  await page.goto("/admin/hotlines?add=");
  await expect(page).toHaveURL(/\/admin\/hotlines\?add=$/);
  const refused = page.getByRole("alert").filter({ hasText: "Choose a country" });
  await expect(refused).toHaveText("Choose a country from the list first. No entry was opened.");
  await expect(page.getByLabel("Add an entry for a country with none")).toHaveAccessibleDescription(
    "Choose a country from the list first. No entry was opened.",
  );
  await expect(page.getByRole("heading", { name: "Hotlines", level: 1 })).toBeVisible();
});

test("test_448_ac1_list_has_a_full_size_add_an_entry_in_the_header_row", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, undefined, { contentRole: "admin" });
  await useOwnHotlines(account.token, "seeded");
  await page.goto("/admin/hotlines");
  const actions = page.locator(".admin-head .admin-actions");
  const add = actions.getByRole("button", { name: "Add an entry" });
  await expect(add).toBeVisible();
  await expect(add).toHaveClass(/button-filled/);
  await expect(add).not.toHaveClass(/button-small/);
  // Beside the lede, not wrapped under it.
  const head = page.locator(".admin-head");
  const lede = await head.locator(".admin-lede").boundingBox();
  const row = await actions.boundingBox();
  expect(row!.x).toBeGreaterThan(lede!.x + lede!.width);
  // The table sits in a panel; the country list is under it, and the header button submits it.
  await expect(page.locator(".admin-panel .admin-table")).toBeVisible();
  await page.getByLabel("Add an entry for a country with none").selectOption("NZ");
  await add.click();
  await expect(page).toHaveURL(/\/admin\/hotlines\/NZ$/);
  await expect(page.getByText("Nothing is published for New Zealand")).toBeVisible();
});

test("test_448_ac1_entry_has_header_buttons_two_panels_and_a_versions_table", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, undefined, { contentRole: "admin" });
  await useOwnHotlines(account.token, "seeded");
  await page.goto("/admin/hotlines/US");
  const actions = page.getByRole("group", { name: "Hotline actions" });
  await expect(actions.getByRole("button", { name: "Save draft" })).toBeVisible();
  await expect(page.locator(".admin-hotline-legal")).toContainText(
    "A new or changed entry should be checked against the legal review (#121) before Publish.",
  );

  const entry = page.getByRole("region", { name: "Entry" });
  const preview = page.getByRole("region", { name: "Preview on S1" });
  await expect(entry).toHaveClass(/admin-panel/);
  await expect(preview).toHaveClass(/admin-panel/);
  await expect(entry.getByLabel("Country")).toHaveValue("United States (US)");
  await expect(entry.getByLabel("Country")).toHaveAttribute("readonly", "");
  const left = await entry.boundingBox();
  const right = await preview.boundingBox();
  // Side by side, the entry wider (the prototype's 1.3fr and 1fr).
  expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(1);
  expect(left!.x + left!.width).toBeLessThan(right!.x);
  expect(left!.width / right!.width).toBeCloseTo(1.3, 1);

  const versions = preview.getByRole("table", { name: "Versions" });
  await expect(versions.getByRole("columnheader")).toHaveText(["Version", "State", "Saved"]);
  const row = versions.getByRole("row", { name: /v1/ });
  await expect(row).toContainText("Published");
  await expect(row).toContainText("11-23");
  await expect(row).toContainText("Call or text 988");
});

test("test_448_saving_untouched_fields_keeps_every_stored_value_exactly", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, undefined, { contentRole: "admin" });
  await useOwnHotlines(account.token, "copy");
  await page.goto("/admin/hotlines/US");
  await page
    .getByRole("group", { name: "Hotline actions" })
    .getByRole("button", { name: "Save draft" })
    .click();
  await expect(page.getByText("Draft v2 saved.")).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Hotline actions" })
      .getByRole("button", { name: "Publish v2" }),
  ).toBeVisible();

  const rows = await hotlineRows(account.token);
  const v1 = rows.find((row) => row.country === "US" && row.version === 1)!;
  const v2 = rows.find((row) => row.country === "US" && row.version === 2)!;
  for (const column of [
    "country",
    "service_name",
    "primary_kind",
    "primary_value",
    "secondary_kind",
    "secondary_value",
    "note",
    "checked_on",
    "checked_by",
  ]) {
    expect(v2[column], column).toStrictEqual(v1[column]);
  }
});

test("test_448_roll_back_sits_in_the_versions_table", async ({ page, context, baseURL }) => {
  const account = await signIn(context, baseURL!, undefined, { contentRole: "admin" });
  await useOwnHotlines(account.token, "copy");
  await page.goto("/admin/hotlines/US");
  const actions = page.getByRole("group", { name: "Hotline actions" });
  // A test-only change of who checked it (an own copy; the shared list and S1 never see it).
  await page.getByLabel("Checked by").fill("e2e test");
  await actions.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft v2 saved.")).toBeVisible();
  await actions.getByRole("button", { name: "Publish v2" }).click();
  await expect(page.getByText("Published v2.")).toBeVisible();

  const versions = page.getByRole("table", { name: "Versions" });
  await versions.getByRole("button", { name: "Roll back to v1" }).click();
  await expect(page.getByText("Rolled back to v1.")).toBeVisible();
  const rows = await hotlineRows(account.token);
  expect(rows.find((row) => row.version === 1)).toMatchObject({ published: true });
  expect(rows.find((row) => row.version === 2)).toMatchObject({ published: false });
});
