import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #442: the Companion profile page (ADM-04) as the admin prototype draws it: Save draft and
// Publish in the header row, tabs, and one dl.fields row per field with its id and state pill.
// These tests only read; nothing here writes a field (the writes are in
// content-field-editing.spec.ts, which runs its tests one after the other).

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

test("test_442_ac1_profile_tab_has_field_rows_with_ids_pills_and_header_actions", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/oppenheimer");

  const head = page.locator(".admin-head");
  await expect(head.locator("h1")).toHaveText("J. Robert Oppenheimer");
  await expect(head.locator(".admin-lede")).toHaveText(
    "Historical · chr.opp · each field has its own id and its own state.",
  );
  await expect(head.locator(".admin-actions").getByRole("button")).toHaveText([
    "Save draft",
    "Publish",
  ]);
  await expect(head.getByRole("button", { name: "Publish" })).toBeEnabled();
  // One Save draft for the page: no editor panel and no Save draft per field.
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(1);

  const tabs = page.getByRole("tablist").getByRole("tab");
  await expect(tabs).toHaveText(["Profile", "Life Path"]);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

  const panel = page.getByRole("tabpanel", { name: "Profile" });
  await expect(panel.locator("dl.admin-fields > dt")).toHaveText([
    "Namechr.opp.name",
    "Tagschr.opp.tags",
    "One line (Companions)chr.opp.line",
    "Who I amchr.opp.who",
  ]);
  const pills = panel.locator("dl.admin-fields > dd .admin-pill");
  await expect(pills).toHaveText(["Published", "Published", "Read only", "Not written"]);
  // The text is edited in place, in the row.
  await expect(panel.getByLabel("Text for chr.opp.name")).toHaveText("J. Robert Oppenheimer");
  await expect(panel.getByLabel("Text for chr.opp.name")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  // The one line is the Companions screen's line, shown but not editable here yet.
  const line = panel.getByRole("article", { name: "chr.opp.line" });
  await expect(line).toContainText("I can give you the answer.");
  await expect(line.locator("[contenteditable]")).toHaveCount(0);
});

test("test_442_life_path_tab_lists_each_period_with_its_stories", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/oppenheimer");
  // The tabs work once the page has loaded its scripts; the fields turn editable at that moment.
  await expect(page.getByLabel("Text for chr.opp.name")).toHaveAttribute("contenteditable", "true");
  const profile = page.getByRole("tab", { name: "Profile" });
  await profile.focus();
  await page.keyboard.press("ArrowRight");
  const lifePath = page.getByRole("tab", { name: "Life Path" });
  await expect(lifePath).toBeFocused();
  await expect(lifePath).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Profile" })).toBeHidden();

  const panel = page.getByRole("tabpanel", { name: "Life Path" });
  await expect(panel.locator("dl.admin-fields > dt").first()).toHaveText(
    "Period 1chr.opp.period.1",
  );
  await expect(panel.locator("dl.admin-fields > dt")).toHaveCount(6);
  await expect(
    panel.getByRole("article", { name: "chr.opp.period.1" }).locator(".admin-pill"),
  ).toBeVisible();
  await panel.getByRole("link", { name: "The Fermi Award" }).click();
  await expect(page).toHaveURL(/\/admin\/companions\/oppenheimer\/stories\/fermi-award$/);
});

test("test_442_a_writer_cannot_publish_and_is_told_why", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/companions/oppenheimer");
  const publish = page.locator(".admin-head").getByRole("button", { name: "Publish" });
  await expect(publish).toBeDisabled();
  await expect(publish).toHaveAccessibleDescription(
    "Only an admin can publish. Ask an admin to publish the drafts.",
  );
  await expect(
    page.locator(".admin-head").getByRole("button", { name: "Save draft" }),
  ).toBeEnabled();
});
