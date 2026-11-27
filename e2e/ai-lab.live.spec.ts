import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";

// #478 (FR-AILAB-4, FR-AILAB-5; AI-LAB-SAMPLES, AI-REGISTRY-FIELDS, AI-LAB-STUB): the comparison
// lab (/admin/ai-lab, drawing #reg-lab) on the "mobile-live" app, whose two models are the stub
// model on this machine ("stub" and "stub-b", playwright.config.ts; e2e/support/stub-model.mjs).
// No real model is ever called. Each test's account reads its own copy of the registry rows
// (POST /__ai_features { registry: true }) and writes its own run log and comparisons
// (POST /__ai_runs { log: "own" }, e2e/support/stub-ai-runs.mjs and stub-ai-comparisons.mjs).

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

async function labAccount(page: Page, context: BrowserContext, role: "admin" | "writer") {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: role });
  expect(
    (await stub("/__ai_features", null, { token: account.token, registry: true })).status,
  ).toBe(200);
  expect((await stub("/__ai_runs", null, { token: account.token, log: "own" })).status).toBe(200);
  return account;
}

type Row = Record<string, unknown>;
const rowsOf = async (token: string, table: string) =>
  (await (await stub(`/rest/v1/${table}`, token)).json()) as Row[];

const settings = (page: Page) => page.getByRole("region", { name: "Comparison settings" });
const sides = (page: Page) => page.locator(".admin-lab-side");

/** Waits until the lab can run (hydrated), then chooses "No sample" for both sides. */
async function noSample(page: Page) {
  await expect(settings(page).getByRole("button", { name: "Run both" })).toBeEnabled();
  const select = settings(page).getByRole("combobox", { name: "Sample (the same for both sides)" });
  await select.selectOption("");
  await expect(select).toHaveValue("");
  await expect(page.locator(".admin-lab-warning")).toHaveCount(0);
}

/** The left panel's answers: yes for even questions, no for odd ones. */
const LEFT = (i: number) => i % 2 === 0;
/** The right panel's answers, different from the left: no, then yes for the rest. */
const RIGHT = (i: number) => i !== 0;

/** Answers every pass question of one side panel with `pattern`; gives the answers given. */
async function answerAll(page: Page, panel: number, pattern: (i: number) => boolean) {
  const groups = sides(page).nth(panel).getByRole("group");
  const count = await groups.count();
  for (let i = 0; i < count; i += 1) {
    await groups
      .nth(i)
      .getByRole("button", { name: pattern(i) ? "Yes" : "No", exact: true })
      .click();
  }
  return Array.from({ length: count }, (_, i) => pattern(i));
}

test("test_478_ac1_run_both_two_prompt_versions_side_by_side_with_blind", async ({
  page,
  context,
}) => {
  const writer = await labAccount(page, context, "writer");
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Admin pages" })
    .getByRole("link", {
      name: /Comparison lab/,
    })
    .click();
  await expect(page).toHaveURL(/\/admin\/ai-lab$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comparison lab");
  await expect(page.getByText("No runs yet")).toBeVisible();

  await expect(settings(page).getByRole("button", { name: "Run both" })).toBeEnabled();
  await settings(page).getByRole("combobox", { name: "Feature" }).selectOption("pause_message");
  await expect(settings(page).getByRole("combobox", { name: "Prompt" })).toHaveValue("stuck_story");
  await noSample(page);
  await expect(settings(page).getByRole("combobox", { name: "Side A" })).toHaveValue("published");
  await expect(settings(page).getByRole("combobox", { name: "Side B" })).toHaveValue("draft");
  await expect(settings(page).getByRole("checkbox", { name: /Blind/ })).toBeChecked();

  await settings(page).getByRole("button", { name: "Run both" }).click();
  await expect(sides(page)).toHaveCount(2);
  // Blind: the names are hidden, the panels say Side 1 and Side 2.
  await expect(sides(page).nth(0).locator("h2")).toHaveText(/^Side 1\s+Hidden until answered$/);
  await expect(sides(page).nth(1).locator("h2")).toHaveText(/^Side 2\s+Hidden until answered$/);
  for (const panel of [0, 1]) {
    await expect(sides(page).nth(panel).locator(".admin-pill-mark")).toHaveText(
      "Fake model (stub)",
    );
    await expect(sides(page).nth(panel).locator('pre[aria-label="Answer"]')).not.toBeEmpty();
  }
  await expect(page.locator(".admin-lab-cmp")).not.toContainText("Published version");
  await expect(page.locator(".admin-lab-cmp")).not.toContainText("Draft version");

  // Both sides are ordinary runs of the Run route, with the same sample (none), on the stub.
  const runs = await rowsOf(writer.token, "ai_runs?order=run_at.desc");
  expect(runs).toHaveLength(2);
  expect(runs.map((run) => run.prompt_version).sort()).toEqual([1, 2]);
  for (const run of runs) {
    expect(run).toMatchObject({
      feature_slug: "pause_message",
      prompt_key: "stuck_story",
      sample_id: null,
      model: "stub",
      stub: true,
      status: "ok",
    });
  }

  // Save result waits for every answer; answering both sides reveals the names.
  const save = page.getByRole("button", { name: "Save result" });
  await expect(save).toBeDisabled();
  const left = await answerAll(page, 0, LEFT);
  const count = left.length;
  expect(count).toBeGreaterThan(1);
  await expect(sides(page).nth(0).locator("h2")).toContainText("Hidden until answered");
  await expect(save).toBeDisabled();
  const right = await answerAll(page, 1, RIGHT);
  const titles = (await sides(page).locator("h2").allTextContents()).map((text) => text.trim());
  expect([...titles].sort()).toEqual([
    "Side A · Published version (v1)",
    "Side B · Draft version (v2)",
  ]);
  await expect(page.locator(".admin-lab-cmp")).not.toContainText("Hidden until answered");
  // Shown: the blind answers are locked, so the saved row holds only answers given blind.
  await expect(page.locator(".admin-lab-side .admin-yn button:enabled")).toHaveCount(0);
  await expect(sides(page).nth(0)).toContainText("the answers are locked");
  const leftIsA = titles[0].startsWith("Side A");

  await save.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Result saved with both runs." }),
  ).toBeVisible();
  await expect(save).toBeDisabled();

  // The answers are saved with both runs (FR-AILAB-5).
  const [saved] = await rowsOf(writer.token, "ai_comparisons");
  const published = runs.find((run) => run.prompt_version === 1)!;
  const draft = runs.find((run) => run.prompt_version === 2)!;
  // Side A's answers (whichever panel showed it) are saved with run A, side B's with run B.
  expect(saved).toMatchObject({
    feature_slug: "pause_message",
    sample_id: null,
    run_a: published.id,
    run_b: draft.id,
    blind: true,
    answers_a: leftIsA ? left : right,
    answers_b: leftIsA ? right : left,
  });
  expect((saved.questions as string[]).length).toBe(count);
});

test("test_478_ac1_two_models_not_blind_a_on_the_left", async ({ page, context }) => {
  const admin = await labAccount(page, context, "admin");
  await page.goto("/admin/ai-lab?feature=closing_line");
  await expect(settings(page).getByRole("combobox", { name: "Feature" })).toHaveValue(
    "closing_line",
  );
  await noSample(page);
  await settings(page).getByRole("combobox", { name: "Side A" }).selectOption("model:stub");
  await settings(page).getByRole("combobox", { name: "Side B" }).selectOption("model:stub-b");
  await settings(page).getByRole("checkbox", { name: /Blind/ }).uncheck();
  await settings(page).getByRole("button", { name: "Run both" }).click();

  await expect(sides(page).nth(0).locator("h2")).toHaveText(
    "Side A · Stub model: stub (published version)",
  );
  await expect(sides(page).nth(1).locator("h2")).toHaveText(
    "Side B · Stub model: stub-b (published version)",
  );
  await expect(sides(page).nth(1).locator('pre[aria-label="Answer"]')).not.toBeEmpty();
  const runs = await rowsOf(admin.token, "ai_runs?order=run_at.desc");
  expect(runs.map((run) => run.model).sort()).toEqual(["stub", "stub-b"]);
  expect(runs.every((run) => run.stub === true && run.prompt_source === "published")).toBe(true);

  const left = await answerAll(page, 0, LEFT);
  const right = await answerAll(page, 1, RIGHT);
  // Not blind: answers stay editable; change and restore one to show it.
  const first = sides(page).nth(0).getByRole("group").first();
  await first.getByRole("button", { name: "No", exact: true }).click();
  await first.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText("Result saved with both runs.")).toBeVisible();
  const [saved] = await rowsOf(admin.token, "ai_comparisons");
  // Not blind: side A is the left panel.
  expect(saved).toMatchObject({
    feature_slug: "closing_line",
    run_a: runs.find((run) => run.model === "stub")!.id,
    run_b: runs.find((run) => run.model === "stub-b")!.id,
    blind: false,
    answers_a: left,
    answers_b: right,
  });
});

test("test_478_ac2_the_database_refuses_answers_for_another_accounts_runs", async ({
  page,
  context,
}) => {
  const admin = await labAccount(page, context, "admin");
  await page.goto("/admin/ai-lab?feature=closing_line");
  await noSample(page);
  await settings(page).getByRole("button", { name: "Run both" }).click();
  await expect(sides(page).nth(1).locator('pre[aria-label="Answer"]')).not.toBeEmpty();
  const runs = await rowsOf(admin.token, "ai_runs");
  const questions = 4;
  const body = (answers: unknown[]) => ({
    comparison: {
      run_a: runs[0].id,
      run_b: runs[1].id,
      blind: true,
      answers_a: answers,
      answers_b: answers,
    },
  });
  // The wrong number of answers, or an answer that is not yes or no: refused.
  const short = await stub("/rest/v1/rpc/save_ai_comparison", admin.token, body([true]));
  expect(short.status).toBe(400);
  const words = await stub(
    "/rest/v1/rpc/save_ai_comparison",
    admin.token,
    body(Array.from({ length: questions }, () => "yes")),
  );
  expect(words.status).toBe(400);
  // Another account (a writer with its own log) cannot save answers for these runs.
  const other = await signIn(context, baseUrlOf(page), undefined, { contentRole: "writer" });
  await stub("/__ai_runs", null, { token: other.token, log: "own" });
  const foreign = await stub(
    "/rest/v1/rpc/save_ai_comparison",
    other.token,
    body(Array.from({ length: questions }, () => true)),
  );
  // The stand-in does not find another account's runs (404, P0002); the database finds them and
  // refuses them as not the account's own (22023, tried on Postgres in the pull request).
  expect([400, 404]).toContain(foreign.status);
  expect(await rowsOf(admin.token, "ai_comparisons")).toEqual([]);
});

// #517 AC4: any stored version of a key (here an earlier, rolled-back rest_reply v2 beside the
// draft v3, and the inactive rest_reply_review v1) runs on a sample, with the call inputs the
// sample does not hold. The account reads its own stored versions and the R-08 row
// (POST /__ai_features { registry: true, storedVersions: true }); the model is the stub.
async function storedVersionsAccount(page: Page, context: BrowserContext) {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: "admin" });
  const registry = { token: account.token, registry: true, storedVersions: true };
  expect((await stub("/__ai_features", null, registry)).status).toBe(200);
  expect((await stub("/__ai_runs", null, { token: account.token, log: "own" })).status).toBe(200);
  return account;
}

test("test_517_ac4_a_stored_version_runs_against_the_draft_on_a_sample_blind", async ({
  page,
  context,
}) => {
  const admin = await storedVersionsAccount(page, context);
  await page.goto("/admin/ai-lab?feature=rest_reply");
  await expect(settings(page).getByRole("button", { name: "Run both" })).toBeEnabled();
  const sample = settings(page).getByRole("combobox", { name: "Sample (the same for both sides)" });
  await expect(sample).toHaveValue("invented-lamp-maker");
  const sideA = settings(page).getByRole("combobox", { name: "Side A" });
  await expect(sideA.locator("option")).toHaveText([
    "Published version (v1)",
    "Draft version (v3)",
    "Stored version (v2)",
    "Stub model: stub (published version)",
    "Stub model: stub-b (published version)",
  ]);
  await sideA.selectOption("version:2");
  await settings(page).getByRole("combobox", { name: "Side B" }).selectOption("draft");

  // The person's message is a call input, the same for both sides; empty, the lab says so.
  const wrote = settings(page).getByRole("textbox", { name: /The person wrote/ });
  await expect(page.locator(".admin-lab-warning")).toContainText(
    "Write the call input The person wrote.",
  );
  await wrote.fill("Do you light the lamps at night?");
  await expect(page.locator(".admin-lab-warning")).toHaveCount(0);

  await settings(page).getByRole("button", { name: "Run both" }).click();
  await expect(sides(page)).toHaveCount(2);
  await expect(sides(page).nth(0).locator("h2")).toContainText("Hidden until answered");
  for (const panel of [0, 1]) {
    await expect(sides(page).nth(panel).locator('pre[aria-label="Answer"]')).not.toBeEmpty();
  }

  const runs = await rowsOf(admin.token, "ai_runs?order=run_at.desc");
  expect(runs.map((run) => run.prompt_version).sort()).toEqual([2, 3]);
  for (const run of runs) {
    expect(run).toMatchObject({
      feature_slug: "rest_reply",
      prompt_key: "rest_reply",
      prompt_source: "draft",
      sample_id: "invented-lamp-maker",
      stub: true,
      status: "ok",
    });
    // The gateway's own prompt, from the sample's facts and the call input.
    expect(run.input).toContain("Do you light the lamps at night?");
    expect(run.input).toContain("She sells lamps on market days.");
    expect(run.input).not.toContain("{{");
  }
  const v2 = runs.find((run) => run.prompt_version === 2)!;
  const v3 = runs.find((run) => run.prompt_version === 3)!;
  expect(v2.input).toContain("An invented earlier line of v2.");
  expect(v3.input).toContain("An invented draft line of v3.");

  // Blind still holds, and side A's answers go with run A.
  const left = await answerAll(page, 0, LEFT);
  const right = await answerAll(page, 1, RIGHT);
  const titles = (await sides(page).locator("h2").allTextContents()).map((text) => text.trim());
  expect([...titles].sort()).toEqual([
    "Side A · Stored version (v2)",
    "Side B · Draft version (v3)",
  ]);
  await expect(page.locator(".admin-lab-side .admin-yn button:enabled")).toHaveCount(0);
  const leftIsA = titles[0].startsWith("Side A");
  await page.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText("Result saved with both runs.")).toBeVisible();
  const [saved] = await rowsOf(admin.token, "ai_comparisons");
  expect(saved).toMatchObject({
    feature_slug: "rest_reply",
    sample_id: "invented-lamp-maker",
    run_a: v2.id,
    run_b: v3.id,
    blind: true,
    answers_a: leftIsA ? left : right,
    answers_b: leftIsA ? right : left,
  });
});

test("test_517_ac4_the_inactive_rest_reply_review_runs_with_its_draft_input", async ({
  page,
  context,
}) => {
  const admin = await storedVersionsAccount(page, context);
  await page.goto("/admin/ai-lab?feature=rest_reply_review");
  await expect(settings(page).getByRole("button", { name: "Run both" })).toBeEnabled();
  await expect(settings(page).getByRole("combobox", { name: "Feature" })).toHaveValue(
    "rest_reply_review",
  );
  await expect(settings(page).getByRole("combobox", { name: "Side A" })).toHaveValue("draft");
  await settings(page)
    .getByRole("textbox", { name: /The person wrote/ })
    .fill("Are you tired?");
  await settings(page)
    .getByRole("textbox", { name: /Draft \(call one's reply\)/ })
    .fill("I am, a little. The wicks will not wait.");
  await settings(page).getByRole("checkbox", { name: /Blind/ }).uncheck();
  await settings(page).getByRole("button", { name: "Run both" }).click();
  await expect(sides(page).nth(0).locator("h2")).toHaveText("Side A · Draft version (v1)");
  await expect(sides(page).nth(1).locator('pre[aria-label="Answer"]')).not.toBeEmpty();

  const runs = await rowsOf(admin.token, "ai_runs?order=run_at.desc");
  expect(runs).toHaveLength(2);
  for (const run of runs) {
    expect(run).toMatchObject({
      feature_slug: "rest_reply_review",
      prompt_key: "rest_reply_review",
      prompt_version: 1,
      prompt_source: "draft",
      stub: true,
      status: "ok",
    });
    expect(run.input).toContain("Draft: I am, a little. The wicks will not wait.");
    expect(run.input).toContain("The person wrote: Are you tired?");
  }
});
