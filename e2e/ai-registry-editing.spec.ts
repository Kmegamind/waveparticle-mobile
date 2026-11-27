import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #475 (registry slice 3; docs/PRD.md FR-AIREG-7, AI-PAGE-EDIT, AI-EXAMPLE-CONFIRM): editing the
// registry. Each test's account reads and writes its own copy of the 19 registry rows
// (POST /__ai_features { token, registry: true }, the invented fixtures of tests/fixtures/
// ai-registry/), so nothing here changes a row another test or the visual gate reads. No model is
// called. The local Supabase stand-in serves 20261204000000_ai_registry_editing.sql
// (e2e/support/stub-ai-registry-editing.mjs).

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

async function stub(pathname: string, token: string | null, body?: unknown) {
  return fetch(`${STUB_SUPABASE}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function registryAccount(page: Page, context: BrowserContext, role: "admin" | "writer") {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: role });
  const answer = await stub("/__ai_features", null, { token: account.token, registry: true });
  expect(answer.status).toBe(200);
  return { ...account, email: `${account.userId}@example.invalid` };
}

const region = (page: Page, name: string | RegExp) => page.getByRole("region", { name });
const form = (page: Page) => page.getByRole("form", { name: "Registry fields" });
const historyRows = (page: Page) =>
  page.getByRole("table", { name: "Field history" }).locator("tbody tr");

type Row = Record<string, unknown>;
const readRow = async (token: string, slug: string) =>
  ((await (await stub(`/rest/v1/ai_features?slug=eq.${slug}`, token)).json()) as Row[])[0];

test("test_475_ac1_a_writer_edits_the_name_and_fields_of_a_pipeline_row_with_history", async ({
  page,
  context,
}) => {
  const writer = await registryAccount(page, context, "writer");
  await page.goto("/admin/ai-features/p01_find_episodes");
  await page.getByRole("link", { name: "Edit fields" }).click();
  await expect(page).toHaveURL(/\/admin\/ai-features\/p01_find_episodes\/fields$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "P-01 Find episodes · registry fields",
  );
  await expect(form(page).getByRole("textbox", { name: "Name" })).toHaveValue("Find episodes");
  await expect(form(page).getByRole("textbox", { name: "Notes" })).toHaveValue("");
  await expect(historyRows(page)).toHaveCount(0);

  await form(page).getByRole("textbox", { name: "Name" }).fill("Find more episodes");
  await form(page).getByRole("textbox", { name: "Requirement" }).fill("Invented need, edited.");
  await form(page).getByRole("textbox", { name: "Notes" }).fill("Invented note.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");

  // Every change is in the field history: who (by email), when, the field, old and new.
  await expect(historyRows(page)).toHaveCount(3);
  const name = historyRows(page).filter({ hasText: "Name" });
  await expect(name.locator("td")).toHaveText([
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    writer.email,
    "Name",
    "Find episodes",
    "Find more episodes",
  ]);
  await expect(historyRows(page).filter({ hasText: "Notes" }).locator("td").nth(3)).toHaveText(
    "Not written yet",
  );
  await expect(region(page, "Last save")).toContainText(writer.email);

  // The feature page shows the new values; the title keeps its prompt key.
  await page.goto("/admin/ai-features/P-01");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("P-01 Find more episodes");
  await expect(region(page, "Requirement")).toContainText("Invented need, edited.");
  await expect(region(page, "Notes")).toContainText("Invented note.");
  expect(await readRow(writer.token, "p01_find_episodes")).toMatchObject({
    title: "Find more episodes (p01_find_episodes)",
    category: "pipeline",
    status: "exploring",
    fields_updated_by: writer.userId,
  });
});

test("test_475_ac1_an_admin_edits_a_runtime_row_and_a_stale_editor_overwrites_nothing", async ({
  page,
  context,
}) => {
  const admin = await registryAccount(page, context, "admin");
  await page.goto("/admin/ai-features/rest_reply/fields");
  await form(page).getByRole("textbox", { name: "Where it appears" }).fill("Invented place");
  // Someone else saves after this page was loaded.
  const before = await readRow(admin.token, "rest_reply");
  const other = await stub("/rest/v1/rpc/save_ai_feature_registry_fields", admin.token, {
    target_feature: "rest_reply",
    loaded_at: before.fields_updated_at ?? null,
    new_name: "Rest reply",
    new_where_used: "Saved elsewhere",
    new_requirement: String(before.requirement),
    new_output_format: String(before.output_format),
    new_design_rationale: String(before.design_rationale),
    new_room_to_improve: String(before.room_to_improve),
    new_notes: String(before.notes),
  });
  expect(other.status).toBe(200);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Someone saved this feature");
  expect(await readRow(admin.token, "rest_reply")).toMatchObject({ where_used: "Saved elsewhere" });

  // After a reload the admin's save goes through.
  await page.reload();
  await form(page).getByRole("textbox", { name: "Where it appears" }).fill("Invented place");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await expect(historyRows(page).first().locator("td").nth(4)).toHaveText("Invented place");
  await expect(historyRows(page).first().locator("td").nth(3)).toHaveText("Saved elsewhere");
});

test("test_475_ac2_a_writer_cannot_change_the_status_or_the_category", async ({
  page,
  context,
}) => {
  const writer = await registryAccount(page, context, "writer");
  await page.goto("/admin/ai-features/g01_judge_plan/fields");
  const category = region(page, /^Category/);
  await expect(category).toHaveClass(/admin-ro/);
  await expect(category).toContainText("Admin only");
  await expect(category).toContainText("You can see the category. Only an admin can change it.");
  for (const button of await category.getByRole("button").all()) {
    await expect(button).toBeDisabled();
  }
  await page.goto("/admin/ai-features/g01_judge_plan");
  await expect(region(page, /^Status/).getByRole("button")).toHaveCount(0);

  // The database refuses a writer's own request too (42501), and nothing changes.
  for (const [fn, body] of [
    ["set_ai_feature_category", { target_feature: "g01_judge_plan", new_category: "pipeline" }],
    ["set_ai_feature_status", { target_feature: "g01_judge_plan", new_status: "passed" }],
  ] as const) {
    const answer = await stub(`/rest/v1/rpc/${fn}`, writer.token, body);
    expect(answer.status, fn).toBe(403);
    expect((await answer.json()).code, fn).toBe("42501");
  }
  // The fields' save ignores a category or status it is sent.
  const row = await readRow(writer.token, "g01_judge_plan");
  const fields = await stub("/rest/v1/rpc/save_ai_feature_registry_fields", writer.token, {
    target_feature: "g01_judge_plan",
    loaded_at: null,
    new_name: "Judge plan",
    new_where_used: String(row.where_used),
    new_requirement: String(row.requirement),
    new_output_format: String(row.output_format),
    new_design_rationale: String(row.design_rationale),
    new_room_to_improve: String(row.room_to_improve),
    new_notes: String(row.notes),
    new_category: "pipeline",
    new_status: "passed",
  });
  expect(fields.status).toBe(200);
  expect(await readRow(writer.token, "g01_judge_plan")).toMatchObject({
    category: "gate",
    status: row.status,
  });
});

test("test_475_ac2_an_admin_changes_the_category_and_the_status_of_a_gate_row", async ({
  page,
  context,
}) => {
  const admin = await registryAccount(page, context, "admin");
  await page.goto("/admin/ai-features/g01_judge_plan/fields");
  const category = region(page, /^Category/);
  await expect(category.getByRole("button", { name: "Quality gate" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await category.getByRole("button", { name: "Pipeline" }).click();
  await category.getByRole("button", { name: "Save category" }).click();
  await expect(page.getByRole("status")).toHaveText("Category saved.");
  await expect(historyRows(page).first().locator("td")).toHaveText([
    /\d{2}:\d{2}$/,
    admin.email,
    "Category",
    "Quality gate",
    "Pipeline",
  ]);

  await page.goto("/admin/ai-features/g01_judge_plan");
  const status = region(page, /^Status/);
  await status.getByRole("button", { name: "Passed" }).click();
  await status.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByRole("status")).toHaveText("Status saved.");
  await expect(status.locator("h2 .admin-pill-ai-passed")).toHaveText("Passed");
  expect(await readRow(admin.token, "g01_judge_plan")).toMatchObject({
    category: "pipeline",
    status: "passed",
  });
});

test("test_475_ac3_a_writer_confirms_a_candidate_and_a_replaced_example_stays_in_history", async ({
  page,
  context,
}) => {
  const writer = await registryAccount(page, context, "writer");
  await page.goto("/admin/ai-features/p01_find_episodes");
  const example = region(page, "Confirmed example");
  await expect(example.locator(".admin-example-meta .admin-pill-example-candidate")).toBeVisible();
  await example.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("status")).toHaveText("Example confirmed.");
  await expect(example.locator(".admin-example-meta .admin-pill-example-confirmed")).toBeVisible();
  await expect(example.locator(".admin-example-meta")).toContainText(
    `Confirmed by ${writer.email}`,
  );
  await expect(example.getByRole("button", { name: "Confirm" })).toHaveCount(0);

  // A new confirmed example replaces it; the old one stays in the history.
  await page.goto("/admin/ai-features/p01_find_episodes/fields");
  const editor = region(page, /^Confirmed example/);
  await editor.getByRole("textbox", { name: "Example text" }).fill("Invented better output.");
  await expect(editor.getByRole("button", { name: "Confirmed" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await editor.getByRole("button", { name: "Save example" }).click();
  await expect(page.getByRole("status")).toHaveText("Example saved.");
  const rows = editor.getByRole("table", { name: "Example history" }).locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Invented better output.");
  await expect(rows.nth(0)).toContainText(writer.email);
  await expect(rows.nth(1)).toContainText("Invented example for P-01.");
  await expect(rows.nth(1).locator(".admin-pill-example-confirmed")).toBeVisible();
});

test("test_475_ac3_an_admin_sets_a_candidate_and_a_state_needs_text", async ({ page, context }) => {
  const admin = await registryAccount(page, context, "admin");
  await page.goto("/admin/ai-features/g03_judge_cards/fields");
  const editor = region(page, /^Confirmed example/);
  await editor.getByRole("button", { name: "Candidate" }).click();
  await editor.getByRole("button", { name: "Save example" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "A candidate or confirmed example needs its text.",
  );
  await editor.getByRole("textbox", { name: "Example text" }).fill("Invented output.");
  await editor.getByRole("button", { name: "Save example" }).click();
  await expect(page.getByRole("status")).toHaveText("Example saved.");
  expect(await readRow(admin.token, "g03_judge_cards")).toMatchObject({
    example_text: "Invented output.",
    example_state: "candidate",
    example_set_by: admin.userId,
  });
  await page.goto("/admin/ai-features/g03_judge_cards");
  await expect(
    region(page, "Confirmed example").getByRole("button", { name: "Confirm" }),
  ).toBeVisible();
});

test("test_475_app_users_and_visitors_get_no_editor", async ({ page, context, browser }) => {
  const user = await signIn(context, baseUrlOf(page), undefined);
  expect((await page.goto("/admin/ai-features/p01_find_episodes/fields"))?.status()).toBe(404);
  const answer = await stub("/rest/v1/rpc/save_ai_feature_registry_fields", user.token, {
    target_feature: "p01_find_episodes",
    loaded_at: null,
    new_name: "x",
    new_where_used: "",
    new_requirement: "",
    new_output_format: "",
    new_design_rationale: "",
    new_room_to_improve: "",
    new_notes: "",
  });
  expect(answer.status).toBe(403);
  const visitor = await (await browser.newContext()).newPage();
  expect(
    (await visitor.goto(`${baseUrlOf(page)}/admin/ai-features/p01_find_episodes/fields`))?.status(),
  ).toBe(404);
  await visitor.context().close();
});
