import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #436 (part of #430): the local Supabase stand-in supports the AI feature tables of
// 20261130000000_ai_features.sql, as the admin pages call them. These first tests call the stub's
// REST endpoints directly with each role's token; the #439 pages are tested at the end of the
// file. The features are shared by every test, so this file runs in order and resets them.

test.describe.configure({ mode: "serial" });

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

type Feature = {
  slug: string;
  title: string;
  status: string;
  prompt_keys: string[];
  purpose: { text: string; source: string | null; draft: boolean }[];
};

test.beforeEach(async () => {
  await stub("/__ai_features", null, { reset: true });
});

test("#436 AC4: an editor reads the 7 seeded features, every status exploring", async ({
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const answer = await stub("/rest/v1/ai_features?order=position.asc", writer.token);
  expect(answer.status).toBe(200);
  const features = (await answer.json()) as Feature[];
  expect(features.map((row) => row.title)).toEqual([
    "Goal split (plan_split)",
    "Step cards (step_cards)",
    "Pause message (stuck_story + pause_predicament)",
    "Rest reply (rest_reply)",
    "Return pop-up (return_popup)",
    "Closing line (closing_line)",
    "Safety classifier (safety_classifier)",
  ]);
  expect(new Set(features.map((row) => row.status))).toEqual(new Set(["exploring"]));
  expect(features[2].prompt_keys).toEqual(["stuck_story", "pause_predicament"]);
  expect(features[0].purpose[0]).toMatchObject({
    source: "docs/ai/AI_01_goal-split.md:13",
    draft: true,
  });
});

test("#436 AC4: an account without a role reads no rows, and no session is refused", async ({
  context,
  baseURL,
}) => {
  const plain = await signIn(context, baseURL!);
  for (const table of ["ai_features", "ai_feature_status_history", "ai_feature_test_runs"]) {
    const answer = await stub(`/rest/v1/${table}`, plain.token);
    expect(answer.status, table).toBe(200);
    expect(await answer.json(), table).toEqual([]);
    expect((await stub(`/rest/v1/${table}`, null)).status, table).toBe(401);
  }
});

test("#436 AC1: a writer cannot change a status; the status and its history stay", async ({
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const refused = await stub("/rest/v1/rpc/set_ai_feature_status", writer.token, {
    target_feature: "plan_split",
    new_status: "passed",
    change_note: null,
  });
  expect(refused.status).toBe(403);
  const [feature] = (await (
    await stub("/rest/v1/ai_features?slug=eq.plan_split", writer.token)
  ).json()) as Feature[];
  expect(feature.status).toBe("exploring");
  const history = await stub("/rest/v1/ai_feature_status_history", writer.token);
  expect(await history.json()).toEqual([]);
});

test("#436 AC1: an admin changes a status, with a history row of who, from, to and the note", async ({
  context,
  baseURL,
}) => {
  const admin = await signIn(context, baseURL!, () => ({}), { contentRole: "admin" });
  const changed = await stub("/rest/v1/rpc/set_ai_feature_status", admin.token, {
    target_feature: "rest_reply",
    new_status: "passed",
    change_note: "Read 10 replies",
  });
  expect(changed.status).toBe(204);
  const history = (await (
    await stub("/rest/v1/ai_feature_status_history?feature_slug=eq.rest_reply", admin.token)
  ).json()) as Record<string, unknown>[];
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    from_status: "exploring",
    to_status: "passed",
    note: "Read 10 replies",
    changed_by: admin.userId,
  });
  // The same status again, or one that does not exist, is refused.
  for (const new_status of ["passed", "done"]) {
    const again = await stub("/rest/v1/rpc/set_ai_feature_status", admin.token, {
      target_feature: "rest_reply",
      new_status,
    });
    expect(again.status, new_status).toBe(400);
  }
});

test("#436 AC1: a writer saves the sections, and an empty section stays empty (Not written yet)", async ({
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const purpose = [{ text: "Owner text.", source: null, draft: false }];
  const saved = await stub("/rest/v1/rpc/save_ai_feature_sections", writer.token, {
    target_feature: "closing_line",
    new_purpose: purpose,
    new_pass_questions: [],
    new_approach: [],
  });
  expect(saved.status).toBe(204);
  const [feature] = (await (
    await stub("/rest/v1/ai_features?slug=eq.closing_line", writer.token)
  ).json()) as (Feature & { pass_questions: unknown[]; approach: unknown[] })[];
  expect(feature.purpose).toEqual(purpose);
  expect(feature.pass_questions).toEqual([]);
  expect(feature.status).toBe("exploring");

  const bad = await stub("/rest/v1/rpc/save_ai_feature_sections", writer.token, {
    target_feature: "closing_line",
    new_purpose: [{ text: "" }],
    new_pass_questions: [],
    new_approach: [],
  });
  expect(bad.status).toBe(400);
});

test("#436 AC3: imported test runs are read back, a fake-model run marked as such", async ({
  context,
  baseURL,
}) => {
  await stub("/__ai_features", null, {
    testRuns: [
      {
        feature_slug: "plan_split",
        prompt_key: "plan_split",
        kind: "fake_model",
        run_at: "2026-11-25T20:15:34.722Z",
        prompt_version: 2,
        pass_count: 6,
        fail_count: 0,
        target_count: 6,
        summary: "Fake model (stub): says nothing about a real model.",
        report_path: "offline-runs/2026-11-25-stub/report.md",
      },
    ],
  });
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  const runs = (await (
    await stub("/rest/v1/ai_feature_test_runs?feature_slug=eq.plan_split", writer.token)
  ).json()) as Record<string, unknown>[];
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ kind: "fake_model", prompt_version: 2, pass_count: 6 });
  const none = await stub("/rest/v1/ai_feature_test_runs?kind=eq.real", writer.token);
  expect(await none.json()).toEqual([]);
});

// #439 (part of #430): the AI features index and one read-only page per feature. They run in this
// file so they share its order with the #436 tests above (both reset the features). The features
// are the seed of scripts/ai-features/seed.mjs; the test runs are one fake-model run imported with
// scripts/ai-features/import-runs.mjs from e2e/fixtures/offline-run-stub.
test.describe("#439 AI feature pages", () => {
  // The admin is a desktop tool (#313).
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  const TITLES = [
    "Goal split (plan_split)",
    "Step cards (step_cards)",
    "Pause message (stuck_story + pause_predicament)",
    "Rest reply (rest_reply)",
    "Return pop-up (return_popup)",
    "Closing line (closing_line)",
    "Safety classifier (safety_classifier)",
  ];

  async function importFakeRun() {
    // The import script is an ES module that the test runner cannot load, so a separate node
    // process turns the run folder into the rows its SQL would insert.
    const script = pathToFileURL(
      path.join(__dirname, "..", "scripts", "ai-features", "import-runs.mjs"),
    ).href;
    const folder = path.join(__dirname, "fixtures", "offline-run-stub");
    const code =
      `const { readRunFolder, testRunRows } = await import(${JSON.stringify(script)});` +
      `console.log(JSON.stringify(testRunRows(readRunFolder(${JSON.stringify(folder)}),` +
      ` { reportPath: "e2e/fixtures/offline-run-stub/report.md" })));`;
    const rows = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" }),
    ) as unknown[];
    expect(rows).toHaveLength(2);
    const answer = await stub("/__ai_features", null, { testRuns: rows });
    expect(answer.status).toBe(200);
  }

  async function activePrompt(token: string, key: string): Promise<string> {
    const answer = await stub("/rest/v1/rpc/list_prompt_versions", token, {});
    const rows = (await answer.json()) as { key: string; active: boolean; body: string }[];
    const row = rows.find((item) => item.key === key && item.active);
    if (!row) throw new Error(`no active ${key}`);
    return row.body;
  }

  const section = (page: Page, name: string | RegExp) => page.getByRole("region", { name });

  test("test_439_ac1_the_menu_opens_the_index_of_the_7_features_with_status_pills", async ({
    page,
    context,
  }) => {
    await importFakeRun();
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    await page.goto("/admin");
    const menu = page.getByRole("navigation", { name: "Admin pages" });
    await menu.getByRole("link", { name: /AI features/ }).click();
    await expect(page).toHaveURL(/\/admin\/ai-features$/);
    await expect(page.getByRole("heading", { level: 1, name: "AI features" })).toBeVisible();
    await expect(menu.getByRole("link", { name: /AI features/ })).toContainText("ADM-16");
    await expect(menu.getByRole("link", { name: /AI features/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const table = page.getByRole("table", { name: "AI features" });
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(7);
    for (const [index, title] of TITLES.entries()) {
      const row = rows.nth(index);
      await expect(row.getByRole("link", { name: title, exact: true })).toBeVisible();
      await expect(row.locator(".admin-pill-ai-exploring")).toHaveText("Exploring");
    }
    // The imported run is the pause message's last run, marked as the fake model.
    await expect(rows.nth(2)).toContainText("2026-11-25 20:15");
    await expect(rows.nth(2)).toContainText("Fake model (stub)");
    await expect(rows.nth(3)).toContainText("No run yet");
    await expect(rows.nth(0)).toContainText(
      "Turn the goal the person typed and the minutes they gave into steps they can start.",
    );

    await rows.nth(2).getByRole("link").click();
    await expect(page).toHaveURL(/\/admin\/ai-features\/pause_message$/);
    await expect(page.getByRole("heading", { level: 1, name: TITLES[2] })).toBeVisible();
    // A detail page marks its menu row.
    await expect(menu.getByRole("link", { name: /AI features/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("test_439_ac2_sections_a_to_d_show_each_draft_with_its_source", async ({
    page,
    context,
  }) => {
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    await page.goto("/admin/ai-features/pause_message");
    const purpose = section(page, "(a) Purpose");
    const first = purpose.getByRole("listitem").first();
    await expect(first).toContainText("Pause opens the rest page");
    await expect(first).toContainText("Draft - owner to edit");
    await expect(first.locator(".admin-chip")).toHaveText("docs/PRD.md:271");
    const questions = section(page, "(b) Pass standard").getByRole("listitem");
    await expect(questions).toHaveCount(9);
    for (const item of await questions.all()) {
      await expect(item).toContainText("Draft - owner to edit");
      await expect(item).toContainText("Source:");
    }
    await expect(section(page, "(c) Current approach").getByRole("listitem")).toHaveCount(5);
    const status = section(page, /^\(d\) Status/);
    await expect(status.locator(".admin-pill-ai-exploring")).toHaveText("Exploring");
    // Read view: no editor and no status change here (#430 T6).
    await expect(page.getByRole("button")).toHaveText(["Sign out"]);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

  test("test_439_ac2_an_empty_section_reads_not_written_yet", async ({ page, context }) => {
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    const saved = await stub("/rest/v1/rpc/save_ai_feature_sections", writer.token, {
      target_feature: "closing_line",
      new_purpose: [{ text: "Owner text.", source: null, draft: false }],
      new_pass_questions: [],
      new_approach: [],
    });
    expect(saved.status).toBe(204);
    await page.goto("/admin/ai-features/closing_line");
    const purpose = section(page, "(a) Purpose");
    await expect(purpose).toContainText("Owner text.");
    // Owner text is no draft and has no source.
    await expect(purpose).not.toContainText("Draft - owner to edit");
    await expect(purpose).not.toContainText("Source:");
    await expect(section(page, "(b) Pass standard")).toContainText("Not written yet");
    await expect(section(page, "(c) Current approach")).toContainText("Not written yet");
  });

  test("test_439_ac3_prompt_text_is_read_live_published_and_draft", async ({ page, context }) => {
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    const stuck = await activePrompt(writer.token, "stuck_story");
    const predicament = await activePrompt(writer.token, "pause_predicament");
    const draftBody = `${stuck}\nA draft line for #439.`;
    await page.goto("/admin/ai-features/pause_message");
    const prompts = section(page, "(e) Prompt text");
    await expect(prompts.getByRole("region", { name: "stuck_story" })).toBeVisible();
    await expect(
      prompts
        .getByRole("region", { name: "pause_predicament" })
        .getByLabel("Published pause_predicament"),
    ).toHaveText(predicament);
    await expect(prompts.getByRole("region", { name: "stuck_story" })).toContainText("No draft.");
    // A draft saved in Prompts shows at the very next page load: saved once, reloaded once, and
    // read once, so a page that kept the prompt text from an earlier load fails here. Only this
    // test touches stuck_story; the stub puts that one key back afterwards.
    try {
      const saved = await stub("/rest/v1/rpc/save_prompt_draft", writer.token, {
        prompt_key: "stuck_story",
        prompt_body: draftBody,
        prompt_params: {},
        prompt_note: "#439 e2e draft",
      });
      expect(saved.status).toBe(200);
      const version = (await saved.json()) as number;
      await page.reload();
      const key = section(page, "(e) Prompt text").getByRole("region", { name: "stuck_story" });
      await expect(key).toBeVisible();
      expect(await key.getByLabel("Published stuck_story").textContent()).toBe(stuck);
      expect(
        await key.getByLabel(`Draft v${version} of stuck_story`, { exact: true }).textContent(),
      ).toBe(draftBody);
      expect(
        await section(page, "(e) Prompt text")
          .getByRole("region", { name: "pause_predicament" })
          .textContent(),
      ).toContain("No draft.");
    } finally {
      await stub("/__prompts", null, { reset: "stuck_story" });
    }
  });

  test("test_439_ac4_test_results_mark_the_fake_model_and_no_real_run_yet", async ({
    page,
    context,
  }) => {
    await importFakeRun();
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    await page.goto("/admin/ai-features/pause_message");
    const results = section(page, "(f) Test results");
    const rows = results.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("2026-11-25 20:15");
    await expect(rows.first().locator(".admin-pill-mark")).toHaveText("Fake model (stub)");
    await expect(rows.first()).toContainText("stuck_story v3");
    await expect(rows.first()).toContainText("pause_predicament v1");
    await expect(rows.first()).toContainText("2 of 4 targets pass, 1 fail");
    await expect(results).toContainText("No real run yet (#413)");

    await page.goto("/admin/ai-features/rest_reply");
    await expect(section(page, "(f) Test results")).toContainText("No run yet");
    await expect(section(page, "(f) Test results")).toContainText("No real run yet (#413)");
  });

  test("test_439_ac5_every_page_shows_the_retry_hints_fix", async ({ page, context }) => {
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    const hints = await activePrompt(writer.token, "retry_hints");
    for (const slug of [
      "plan_split",
      "step_cards",
      "pause_message",
      "rest_reply",
      "return_popup",
      "closing_line",
      "safety_classifier",
    ]) {
      await page.goto(`/admin/ai-features/${slug}`);
      const fix = section(page, /^Fix added after a rejected answer/);
      await expect(fix, slug).toContainText("retry_hints");
      await expect(fix.getByLabel("Published retry_hints"), slug).toHaveText(hints);
    }
  });

  test("test_439_who_can_see_admins_and_writers_only", async ({ page, context, browser }) => {
    await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    expect((await page.goto("/admin/ai-features"))?.status()).toBe(200);
    expect((await page.goto("/admin/ai-features/plan_split"))?.status()).toBe(200);
    // An unknown feature is the normal not-found page (a soft 404: the admin layout streams first,
    // as test_293_an_unknown_story_shows_page_not_found).
    await page.goto("/admin/ai-features/no_such_feature");
    await expect(
      page.getByRole("heading", { name: "This page could not be found." }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "(a) Purpose" })).toHaveCount(0);

    const plain = await browser.newContext({ baseURL: baseUrlOf(page) });
    const other = await plain.newPage();
    await signIn(plain, baseUrlOf(page));
    for (const target of ["/admin/ai-features", "/admin/ai-features/plan_split"]) {
      expect((await other.goto(target))?.status(), target).toBe(404);
    }
    await plain.close();
  });
});
