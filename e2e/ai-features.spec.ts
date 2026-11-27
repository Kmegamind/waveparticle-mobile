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
    // #474: the index is now the registry table. The shared stub holds the 7 Runtime rows of the
    // registry migration (R-01 to R-07, no registry field filled yet).
    const table = page.getByRole("table", { name: "AI features" });
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(7);
    for (const [index, title] of TITLES.entries()) {
      const row = rows.nth(index);
      await expect(row.locator("td").first()).toHaveText(`R-0${index + 1}`);
      await expect(
        row.getByRole("link", { name: title.replace(/ \(.*\)$/, ""), exact: true }),
      ).toBeVisible();
      await expect(row.locator(".admin-pill-ai-exploring")).toHaveText("Exploring");
    }
    await expect(rows.nth(0).locator("td").nth(3)).toHaveText("Not written yet");

    await rows.nth(2).getByRole("link", { name: "Pause message", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/ai-features\/pause_message$/);
    await expect(page.getByRole("heading", { level: 1, name: "R-03 Pause message" })).toBeVisible();
    // The imported run is the pause message's last run, marked as the fake model.
    await expect(section(page, "Test results")).toContainText("2026-11-25 20:15");
    await expect(section(page, "Test results")).toContainText("Fake model (stub)");
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
    const purpose = section(page, "Purpose");
    const first = purpose.getByRole("listitem").first();
    await expect(first).toContainText("Pause opens the rest page");
    await expect(first).toContainText("Draft - owner to edit");
    await expect(first.locator(".admin-chip")).toHaveText("docs/PRD.md:271");
    const questions = section(page, "Pass standard").getByRole("listitem");
    await expect(questions).toHaveCount(9);
    for (const item of await questions.all()) {
      await expect(item).toContainText("Draft - owner to edit");
      await expect(item).toContainText("Source:");
    }
    await expect(section(page, "Current approach").getByRole("listitem")).toHaveCount(5);
    const status = section(page, /^Status/);
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
    const purpose = section(page, "Purpose");
    await expect(purpose).toContainText("Owner text.");
    // Owner text is no draft and has no source.
    await expect(purpose).not.toContainText("Draft - owner to edit");
    await expect(purpose).not.toContainText("Source:");
    await expect(section(page, "Pass standard")).toContainText("Not written yet");
    await expect(section(page, "Current approach")).toContainText("Not written yet");
  });

  test("test_439_ac3_prompt_text_is_read_live_published_and_draft", async ({ page, context }) => {
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    const stuck = await activePrompt(writer.token, "stuck_story");
    const predicament = await activePrompt(writer.token, "pause_predicament");
    const draftBody = `${stuck}\nA draft line for #439.`;
    await page.goto("/admin/ai-features/pause_message");
    const prompts = section(page, "Prompt");
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
      const key = section(page, "Prompt").getByRole("region", { name: "stuck_story" });
      await expect(key).toBeVisible();
      expect(await key.getByLabel("Published stuck_story").textContent()).toBe(stuck);
      expect(
        await key.getByLabel(`Draft v${version} of stuck_story`, { exact: true }).textContent(),
      ).toBe(draftBody);
      expect(
        await section(page, "Prompt")
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
    const results = section(page, "Test results");
    const rows = results.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("2026-11-25 20:15");
    await expect(rows.first().locator(".admin-pill-mark")).toHaveText("Fake model (stub)");
    await expect(rows.first()).toContainText("stuck_story v3");
    await expect(rows.first()).toContainText("pause_predicament v1");
    await expect(rows.first()).toContainText("2 of 4 targets pass, 1 fail");
    await expect(results).toContainText("No real run yet (#413)");

    await page.goto("/admin/ai-features/rest_reply");
    await expect(section(page, "Test results")).toContainText("No run yet");
    await expect(section(page, "Test results")).toContainText("No real run yet (#413)");
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

  test("test_439_a_long_unbroken_token_stays_inside_its_panel_at_1024_px", async ({
    page,
    context,
    browser,
  }) => {
    // #439 review round 3: real prompt and table text holds long tokens with no space. None may
    // run out of its panel, where the page would clip it; a self-sized table scrolls instead.
    await page.setViewportSize({ width: 1024, height: 800 });
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    const token = "x".repeat(200);
    // The purpose holding the token is shown to this account only. Saved into the shared features,
    // it would widen the index table that the visual gate (another project, run in parallel)
    // compares with the drawing (#439 review round 4).
    const purpose = await stub("/__ai_features", null, {
      token: writer.token,
      purpose: { pause_message: [{ text: token, source: null, draft: false }] },
    });
    expect(purpose.status).toBe(200);
    const elsewhere = await browser.newContext();
    try {
      const other = await signIn(elsewhere, baseUrlOf(page), undefined, { contentRole: "admin" });
      const [shared] = (await (
        await stub("/rest/v1/ai_features?slug=eq.pause_message", other.token)
      ).json()) as Feature[];
      expect(shared.purpose.map((item) => item.text)).not.toContain(token);
    } finally {
      await elsewhere.close();
    }
    const stuck = await activePrompt(writer.token, "stuck_story");

    const overflow = () =>
      page.evaluate(() => {
        const scrolls = (element: Element) => {
          const value = getComputedStyle(element).overflowX;
          return value === "auto" || value === "scroll";
        };
        const outside: string[] = [];
        for (const element of document.querySelectorAll(".admin-main *")) {
          const panel = element.closest(".admin-panel");
          if (!panel || panel === element) continue;
          // Inside a scrolling box (the index table's panel), text is reached by scrolling.
          let box = element.parentElement;
          let scrolling = false;
          while (box && box !== panel.parentElement) {
            if (scrolls(box)) scrolling = true;
            box = box.parentElement;
          }
          if (scrolling) continue;
          const right = element.getBoundingClientRect().right;
          const edge = panel.getBoundingClientRect().right;
          if (right > edge + 0.5) {
            outside.push(
              `${element.tagName.toLowerCase()}.${element.className}: ${right} > ${edge}`,
            );
          }
        }
        const main = document.querySelector(".admin-main")!.getBoundingClientRect().right;
        const panels = [...document.querySelectorAll(".admin-main .admin-panel")]
          .filter((panel) => panel.getBoundingClientRect().right > main + 0.5)
          .map((panel) => panel.className);
        const root = document.documentElement;
        return { outside, panels, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
      });

    try {
      const draft = await stub("/rest/v1/rpc/save_prompt_draft", writer.token, {
        prompt_key: "stuck_story",
        prompt_body: `${stuck}\n${token}`,
        prompt_params: {},
        prompt_note: "#439 long token",
      });
      expect(draft.status).toBe(200);

      await page.goto("/admin/ai-features/pause_message");
      const prompt = section(page, "Prompt").getByRole("region", {
        name: "stuck_story",
      });
      await expect(prompt.getByLabel(/^Draft v\d+ of stuck_story$/)).toContainText(token);
      await expect(section(page, "Purpose")).toContainText(token);
      const featurePage = await overflow();
      expect(featurePage.outside).toEqual([]);
      expect(featurePage.panels).toEqual([]);
      expect(featurePage.scrollWidth).toBe(featurePage.clientWidth);

      // #474: the index is the registry, which shows the requirement, not the purpose. The token
      // goes into this account's own copy of the features (POST /__ai_features { token, own }),
      // never into the shared rows the visual gate reads. The table keeps whole words and scrolls
      // inside its panel.
      expect((await stub("/__ai_features", null, { token: writer.token, own: true })).status).toBe(
        200,
      );
      const saved = await stub("/rest/v1/rpc/save_ai_feature_fields", writer.token, {
        target_feature: "pause_message",
        new_where_used: "",
        new_requirement: token,
        new_output_format: "",
        new_design_rationale: "",
        new_room_to_improve: "",
        new_notes: "",
      });
      expect(saved.status).toBe(204);

      /**
       * #474 review I1: the token wraps inside its own box. The box's content is no wider than
       * the box (nothing hidden or spilling), the text's own box stays within it, and the box is
       * far narrower than the unbroken token would be, so the token really wraps.
       */
      const wrapsInside = (box: import("@playwright/test").Locator) =>
        box.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          const outer = element.getBoundingClientRect();
          return {
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            textLeft: text.left,
            textRight: text.right,
            left: outer.left,
            right: outer.right,
            width: outer.width,
          };
        });
      const expectWrapped = (found: Awaited<ReturnType<typeof wrapsInside>>) => {
        expect(found.scrollWidth).toBeLessThanOrEqual(found.clientWidth);
        expect(found.textLeft).toBeGreaterThanOrEqual(found.left - 0.5);
        expect(found.textRight).toBeLessThanOrEqual(found.right + 0.5);
        // 200 "x" at 14 px are about 1440 px wide unbroken (the mutation measured 1440).
        expect(found.width).toBeLessThan(1000);
      };

      // The detail page: the requirement sits in a normal panel, no scrolling box around it.
      await page.goto("/admin/ai-features/pause_message");
      const requirement = page.locator("#requirement > .admin-field-text");
      await expect(requirement).toHaveText(token);
      expectWrapped(await wrapsInside(requirement));
      const detail = await overflow();
      expect(detail.outside).toEqual([]);
      expect(detail.panels).toEqual([]);
      expect(detail.scrollWidth).toBe(detail.clientWidth);

      // The registry: the wide table scrolls in its panel by design (its 1480 px minimum), so the
      // helper above skips its cells; the Requirement cell itself must wrap the token.
      await page.goto("/admin/ai-features");
      const table = page.getByRole("table", { name: "AI features" });
      const cell = table.locator("tbody tr", { hasText: "R-03" }).locator("td.admin-reg-wide");
      await expect(cell).toHaveText(token);
      expectWrapped(await wrapsInside(cell));
      const index = await overflow();
      expect(index.outside).toEqual([]);
      expect(index.panels).toEqual([]);
      // The page itself never scrolls sideways.
      expect(index.scrollWidth).toBe(index.clientWidth);
    } finally {
      await stub("/__prompts", null, { reset: "stuck_story" });
      await stub("/__ai_features", null, { token: writer.token, purpose: null });
      await stub("/__ai_features", null, { token: writer.token, own: null });
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
    await expect(page.getByRole("region", { name: "Purpose" })).toHaveCount(0);

    const plain = await browser.newContext({ baseURL: baseUrlOf(page) });
    const other = await plain.newPage();
    await signIn(plain, baseUrlOf(page));
    for (const target of ["/admin/ai-features", "/admin/ai-features/plan_split"]) {
      expect((await other.goto(target))?.status(), target).toBe(404);
    }
    await plain.close();
  });
});

// #453 (part of #430 T6; AI-PAGE-EDIT): writers and admins edit (a) to (c); only an admin changes
// the status, and every change is kept with who, when, from, to and the note. Each test's account
// gets its own copy of the features and their history (POST /__ai_features { token, own }), so its
// saves and status changes never touch a row another test or the visual gate reads; it gives the
// copy up afterwards. Nothing here retries: a save is checked once, after it.
test.describe("#453 editing an AI feature", () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  const section = (page: Page, name: string | RegExp) => page.getByRole("region", { name });
  const own = async (token: string) =>
    expect((await stub("/__ai_features", null, { token, own: true })).status).toBe(200);
  const disown = (token: string) => stub("/__ai_features", null, { token, own: null });
  const save = (page: Page) =>
    page.locator(".admin-head").getByRole("button", { name: "Save", exact: true }).click();

  test("test_453_ac1_a_writer_edits_purpose_and_approach_and_the_page_shows_it_at_once", async ({
    page,
    context,
  }) => {
    const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    await own(account.token);
    try {
      await page.goto("/admin/ai-features/return_popup");
      await page.getByRole("link", { name: "Edit purpose and approach" }).click();
      await expect(page).toHaveURL(/\/admin\/ai-features\/return_popup\/purpose$/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Return pop-up (return_popup) · purpose and approach",
        }),
      ).toBeVisible();
      const purposeGroup = page.getByRole("group", { name: /^\(a\) Purpose/ });
      // Each line shows its draft mark and source before the save.
      await expect(purposeGroup).toContainText("Draft - owner to edit");
      const purpose = page.getByRole("textbox", { name: "Purpose, line 1" });
      await expect(purpose).toBeEnabled();
      await purpose.fill("Owner purpose for #453.");
      // An emptied line is removed; an added line has no source.
      await page.getByRole("textbox", { name: "Approach, line 3" }).fill("");
      await page.getByRole("button", { name: "Add an approach line" }).click();
      await page.getByRole("textbox", { name: "Approach, line 4" }).fill("Owner approach line.");
      await save(page);
      await expect(page.getByRole("status")).toHaveText("Saved.");
      // The editor shows the save at once: no draft mark, the source kept.
      await expect(purposeGroup).not.toContainText("Draft - owner to edit");
      await expect(purposeGroup.locator(".admin-chip")).toHaveText("docs/PRD.md:258");
      await expect(page.getByRole("region", { name: "Last save" })).toContainText(
        "@example.invalid",
      );

      await page.goto("/admin/ai-features/return_popup");
      const a = section(page, "Purpose").getByRole("listitem");
      await expect(a).toHaveCount(1);
      await expect(a.first()).toContainText("Owner purpose for #453.");
      await expect(a.first()).not.toContainText("Draft - owner to edit");
      await expect(a.first().locator(".admin-chip")).toHaveText("docs/PRD.md:258");
      const c = section(page, "Current approach").getByRole("listitem");
      await expect(c).toHaveCount(3);
      await expect(c.first().locator(".admin-chip")).toHaveText("docs/DECISIONS.md:69");
      await expect(section(page, "Current approach")).not.toContainText("Draft - owner to edit");
      await expect(c.last()).toHaveText("Owner approach line.");
      // (b) was not on this editor: still drafts.
      await expect(section(page, "Pass standard")).toContainText("Draft - owner to edit");
    } finally {
      await disown(account.token);
    }
  });

  test("test_453_ac1_an_admin_reorders_removes_and_adds_pass_questions", async ({
    page,
    context,
  }) => {
    const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    await own(account.token);
    try {
      await page.goto("/admin/ai-features/closing_line");
      const texts = await section(page, "Pass standard")
        .locator(".admin-question-text")
        .allInnerTexts();
      expect(texts).toHaveLength(4);
      await page.getByRole("link", { name: "Edit pass standard" }).click();
      await expect(page).toHaveURL(/\/admin\/ai-features\/closing_line\/pass$/);
      await expect(page.getByRole("textbox", { name: /^Question \d$/ })).toHaveCount(4);
      await page.getByRole("button", { name: "Move question 2 up" }).click();
      await page.getByRole("button", { name: "Remove question 4" }).click();
      await page.getByRole("button", { name: "Add question" }).click();
      await page.getByRole("textbox", { name: "Question 4" }).fill("A new question for #453?");
      await save(page);
      await expect(page.getByRole("status")).toHaveText("Saved.");

      await page.goto("/admin/ai-features/closing_line");
      const pass = section(page, "Pass standard");
      await expect(pass.locator(".admin-question-text")).toHaveText([
        texts[1],
        texts[0],
        texts[2],
        "A new question for #453?",
      ]);
      await expect(pass).not.toContainText("Draft - owner to edit");
      // Sources stay with their questions; the new one has none.
      await expect(pass.getByRole("listitem").nth(1).locator(".admin-chip")).toHaveText(
        "docs/PRD.md:294",
      );
      await expect(pass.getByRole("listitem").nth(3).locator(".admin-chip")).toHaveCount(0);
      // (a) and (c) were not on this editor: still drafts.
      await expect(section(page, "Purpose")).toContainText("Draft - owner to edit");
    } finally {
      await disown(account.token);
    }
  });

  test("test_453_ac1_a_save_over_a_newer_save_is_refused_and_nothing_is_lost", async ({
    page,
    context,
  }) => {
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    await own(writer.token);
    try {
      await page.goto("/admin/ai-features/plan_split/purpose");
      await page.getByRole("textbox", { name: "Purpose, line 1" }).fill("My edit.");
      // Someone else saves the same feature after this page loaded.
      const other = await stub("/rest/v1/rpc/save_ai_feature_sections", writer.token, {
        target_feature: "plan_split",
        new_purpose: [{ text: "The other save.", source: null, draft: false }],
        new_pass_questions: [],
        new_approach: [],
      });
      expect(other.status).toBe(204);
      await save(page);
      await expect(page.getByRole("status")).toContainText("Someone saved this feature");
      // The typed text stays in the box, and the other save stays in the database.
      await expect(page.getByRole("textbox", { name: "Purpose, line 1" })).toHaveValue("My edit.");
      const [feature] = (await (
        await stub("/rest/v1/ai_features?slug=eq.plan_split", writer.token)
      ).json()) as Feature[];
      expect(feature.purpose).toEqual([{ text: "The other save.", source: null, draft: false }]);
    } finally {
      await disown(writer.token);
    }
  });

  test("test_453_ac2_ac3_an_admin_changes_the_status_and_the_history_shows_who_when_from_to_and_note", async ({
    page,
    context,
  }) => {
    const admin = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
    await own(admin.token);
    try {
      await page.goto("/admin/ai-features/safety_classifier");
      await section(page, /^Status/)
        .getByRole("link", { name: "history and change (admin only)" })
        .click();
      await expect(page).toHaveURL(/\/admin\/ai-features\/safety_classifier\/status$/);
      const history = page.getByRole("table", { name: "Status history" });
      await expect(history.locator("tbody tr")).toHaveCount(1);
      await expect(history.locator("tbody tr").first()).toContainText("Setup");
      const group = page.getByRole("group", { name: "Status" });
      await expect(group.getByRole("button", { name: "Exploring" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await group.getByRole("button", { name: "Passed" }).click();
      await page.getByRole("textbox", { name: "Reason (one line)" }).fill("Crisis set passes");
      await page.getByRole("button", { name: "Save status" }).click();
      await expect(page.getByRole("status")).toHaveText("Status saved.");

      const rows = history.locator("tbody tr");
      await expect(rows).toHaveCount(2);
      const newest = rows.first();
      await expect(newest).toContainText(`${admin.userId}@example.invalid`);
      await expect(newest.locator(".admin-pill-ai-exploring")).toHaveText("Exploring");
      await expect(newest.locator(".admin-pill-ai-passed")).toHaveText("Passed");
      await expect(newest).toContainText("Crisis set passes");
      await expect(newest.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d\d-\d\dT/);
      await expect(page.getByRole("heading", { name: /^Now/ }).locator(".admin-pill")).toHaveText(
        "Passed",
      );

      await page.goto("/admin/ai-features/safety_classifier");
      const status = section(page, /^Status/);
      await expect(status.locator(".admin-pill-ai-passed")).toHaveText("Passed");
      await expect(status).toContainText(`Set to Passed by ${admin.userId}@example.invalid`);
    } finally {
      await disown(admin.token);
    }
  });

  test("test_453_ac2_ac4_a_writer_sees_the_status_read_only_and_a_direct_request_fails", async ({
    page,
    context,
  }) => {
    const writer = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
    await own(writer.token);
    try {
      await page.goto("/admin/ai-features/step_cards/status");
      await expect(page.locator(".admin-head .admin-lede")).toHaveText(
        "You can see the status and its history. Only an admin can change it.",
      );
      const panel = page.getByRole("region", { name: /^Change status/ });
      await expect(panel).toContainText("Admin only");
      for (const name of ["Not started", "Exploring", "Passed", "Frozen", "Save status"]) {
        await expect(panel.getByRole("button", { name, exact: true }), name).toBeDisabled();
      }
      await expect(panel.getByRole("textbox", { name: "Reason (one line)" })).toBeDisabled();

      // The writer's own request, straight to the database function, is refused too.
      const refused = await stub("/rest/v1/rpc/set_ai_feature_status", writer.token, {
        target_feature: "step_cards",
        new_status: "passed",
        change_note: "By hand",
      });
      expect(refused.status).toBe(403);
      expect(((await refused.json()) as { code: string }).code).toBe("42501");
      await page.reload();
      await expect(page.getByRole("heading", { name: /^Now/ }).locator(".admin-pill")).toHaveText(
        "Exploring",
      );
      await expect(
        page.getByRole("table", { name: "Status history" }).locator("tbody tr"),
      ).toHaveCount(1);
    } finally {
      await disown(writer.token);
    }
  });
});
