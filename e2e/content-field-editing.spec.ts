import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// #313: the admin is a desktop tool (minimum width 1024 px), so its journeys run at 1280 px.
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

// #309: editing Companion and story fields in the admin (ADM-03 to ADM-05). The Supabase stub
// keeps one set of fields for every test, so these tests run one after the other and put the
// fields back before and after each test.

test.describe.configure({ mode: "serial" });

/** The server's story content reader key in the e2e config (playwright.config.ts). */
const READER_KEY = "e2e-content-reader";

async function resetFields() {
  const answer = await fetch(`${STUB_SUPABASE}/__content_fields`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  if (!answer.ok) throw new Error(`stub content fields failed: ${answer.status}`);
}

test.beforeEach(resetFields);
test.afterEach(resetFields);

/** What the app and the phones read (#284): get_story_content with the server's key. */
async function appStory(id: string) {
  const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/get_story_content`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reader_key: READER_KEY }),
  });
  const document = (await answer.json()) as {
    stories: { id: string; title: string; period: string }[];
  };
  return document.stories.find((story) => story.id === id)!;
}

const fieldOf = (page: Page, key: string) => page.getByRole("article", { name: key });

async function save(page: Page, key: string, text: string) {
  const field = fieldOf(page, key);
  await field.getByLabel(`Text for ${key}`).fill(text);
  await field.getByRole("button", { name: "Save draft" }).click();
}

// #442: on the Companion page each field's text is edited in place in its row, and the header
// row holds one Save draft and one Publish for the page (the admin prototype's ADM-04). Periods
// are on the Life Path tab.
const header = (page: Page) => page.locator(".admin-head");

async function openLifePath(page: Page) {
  // The tabs work once the page has loaded its scripts; the fields turn editable at that moment.
  await expect(page.locator('.admin-field-text[contenteditable="true"]').first()).toBeAttached();
  await page.getByRole("tab", { name: "Life Path" }).click();
  await expect(page.getByRole("tab", { name: "Life Path" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
}

async function saveInRow(page: Page, key: string, text: string) {
  await fieldOf(page, key).getByLabel(`Text for ${key}`).fill(text);
  await header(page).getByRole("button", { name: "Save draft" }).click();
}

const publishAll = (page: Page) => header(page).getByRole("button", { name: "Publish" }).click();

test("test_309_ac1_ac3_a_writer_saves_a_draft_and_cannot_publish", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/companions");
  await page.getByRole("link", { name: /J\. Robert Oppenheimer/ }).click();
  await openLifePath(page);
  await page.getByRole("link", { name: "The Fermi Award" }).click();
  await expect(page).toHaveURL(/\/admin\/companions\/oppenheimer\/stories\/fermi-award$/);

  const key = "opp.fermi-award.title";
  await save(page, key, "The Award at Last");
  const field = fieldOf(page, key);
  await expect(field.getByRole("status")).toHaveText(
    "Draft v2 saved. The app still shows the published text.",
  );
  await expect(field.getByRole("button", { name: "Publish v2" })).toBeDisabled();
  await expect(field).toContainText("Only an admin can publish.");
  // The text the app reads is unchanged.
  expect((await appStory("fermi-award")).title).toBe("The Fermi Award");
  // The model-only inputs are shown, read-only.
  await expect(page.getByRole("heading", { name: "Model inputs (read-only)" })).toBeVisible();
});

test("test_309_ac2_a_year_is_refused", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await page.goto("/admin/companions/oppenheimer/stories/fermi-award");
  const key = "opp.fermi-award.goal";
  await save(page, key, "Accept the award in 1963 without a speech.");
  const field = fieldOf(page, key);
  await expect(field.getByRole("status")).toHaveText("Not saved: it fails 1 check.");
  await expect(field.getByRole("list", { name: "Problems" })).toHaveText(
    'Mentions a year ("1963"). Years and dates stay in the admin.',
  );
  await expect(field.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
});

test("test_309_ac4_ac5_an_admin_renames_a_period_and_rolls_back", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/oppenheimer");
  await openLifePath(page);
  const key = "chr.opp.period.4";
  await saveInRow(page, key, "The years after the war");
  const field = fieldOf(page, key);
  await expect(field.getByRole("status")).toContainText("Draft v2 saved.");
  await expect(field.locator(":scope > .admin-pill")).toHaveText("Draft v2");
  await publishAll(page);
  await expect(field.getByRole("status")).toHaveText("Published v2.");
  // Every story of the period has the new name in what the app reads.
  expect((await appStory("huac-closed-session")).period).toBe("The years after the war");
  expect((await appStory("letter-to-uncle-jim")).period).toBe("The years after the war");

  await page.goto("/admin/publish-history");
  const published = page.getByRole("row", { name: `${key} v2, Published` }).first();
  // #313: a readable name before the key.
  await expect(published).toContainText("J. Robert Oppenheimer · period 4 name");
  await expect(published).toContainText("Published now");

  await page.goto("/admin/companions/oppenheimer");
  await openLifePath(page);
  const again = fieldOf(page, key);
  await again.getByText("Versions (2)").click();
  await again.getByRole("button", { name: "Roll back to v1" }).click();
  await expect(again.getByRole("status")).toHaveText("Rolled back to v1.");
  expect((await appStory("huac-closed-session")).period).toBe("After the war");

  // Publish history rolls back to v2 again (AC5).
  await page.goto("/admin/publish-history");
  const v2 = page.getByRole("row", { name: `${key} v2, Published` }).first();
  await v2.getByRole("button", { name: "Roll back to v2" }).click();
  await expect(v2.getByRole("status")).toHaveText("Rolled back to v2.");
  expect((await appStory("letter-to-uncle-jim")).period).toBe("The years after the war");
});

test("test_309_ac2_a_story_moves_only_to_a_neighbouring_period", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  // The first story of "After the war" may join the period before it.
  await page.goto("/admin/companions/oppenheimer/stories/huac-closed-session");
  const key = "opp.huac-closed-session.period";
  const select = fieldOf(page, key).getByLabel(`Text for ${key}`);
  await expect(select.locator("option")).toHaveText([
    "The Manhattan Project years",
    "After the war",
  ]);
});

test("test_309_ac4_a_moved_story_follows_its_new_period_when_that_period_is_renamed", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/oppenheimer/stories/huac-closed-session");
  const move = "opp.huac-closed-session.period";
  await fieldOf(page, move)
    .getByLabel(`Text for ${move}`)
    .selectOption("The Manhattan Project years");
  await fieldOf(page, move).getByRole("button", { name: "Save draft" }).click();
  await expect(fieldOf(page, move).getByRole("status")).toContainText("Draft v2 saved.");
  await fieldOf(page, move).getByRole("button", { name: "Publish v2" }).click();
  await expect(fieldOf(page, move).getByRole("status")).toHaveText("Published v2.");
  expect((await appStory("huac-closed-session")).period).toBe("The Manhattan Project years");

  // Period 3 is the Manhattan Project years, now with this story at its end.
  await page.goto("/admin/companions/oppenheimer");
  await openLifePath(page);
  const rename = "chr.opp.period.3";
  await saveInRow(page, rename, "The project years");
  await expect(fieldOf(page, rename).getByRole("status")).toContainText("Draft v2 saved.");
  await publishAll(page);
  await expect(fieldOf(page, rename).getByRole("status")).toHaveText("Published v2.");
  expect((await appStory("huac-closed-session")).period).toBe("The project years");
  expect((await appStory("trinity")).period).toBe("The project years");
  expect((await appStory("letter-to-uncle-jim")).period).toBe("After the war");
});

test("test_309_ac1_a_blank_new_field_starts_at_version_1", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/oppenheimer/stories/fermi-award");
  const key = "opp.fermi-award.path";
  const field = fieldOf(page, key);
  await expect(field).toContainText("Not written yet.");
  await save(page, key, "I take the award and say very little.");
  await expect(field.getByRole("status")).toHaveText(
    "Draft v1 saved. The app still shows the published text.",
  );
  await field.getByRole("button", { name: "Publish v1" }).click();
  await expect(field.getByRole("status")).toHaveText("Published v1.");
  await page.reload();
  const published = fieldOf(page, key);
  await expect(published.locator(".admin-card-body").first()).toHaveText(
    "I take the award and say very little.",
  );
  // One version only: nothing to roll back to.
  await expect(published.getByText(/^Versions/)).toHaveCount(0);
});

// #442: the header's Save draft makes a draft of each changed field (each its own version, each
// checked on its own), and Publish publishes each field's draft. Moriarty's fields only, so the
// visual gate (which reads Oppenheimer's Profile tab) never sees these drafts.
test("test_442_header_save_draft_and_publish_work_field_by_field", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/moriarty");
  const status = page.locator(".admin-head ~ p[role=status]");
  const tags = fieldOf(page, "chr.mor.tags");
  const who = fieldOf(page, "chr.mor.who");
  const name = fieldOf(page, "chr.mor.name");
  // Editable once the page has loaded its scripts.
  await expect(tags.getByLabel("Text for chr.mor.tags")).toHaveAttribute("contenteditable", "true");

  await tags.getByLabel("Text for chr.mor.tags").fill("Cold · Patient");
  await who.getByLabel("Text for chr.mor.who").fill("I run things from a distance.");
  // A text not saved yet is never published.
  await publishAll(page);
  await expect(status).toHaveText(
    "Save draft first: 2 changed fields on this tab are not saved yet.",
  );

  await header(page).getByRole("button", { name: "Save draft" }).click();
  await expect(status).toHaveText("Saved 2 drafts. The app still shows the published text.");
  await expect(tags.getByRole("status")).toHaveText(
    "Draft v2 saved. The app still shows the published text.",
  );
  await expect(who.getByRole("status")).toHaveText(
    "Draft v1 saved. The app still shows the published text.",
  );
  await expect(tags.locator(":scope > .admin-pill")).toHaveText("Draft v2");
  await expect(who.locator(":scope > .admin-pill")).toHaveText("Draft v1");
  // The field nobody changed has no new version.
  await expect(name.getByRole("status")).toHaveText("");
  await expect(name.locator(":scope > .admin-pill")).toHaveText("Published");

  await publishAll(page);
  await expect(status).toHaveText("Published 2 fields.");
  await expect(tags.getByRole("status")).toHaveText("Published v2.");
  await expect(who.getByRole("status")).toHaveText("Published v1.");
  await page.reload();
  const saved = fieldOf(page, "chr.mor.tags");
  await expect(saved.getByLabel("Text for chr.mor.tags")).toHaveText("Cold · Patient");
  await expect(saved.locator(":scope > .admin-pill")).toHaveText("Published");

  // A year is refused on its own field; the header says how many were not saved.
  const again = fieldOf(page, "chr.mor.who");
  await expect(again.getByLabel("Text for chr.mor.who")).toHaveAttribute("contenteditable", "true");
  await again.getByLabel("Text for chr.mor.who").fill("I ran things in 1890.");
  await header(page).getByRole("button", { name: "Save draft" }).click();
  await expect(status).toHaveText("1 field was not saved; see the field.");
  await expect(again.getByRole("status")).toHaveText("Not saved: it fails 1 check.");
  await expect(again.getByRole("list", { name: "Problems" })).toHaveText(
    'Mentions a year ("1890"). Years and dates stay in the admin.',
  );
});

// #442 review: the text edited in place stores exactly what the user typed, and nothing else.
// Moriarty's Profile fields, or Oppenheimer's Life Path periods: never Oppenheimer's Profile tab,
// which the visual gate reads.

/** Saves a draft straight through the stub's database function, as the signed-in account. */
async function storeDraft(token: string, key: string, body: string) {
  const answer = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/save_content_field_draft`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ field_key: key, field_body: body }),
  });
  if (!answer.ok) throw new Error(`stub save failed: ${answer.status}`);
}

/** The field's text box, once the page has loaded its scripts (it is editable from then on). */
async function textOf(page: Page, key: string) {
  const text = fieldOf(page, key).getByLabel(`Text for ${key}`);
  await expect(text).toHaveAttribute("contenteditable", "true");
  return text;
}

/** Puts the caret at the end of the field's text. */
async function caretAtEnd(page: Page, key: string) {
  const text = await textOf(page, key);
  await text.click();
  await text.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  return text;
}

const stored = (page: Page, key: string) =>
  fieldOf(page, key)
    .getByLabel(`Text for ${key}`)
    .evaluate((node) => ({ text: node.textContent, html: node.innerHTML }));

const saveDraft = (page: Page) => header(page).getByRole("button", { name: "Save draft" }).click();

test("test_442_review_pasted_rich_text_is_stored_as_plain_text", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/moriarty");
  const text = await textOf(page, "chr.mor.who");
  await text.focus();
  await text.evaluate((node) => {
    const data = new DataTransfer();
    data.setData("text/html", "<b>I plan</b> <i>everything</i><div>twice</div>");
    data.setData("text/plain", "I plan everything\ntwice");
    node.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await saveDraft(page);
  await expect(fieldOf(page, "chr.mor.who").getByRole("status")).toHaveText(
    "Draft v1 saved. The app still shows the published text.",
  );
  await page.reload();
  // Plain text on one line, no HTML.
  expect(await stored(page, "chr.mor.who")).toEqual({
    text: "I plan everything twice",
    html: "I plan everything twice",
  });
});

test("test_442_review_enter_and_shift_enter_add_no_line_break", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/moriarty");
  const key = "chr.mor.tags";
  const before = (await stored(page, key)).text;
  await caretAtEnd(page, key);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type(" · Cold");
  await saveDraft(page);
  await expect(fieldOf(page, key).getByRole("status")).toContainText("Draft v2 saved.");
  await page.reload();
  expect((await stored(page, key)).text).toBe(`${before} · Cold`);
});

test("test_442_review_a_typed_no_break_space_is_saved_exactly_as_typed", async ({
  page,
  context,
}) => {
  // Kept as typed, not turned into a space: with pre-wrap the browser never puts a no-break space
  // in on its own, so one in the text was typed or stored on purpose, and stored text is never
  // changed unless the user changed it.
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/moriarty");
  const key = "chr.mor.who";
  await (await textOf(page, key)).focus();
  await page.keyboard.insertText("Professor Moriarty, at  your service");
  await saveDraft(page);
  await expect(fieldOf(page, key).getByRole("status")).toContainText("Draft v1 saved.");
  await page.reload();
  expect((await stored(page, key)).text).toBe("Professor Moriarty, at  your service");
});

test("test_442_review_typing_then_restoring_the_text_saves_nothing", async ({ page, context }) => {
  await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await page.goto("/admin/companions/moriarty");
  const key = "chr.mor.tags";
  await caretAtEnd(page, key);
  await page.keyboard.type("Z");
  await page.keyboard.press("Backspace");
  await saveDraft(page);
  await expect(page.locator(".admin-head ~ p[role=status]")).toHaveText(
    "Nothing changed, so nothing was saved.",
  );
  await expect(fieldOf(page, key).locator(":scope > .admin-pill")).toHaveText("Published");
  await expect(fieldOf(page, key).getByText(/^Versions/)).toHaveCount(0);
});

test("test_442_review_a_stored_line_break_survives_an_edit_elsewhere", async ({
  page,
  context,
}) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const key = "chr.mor.who";
  await storeDraft(account.token, key, "I keep two notebooks.\nOne is for you.");
  await page.goto("/admin/companions/moriarty");
  expect((await stored(page, key)).text).toBe("I keep two notebooks.\nOne is for you.");
  // The line break is shown, not folded into a space.
  const text = await textOf(page, key);
  expect(await text.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("pre-wrap");
  await caretAtEnd(page, key);
  await page.keyboard.type(" Choose well.");
  await saveDraft(page);
  await expect(fieldOf(page, key).getByRole("status")).toContainText("Draft v2 saved.");
  await page.reload();
  expect((await stored(page, key)).text).toBe(
    "I keep two notebooks.\nOne is for you. Choose well.",
  );
});

test("test_442_review_one_field_publishes_on_its_own", async ({ page, context }) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await storeDraft(account.token, "chr.mor.tags", "Cold · Patient");
  await storeDraft(account.token, "chr.mor.who", "I run things from a distance.");
  await page.goto("/admin/companions/moriarty");
  await textOf(page, "chr.mor.tags");
  await expect(header(page).getByRole("button", { name: /^Publish/ })).toHaveText(
    "Publish 2 fields",
  );
  const tags = fieldOf(page, "chr.mor.tags");
  await tags.getByRole("button", { name: "Publish v2" }).click();
  await expect(tags.getByRole("status")).toHaveText("Published v2.");
  await expect(tags.locator(":scope > .admin-pill")).toHaveText("Published");
  // The other draft is untouched.
  const who = fieldOf(page, "chr.mor.who");
  await expect(who.locator(":scope > .admin-pill")).toHaveText("Draft v1");
  await expect(header(page).getByRole("button", { name: /^Publish/ })).toHaveText(
    "Publish 1 field",
  );
});

test("test_442_review_header_publish_takes_only_the_open_tab", async ({ page, context }) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const key = "chr.opp.period.6";
  await storeDraft(account.token, key, "His last years");
  await page.goto("/admin/companions/oppenheimer");
  await textOf(page, "chr.opp.name");
  // The Profile tab has no draft: its Publish publishes nothing.
  const publish = header(page).getByRole("button", { name: /^Publish/ });
  await expect(publish).toHaveText("Publish");
  await publish.click();
  const status = page.locator(".admin-head ~ p[role=status]");
  await expect(status).toHaveText("Nothing to publish: no field on this tab has a draft.");

  await openLifePath(page);
  // The draft on the other tab was left alone.
  await expect(fieldOf(page, key).locator(":scope > .admin-pill")).toHaveText("Draft v2");
  await expect(publish).toHaveText("Publish 1 field");
  await publish.click();
  await expect(status).toHaveText("Published 1 field.");
  await expect(fieldOf(page, key).getByRole("status")).toHaveText("Published v2.");
});

test("test_442_review_a_writer_cannot_publish_a_field", async ({ page, context }) => {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await storeDraft(account.token, "chr.mor.tags", "Cold · Patient");
  await page.goto("/admin/companions/moriarty");
  const publish = fieldOf(page, "chr.mor.tags").getByRole("button", { name: "Publish v2" });
  await expect(publish).toBeDisabled();
  await expect(publish).toHaveAccessibleDescription(
    "Only an admin can publish. Ask an admin to publish the drafts.",
  );
});
