import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #473: the local Supabase stand-in serves the registry columns and functions of
// 20261202000000_ai_registry.sql. Each test gives its account its own copy of the features
// (POST /__ai_features { token, own: true }), so nothing here changes a row another test or the
// visual gate reads. The prompt test adds one invented pipeline key and removes it again.

/** The server's prompt reader token in the e2e run (playwright.config.ts). */
const PROMPTS_READ_TOKEN = "e2e-prompts-reader";

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

async function own(token: string) {
  expect((await stub("/__ai_features", null, { token, own: true })).status).toBe(200);
}

type Feature = {
  slug: string;
  feature_id: string;
  category: string;
  status: string;
  requirement: string;
  notes: string;
  example_text: string;
  example_state: string;
};

const fields = (requirement: string) => ({
  target_feature: "rest_reply",
  new_where_used: "Invented place",
  new_requirement: requirement,
  new_output_format: "Invented format",
  new_design_rationale: "",
  new_room_to_improve: "",
  new_notes: "Invented note",
});

test("test_473_runtime_rows_carry_feature_id_category_and_empty_fields", async ({
  page,
  context,
}) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  const rows = (await (
    await stub("/rest/v1/ai_features?order=position.asc", writer.token)
  ).json()) as Feature[];
  expect(rows.map((row) => row.feature_id)).toEqual([
    "R-01",
    "R-02",
    "R-03",
    "R-04",
    "R-05",
    "R-06",
    "R-07",
  ]);
  expect(new Set(rows.map((row) => row.category))).toEqual(new Set(["runtime"]));
  expect(new Set(rows.map((row) => row.requirement))).toEqual(new Set([""]));
  expect(new Set(rows.map((row) => row.example_state))).toEqual(new Set(["none"]));
});

test("test_473_a_writer_edits_fields_and_the_example_with_history", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  expect(
    (await stub("/rest/v1/rpc/save_ai_feature_fields", writer.token, fields("Invented need")))
      .status,
  ).toBe(204);
  expect(
    (
      await stub("/rest/v1/rpc/set_ai_feature_example", writer.token, {
        target_feature: "rest_reply",
        new_text: "Invented example",
        new_state: "confirmed",
      })
    ).status,
  ).toBe(204);
  const [row] = (await (
    await stub("/rest/v1/ai_features?slug=eq.rest_reply", writer.token)
  ).json()) as Feature[];
  expect(row).toMatchObject({
    requirement: "Invented need",
    notes: "Invented note",
    example_text: "Invented example",
    example_state: "confirmed",
    status: "exploring",
    category: "runtime",
  });
  const history = (await (
    await stub("/rest/v1/ai_feature_field_history?feature_slug=eq.rest_reply", writer.token)
  ).json()) as { field: string; old_value: unknown; new_value: unknown; changed_by: string }[];
  // Only the fields that changed: the two left empty have no row.
  expect(history.map((item) => item.field).sort()).toEqual([
    "notes",
    "output_format",
    "requirement",
    "where_used",
  ]);
  expect(history.find((item) => item.field === "requirement")).toMatchObject({
    old_value: "",
    new_value: "Invented need",
    changed_by: writer.userId,
  });
  const examples = (await (
    await stub("/rest/v1/ai_feature_example_history?feature_slug=eq.rest_reply", writer.token)
  ).json()) as { example_state: string; set_by: string }[];
  expect(examples).toEqual([
    expect.objectContaining({ example_state: "confirmed", set_by: writer.userId }),
  ]);
});

test("test_473_a_writer_cannot_change_the_status_or_the_category", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  const category = await stub("/rest/v1/rpc/set_ai_feature_category", writer.token, {
    target_feature: "plan_split",
    new_category: "gate",
  });
  expect(category.status).toBe(403);
  expect((await category.json()).code).toBe("42501");
  const status = await stub("/rest/v1/rpc/set_ai_feature_status", writer.token, {
    target_feature: "plan_split",
    new_status: "passed",
  });
  expect(status.status).toBe(403);
  const [row] = (await (
    await stub("/rest/v1/ai_features?slug=eq.plan_split", writer.token)
  ).json()) as Feature[];
  expect(row).toMatchObject({ category: "runtime", status: "exploring" });
  expect(await (await stub("/rest/v1/ai_feature_field_history", writer.token)).json()).toEqual([]);
});

test("test_473_an_admin_changes_the_category_with_a_history_row", async ({ page, context }) => {
  const admin = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  await own(admin.token);
  expect(
    (
      await stub("/rest/v1/rpc/set_ai_feature_category", admin.token, {
        target_feature: "plan_split",
        new_category: "gate",
      })
    ).status,
  ).toBe(204);
  const history = await (
    await stub("/rest/v1/ai_feature_field_history?feature_slug=eq.plan_split", admin.token)
  ).json();
  expect(history).toEqual([
    expect.objectContaining({ field: "category", old_value: "runtime", new_value: "gate" }),
  ]);
});

test("test_473_no_role_and_no_session_read_nothing_new_and_write_nothing", async ({
  page,
  context,
}) => {
  const plain = await signIn(context, baseUrlOf(page));
  for (const table of ["ai_feature_field_history", "ai_feature_example_history"]) {
    const answer = await stub(`/rest/v1/${table}`, plain.token);
    expect(answer.status, table).toBe(200);
    expect(await answer.json(), table).toEqual([]);
    expect((await stub(`/rest/v1/${table}`, null)).status, table).toBe(401);
  }
  for (const token of [plain.token, null]) {
    expect((await stub("/rest/v1/rpc/save_ai_feature_fields", token, fields("x"))).status).toBe(
      403,
    );
    expect(
      (
        await stub("/rest/v1/rpc/set_ai_feature_example", token, {
          target_feature: "rest_reply",
          new_text: "x",
          new_state: "candidate",
        })
      ).status,
    ).toBe(403);
  }
});

test("test_473_get_active_prompts_returns_runtime_keys_only", async ({ page, context }) => {
  const key = "p99_invented_pipeline";
  try {
    expect(
      (
        await stub("/__prompts", null, {
          importRows: [{ key, body: "Invented pipeline prompt.", category: "pipeline" }],
        })
      ).status,
    ).toBe(200);
    const active = (await (
      await stub("/rest/v1/rpc/get_active_prompts", null, { reader_token: PROMPTS_READ_TOKEN })
    ).json()) as { key: string }[];
    expect(active.map((row) => row.key)).toContain("plan_split");
    expect(active.map((row) => row.key)).not.toContain(key);

    // The admin reads every key, with its category; a draft keeps the key's category.
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    expect(
      (
        await stub("/rest/v1/rpc/save_prompt_draft", writer.token, {
          prompt_key: key,
          prompt_body: "Invented draft.",
          prompt_params: {},
          prompt_note: "",
        })
      ).status,
    ).toBeLessThan(300);
    const versions = (await (
      await stub("/rest/v1/rpc/list_prompt_versions", writer.token, {})
    ).json()) as { key: string; version: number; category: string }[];
    expect(versions.filter((row) => row.key === key)).toEqual([
      expect.objectContaining({ version: 2, category: "pipeline" }),
      expect.objectContaining({ version: 1, category: "pipeline" }),
    ]);
    expect(versions.find((row) => row.key === "plan_split")?.category).toBe("runtime");
  } finally {
    await stub("/__prompts", null, { reset: key });
  }
});

test("test_473_a_candidate_or_confirmed_example_needs_text", async ({ page, context }) => {
  const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await own(writer.token);
  const refused = await stub("/rest/v1/rpc/set_ai_feature_example", writer.token, {
    target_feature: "rest_reply",
    new_text: "  ",
    new_state: "confirmed",
  });
  expect(refused.status).toBe(400);
  expect((await refused.json()).code).toBe("22023");
  const [row] = (await (
    await stub("/rest/v1/ai_features?slug=eq.rest_reply", writer.token)
  ).json()) as Feature[];
  expect(row).toMatchObject({ example_text: "", example_state: "none" });
});

// #474 (registry slice 2): /admin/ai-features is the registry table and /admin/ai-features/<slug>
// the feature detail, read only (docs/PRD.md FR-AIREG-1 to FR-AIREG-4). Each test's account reads
// its own copy of the 19 rows, made from the invented fixtures of #473, and a fixed prompt list
// (POST /__ai_features { token, registry: true }), so no test here reads a row another test writes.
// Nothing retries: every check is made once, after the page has loaded.
test.describe("#474 the registry read view", () => {
  // The admin is a desktop tool (#313).
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  async function registryAccount(
    page: import("@playwright/test").Page,
    context: import("@playwright/test").BrowserContext,
    contentRole: "admin" | "writer",
  ) {
    const account = await signIn(context, baseUrlOf(page), undefined, { contentRole });
    const answer = await stub("/__ai_features", null, { token: account.token, registry: true });
    expect(answer.status).toBe(200);
    return account;
  }

  const SEED_ORDER = [
    ...["01", "02", "03", "04", "05", "06", "07"].map((n) => `P-${n}`),
    ...["01", "02", "03", "04", "05"].map((n) => `G-${n}`),
    ...["01", "02", "03", "04", "05", "06", "07"].map((n) => `R-${n}`),
  ];

  const table = (page: import("@playwright/test").Page) =>
    page.getByRole("table", { name: "AI features" });
  const idCells = (page: import("@playwright/test").Page) =>
    table(page).locator("tbody tr td:first-child");
  const section = (page: import("@playwright/test").Page, name: string | RegExp) =>
    page.getByRole("region", { name });

  test("test_474_ac1_the_registry_shows_all_19_rows_with_every_column", async ({
    page,
    context,
  }) => {
    await registryAccount(page, context, "writer");
    await page.goto("/admin/ai-features");
    await expect(page.getByRole("heading", { level: 1, name: "AI features" })).toBeVisible();
    await expect(table(page).locator("thead th")).toHaveText([
      "ID",
      "Name",
      "Category",
      "Where it appears",
      "Requirement",
      "Prompt",
      "Status",
      "Example",
    ]);
    await expect(table(page).locator("tbody tr")).toHaveCount(19);
    await expect(idCells(page)).toHaveText(SEED_ORDER);

    const p01 = table(page).locator("tbody tr").first();
    await expect(p01.locator("td").nth(1)).toHaveText("Find episodes");
    await expect(p01.locator("td").nth(2)).toHaveText("Pipeline");
    await expect(p01.locator("td").nth(3)).toHaveText("Invented place for P-01");
    await expect(p01.locator("td").nth(4)).toHaveText("Invented requirement for P-01.");
    // The prompt version is read live from public.prompts: the imported version 1, no draft.
    await expect(p01.locator("td").nth(5).locator(".admin-chip")).toHaveText(
      "p01_find_episodes v1",
    );
    await expect(p01.locator("td").nth(5).locator(".admin-pill-draft")).toHaveCount(0);
    await expect(p01.locator(".admin-pill-ai-exploring")).toHaveText("Exploring");
    await expect(p01.locator(".admin-pill-example-candidate")).toHaveText("Candidate");

    // R-03 has two prompt keys; stuck_story has a draft, shown beside the published version.
    const r03 = table(page).locator("tbody tr", { hasText: "R-03" });
    await expect(r03.locator("td").nth(5).locator(".admin-chip")).toHaveText([
      "stuck_story v1",
      "pause_predicament v1",
    ]);
    await expect(r03.locator("td").nth(5).locator(".admin-pill-draft")).toHaveText("Draft v2");
    // A book-text example is never stored: no example, state None.
    await expect(r03.locator(".admin-pill-example-none")).toHaveText("None");
    await expect(table(page).locator("tbody tr", { hasText: "P-03" })).toContainText("Passed");
    await expect(table(page).locator("tbody tr", { hasText: "P-04" })).toContainText("Frozen");
    await expect(table(page).locator("tbody tr", { hasText: "G-03" })).toContainText("Not started");

    // A writer sees the status and no Change; the header says the role.
    await expect(table(page).getByRole("link", { name: /^Change the status/ })).toHaveCount(0);
    await expect(page.locator(".admin-head")).toContainText("Viewing as writer");

    // Each row opens its detail page; "view" goes to its prompt panel.
    await expect(r03.getByRole("link", { name: "View the prompt of R-03" })).toHaveAttribute(
      "href",
      "/admin/ai-features/pause_message#prompt",
    );
    await p01.getByRole("link", { name: "Find episodes" }).click();
    await expect(page).toHaveURL(/\/admin\/ai-features\/p01_find_episodes$/);
    await expect(page.getByRole("heading", { level: 1, name: "P-01 Find episodes" })).toBeVisible();
  });

  test("test_474_ac1_filters_by_category_and_status_search_and_sort_by_id", async ({
    page,
    context,
  }) => {
    await registryAccount(page, context, "admin");
    await page.goto("/admin/ai-features");
    await expect(table(page).locator("tbody tr")).toHaveCount(19);

    await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Runtime" });
    await expect(idCells(page)).toHaveText(SEED_ORDER.filter((id) => id.startsWith("R")));
    await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Quality gate" });
    await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "Not started" });
    await expect(idCells(page)).toHaveText(["G-03", "G-04"]);

    await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "All" });
    await page.getByRole("combobox", { name: "Status" }).selectOption({ label: "All" });
    await page.getByRole("textbox", { name: "Search" }).fill("judge");
    await expect(idCells(page)).toHaveText(["G-01", "G-03"]);
    await page.getByRole("textbox", { name: "Search" }).fill("no row says this");
    await expect(table(page).locator("tbody")).toHaveText("No feature matches these filters");
    await page.getByRole("textbox", { name: "Search" }).fill("");

    const sort = page.getByRole("button", { name: /^Sort by ID/ });
    await expect(sort).toHaveText("Sort by ID ↑");
    await sort.click();
    await expect(sort).toHaveText("Sort by ID ↓");
    await expect(idCells(page)).toHaveText([...SEED_ORDER].reverse());
  });

  test("test_474_ac1_the_wide_table_scrolls_in_its_panel_with_id_and_name_in_view", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await registryAccount(page, context, "admin");
    await page.goto("/admin/ai-features");
    const scroll = page.locator(".admin-reg-scroll");
    await expect(table(page).locator("tbody tr")).toHaveCount(19);
    const before = await scroll.evaluate((box) => ({
      scrollWidth: box.scrollWidth,
      clientWidth: box.clientWidth,
    }));
    expect(before.scrollWidth).toBeGreaterThan(before.clientWidth);
    // The page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await scroll.evaluate((box) => {
      box.scrollLeft = box.scrollWidth;
    });
    const firstRow = table(page).locator("tbody tr").first();
    const box = await scroll.boundingBox();
    const id = await firstRow.locator("td").nth(0).boundingBox();
    const name = await firstRow.locator("td").nth(1).boundingBox();
    expect(Math.round(id!.x)).toBe(Math.round(box!.x));
    expect(Math.round(name!.x)).toBe(Math.round(id!.x + id!.width));
    await expect(firstRow.locator("td").nth(7).locator(".admin-pill")).toBeInViewport();
  });

  test("test_474_an_admin_sees_change_on_the_runtime_rows_only", async ({ page, context }) => {
    await registryAccount(page, context, "admin");
    await page.goto("/admin/ai-features");
    await expect(page.locator(".admin-head")).toContainText("Viewing as admin");
    const change = table(page).getByRole("link", { name: /^Change the status of / });
    await expect(change).toHaveCount(7);
    await expect(
      table(page).getByRole("link", { name: "Change the status of R-07" }),
    ).toHaveAttribute("href", "/admin/ai-features/safety_classifier#status");
    await expect(
      table(page)
        .locator("tbody tr", { hasText: "P-01" })
        .getByRole("link", { name: /^Change/ }),
    ).toHaveCount(0);
  });

  test("test_474_ac2_ac3_a_pipeline_row_shows_every_field_and_not_written_yet", async ({
    page,
    context,
  }) => {
    await registryAccount(page, context, "writer");
    await page.goto("/admin/ai-features/p02_select_stories");
    await expect(
      page.getByRole("heading", { level: 1, name: "P-02 Select stories" }),
    ).toBeVisible();
    await expect(page.locator(".admin-head .admin-lede")).toHaveText(
      "Pipeline · Where it appears: Invented place for P-02",
    );
    await expect(page.locator(".admin-section > h2")).toHaveText([
      "Requirement",
      "Prompt",
      "Output format and rules",
      "Design rationale",
      "Room to improve",
      "Confirmed example",
      "Notes",
      "Pass standard",
      /^Status/,
      "Version history",
      "Test results",
    ]);
    await expect(section(page, "Requirement")).toContainText("Invented requirement for P-02.");
    await expect(section(page, "Output format and rules")).toContainText(
      "Invented format for P-02.",
    );
    await expect(section(page, "Design rationale")).toContainText("Invented rationale for P-02.");
    await expect(section(page, "Room to improve")).toContainText("Invented idea for P-02.");
    // FR-AIREG-4: empty fields say so, never filler.
    await expect(section(page, "Notes")).toHaveText("NotesNot written yet");
    await expect(section(page, "Pass standard")).toHaveText("Pass standardNot written yet");
    await expect(section(page, "Version history")).toContainText("No changes yet");

    const example = section(page, "Confirmed example");
    await expect(example.locator(".admin-pill-example-confirmed")).toHaveCount(2);
    await expect(example).toContainText("Invented example for P-02.");
    // A seeded example was set by the setup; its history row names the account that set it.
    await expect(example).toContainText("Confirmed by Setup");
    const earlier = example.getByRole("table", { name: "Example history" });
    await expect(earlier).toContainText("2026-11-20 10:00");
    await expect(earlier).toContainText("Account 00000000");

    const prompt = section(page, "Prompt").getByRole("region", { name: "p02_select_stories" });
    await expect(prompt.locator(".admin-prompt-meta")).toContainText("p02_select_stories v1");
    await expect(prompt.locator(".admin-prompt-meta")).toContainText("category: pipeline");
    await expect(prompt.getByLabel("Published p02_select_stories")).toContainText(
      "Invented prompt S2",
    );
    await expect(prompt).toContainText("No draft.");
    // Pipeline prompts are not edited on the Prompts page.
    await expect(prompt.getByRole("link", { name: "Prompts page" })).toHaveCount(0);

    // A Pipeline row is read only until #475: no editor link, no status control.
    await expect(page.getByRole("link", { name: /^Edit / })).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    for (const target of ["purpose", "pass", "status"]) {
      await page.goto(`/admin/ai-features/p02_select_stories/${target}`);
      await expect(
        page.getByRole("heading", { name: "This page could not be found." }),
        target,
      ).toBeVisible();
    }
  });

  test("test_474_ac2_a_runtime_row_shows_purpose_requirement_retry_hints_and_the_prompt_diff", async ({
    page,
    context,
  }) => {
    await registryAccount(page, context, "writer");
    // A row also opens by its Feature ID.
    await page.goto("/admin/ai-features/R-03");
    await expect(page).toHaveURL(/\/admin\/ai-features\/pause_message$/);
    await expect(page.getByRole("heading", { level: 1, name: "R-03 Pause message" })).toBeVisible();
    await expect(page.locator(".admin-section > h2")).toHaveText([
      "Purpose",
      "Current approach",
      "Requirement",
      "Prompt",
      "Output format and rules",
      "Design rationale",
      "Room to improve",
      "Confirmed example",
      "Notes",
      "Pass standard",
      /^Status/,
      "Version history",
      /^Fix added after a rejected answer/,
      "Test results",
    ]);
    await expect(section(page, "Purpose")).toContainText("Draft - owner to edit");
    await expect(section(page, "Requirement")).toContainText("Invented requirement for R-03.");
    // The seed stores no book-text example.
    await expect(section(page, "Confirmed example")).toHaveText("Confirmed exampleNot written yet");
    await expect(
      section(page, /^Fix added after a rejected answer/).getByLabel("Published retry_hints"),
    ).not.toBeEmpty();

    const stuck = section(page, "Prompt").getByRole("region", { name: "stuck_story" });
    const published = stuck.getByLabel("Published stuck_story");
    const draft = stuck.getByLabel("Draft v2 of stuck_story");
    await expect(published).toBeVisible();
    await expect(draft).toContainText("An invented draft line for {{name}}.");
    await expect(stuck.locator(".admin-prompt-meta .admin-pill-draft")).toHaveText("Draft v2");
    // Published and draft side by side.
    const left = await published.boundingBox();
    const right = await draft.boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x + left!.width);
    expect(Math.round(right!.y)).toBe(Math.round(left!.y));
    // {{variables}} are marked.
    await expect(draft.locator(".admin-var").last()).toHaveText("{{name}}");
    // The diff: the one added line.
    const diff = stuck.getByRole("list", { name: "Changed lines of stuck_story" });
    await expect(diff.locator(".admin-reg-diff-added")).toHaveCount(1);
    await expect(diff.locator(".admin-reg-diff-added")).toContainText(
      "An invented draft line for {{name}}.",
    );
    await expect(diff.locator(".admin-reg-diff-removed")).toHaveCount(1);
    const predicament = section(page, "Prompt").getByRole("region", {
      name: "pause_predicament",
    });
    await expect(predicament).toContainText("No draft.");
    await expect(predicament.getByRole("list")).toHaveCount(0);

    const history = section(page, "Version history").getByRole("table", {
      name: "Version history",
    });
    await expect(history.locator("tbody tr")).toHaveCount(1);
    await expect(history.locator("tbody tr")).toContainText("Requirement");

    // A writer sees the status, marked admin only, with no control.
    const status = section(page, /^Status/);
    await expect(status).toContainText("Admin only");
    await expect(status).toContainText("You can see the status. Only an admin can change it.");
    await expect(status.getByRole("button")).toHaveCount(0);
    // The editors of #453 stay linked on a Runtime row.
    await expect(page.getByRole("link", { name: "Edit purpose and approach" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit pass standard" })).toBeVisible();
  });

  test("test_474_an_admin_changes_a_runtime_status_on_the_detail_page", async ({
    page,
    context,
  }) => {
    const admin = await registryAccount(page, context, "admin");
    await page.goto("/admin/ai-features");
    await table(page).getByRole("link", { name: "Change the status of R-05" }).click();
    await expect(page).toHaveURL(/\/admin\/ai-features\/return_popup#status$/);
    const status = section(page, /^Status/);
    await status.getByRole("button", { name: "Frozen" }).click();
    await status.getByRole("textbox", { name: "Reason (one line)" }).fill("Invented reason");
    await status.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByRole("status")).toHaveText("Status saved.");
    await expect(status.locator("h2 .admin-pill-ai-frozen")).toHaveText("Frozen");
    await expect(status).toContainText(`Set to Frozen by ${admin.userId}@example.invalid`);
    const history = section(page, "Version history").getByRole("table", {
      name: "Version history",
    });
    await expect(history.locator("tbody tr").first()).toContainText("Status");
    await expect(history.locator("tbody tr").first().locator(".admin-pill-ai-frozen")).toHaveText(
      "Frozen",
    );
    // The status page of #453 still has the history and the reason.
    await status.getByRole("link", { name: "history and change (admin only)" }).click();
    await expect(page.getByRole("table", { name: "Status history" })).toContainText(
      "Invented reason",
    );
  });

  test("test_474_ac4_a_read_that_fails_says_so_and_calls_no_model", async ({ page, context }) => {
    const writer = await registryAccount(page, context, "writer");
    const failed = await stub("/__fail_reads", null, {
      token: writer.token,
      tables: ["ai_features"],
    });
    expect(failed.status).toBe(200);
    await page.goto("/admin/ai-features");
    await expect(page.locator(".admin-errbox[role=alert]")).toContainText(
      "The registry could not be read.",
    );
    await expect(
      page.locator(".admin-errbox[role=alert]").getByRole("link", { name: "Retry" }),
    ).toBeVisible();
    await expect(table(page).locator("tbody")).toHaveText("Nothing to show");
  });

  test("test_474_roles_admin_and_writer_read_app_users_and_anonymous_get_nothing", async ({
    page,
    context,
    browser,
  }) => {
    await registryAccount(page, context, "writer");
    expect((await page.goto("/admin/ai-features"))?.status()).toBe(200);
    expect((await page.goto("/admin/ai-features/g05_simulated_user"))?.status()).toBe(200);

    const plain = await browser.newContext({ baseURL: baseUrlOf(page) });
    const user = await plain.newPage();
    const account = await signIn(plain, baseUrlOf(page));
    for (const target of ["/admin/ai-features", "/admin/ai-features/g05_simulated_user"]) {
      expect((await user.goto(target))?.status(), target).toBe(404);
    }
    // The tables answer no row to an account without a role.
    const rows = await stub("/rest/v1/ai_features", account.token);
    expect(await rows.json()).toEqual([]);
    await plain.close();

    const anonymous = await browser.newContext({ baseURL: baseUrlOf(page) });
    const visitor = await anonymous.newPage();
    for (const target of ["/admin/ai-features", "/admin/ai-features/g05_simulated_user"]) {
      expect((await visitor.goto(target))?.status(), target).toBe(404);
    }
    await anonymous.close();
  });
});
