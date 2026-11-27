import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { baseUrlOf, signIn, STUB_SUPABASE } from "./support/account";
import { e2ePorts } from "./support/ports";

// #477 (FR-AILAB-1, FR-AILAB-3, FR-AILAB-6; AI-RUN-PERMISSION, AI-LAB-STUB; docs/decisions/0037):
// the Run panel (/admin/ai-features/<slug>/run, drawing #reg-run) on the "mobile-live" app, whose
// model is the stub model (e2e/support/stub-model.mjs: 120 input and 30 output tokens, a provider
// error for the exact prompt "STUB MODEL ERROR") with a test price (playwright.config.ts). No real
// model is ever called. Each test's account reads and writes its own copy of the registry rows
// (POST /__ai_features { registry: true }) and its own run log (POST /__ai_runs { log: "own" },
// e2e/support/stub-ai-runs.mjs), so parallel tests never meet.

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

async function labAccount(
  page: Page,
  context: BrowserContext,
  role: "admin" | "writer",
  failFinish = false,
) {
  const account = await signIn(context, baseUrlOf(page), undefined, { contentRole: role });
  expect(
    (await stub("/__ai_features", null, { token: account.token, registry: true })).status,
  ).toBe(200);
  expect(
    (await stub("/__ai_runs", null, { token: account.token, log: "own", failFinish })).status,
  ).toBe(200);
  return account;
}

type Row = Record<string, unknown>;
const runsOf = async (token: string) =>
  (await (await stub("/rest/v1/ai_runs?order=run_at.desc", token)).json()) as Row[];
const featureRow = async (token: string, slug: string) =>
  ((await (await stub(`/rest/v1/ai_features?slug=eq.${slug}`, token)).json()) as Row[])[0];

const settings = (page: Page) => page.getByRole("form", { name: "Run settings" });
const answerPanel = (page: Page) => page.getByRole("region", { name: "Answer" });
const field = (page: Page, name: string) => answerPanel(page).locator(`dt:text-is("${name}") + dd`);

test("test_477_ac1_a_writer_runs_the_published_prompt_on_a_sample_and_sees_the_answer", async ({
  page,
  context,
}) => {
  const writer = await labAccount(page, context, "writer");
  await page.goto("/admin/ai-features/p04_plan_historical");
  await page.getByRole("link", { name: "Run", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/ai-features\/p04_plan_historical\/run$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Run P-04 /);
  await expect(page.locator(".admin-head .admin-pill-role-writer:visible")).toBeVisible();
  await expect(answerPanel(page).getByText("No runs yet")).toBeVisible();
  await expect(settings(page).getByRole("button", { name: "Published" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(settings(page).getByRole("combobox", { name: "Sample" })).toHaveValue(
    "invented-lamp-maker",
  );
  await expect(settings(page).getByRole("combobox", { name: "Model" })).toContainText(
    "Stub model (fake, no charge)",
  );
  await expect(settings(page)).toContainText("Today's spend (UTC day): $0.00. Not a cap.");

  await settings(page).getByRole("button", { name: "Run", exact: true }).click();
  await expect(answerPanel(page).locator(".admin-pill-mark")).toHaveText("Fake model (stub)");
  await expect(answerPanel(page)).toContainText(
    "The answer is fixed test text, not written by a model.",
  );
  await expect(answerPanel(page).locator('pre[aria-label="Answer"]')).not.toBeEmpty();
  await expect(answerPanel(page).getByRole("table", { name: "Checks" })).toContainText(
    "No checks for a pipeline feature.",
  );
  await expect(field(page, "Tokens")).toHaveText("120 in · 30 out");
  await expect(field(page, "Cost")).toHaveText("$0.000180 (stub, no charge)");
  await expect(field(page, "Prompt version")).toHaveText("Published v1");
  await expect(field(page, "Sample")).toHaveText("Lamp maker, first evening (invented)");
  await expect(answerPanel(page).getByRole("alert")).toHaveCount(0);

  // The sample's Companion filled {{name}} (docs/decisions/0037); the run is recorded as such.
  const [run] = await runsOf(writer.token);
  expect(run).toMatchObject({
    feature_slug: "p04_plan_historical",
    prompt_source: "published",
    prompt_version: 1,
    sample_id: "invented-lamp-maker",
    stub: true,
    status: "ok",
    input_tokens: 120,
    output_tokens: 30,
    cost: 0.00018,
  });
  expect(run.input).toContain("Ada Tester");
  expect(run.input).not.toContain("{{name}}");
  const sent = (await (
    await fetch(`http://127.0.0.1:${e2ePorts.stub}/prompts`)
  ).json()) as string[];
  expect(sent).toContain(run.input);
});

test("test_477_ac1_in_progress_while_the_model_answers", async ({ page, context }) => {
  await labAccount(page, context, "admin");
  await page.goto("/admin/ai-features/p04_plan_historical/run");
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/admin/ai-runs/run", async (route) => {
    await held;
    await route.continue();
  });
  await settings(page).getByRole("button", { name: "Run", exact: true }).click();
  const progress = answerPanel(page).getByRole("status");
  await expect(progress).toContainText("Run in progress");
  await expect(progress).toContainText(
    "Published v1 on Lamp maker, first evening (invented) · started by you",
  );
  await expect(progress.locator(".admin-pill-mark")).toHaveText("Fake model (stub)");
  await expect(settings(page).getByRole("button", { name: "Running…" })).toBeDisabled();
  release();
  await expect(answerPanel(page).locator('pre[aria-label="Answer"]')).toBeVisible();
  await expect(settings(page).getByRole("button", { name: "Run", exact: true })).toBeEnabled();
});

test("test_477_ac1_a_model_error_shows_an_error_with_retry", async ({ page, context }) => {
  const admin = await labAccount(page, context, "admin");
  await page.goto("/admin/ai-features/p04_plan_historical/run");
  await settings(page).getByRole("button", { name: "Pasted text" }).click();
  await settings(page)
    .getByRole("textbox", { name: "Pasted text (only with Pasted text)" })
    .fill("STUB MODEL ERROR");
  await settings(page).getByRole("combobox", { name: "Sample" }).selectOption("");
  await settings(page).getByRole("button", { name: "Run", exact: true }).click();
  const error = answerPanel(page).getByRole("alert");
  await expect(error).toContainText("The model did not answer.");
  await expect(error).toContainText("The run is recorded as a model error.");
  expect(await runsOf(admin.token)).toHaveLength(1);

  await error.getByRole("button", { name: "Retry" }).click();
  await expect(answerPanel(page).getByRole("alert")).toContainText("The model did not answer.");
  await expect.poll(async () => (await runsOf(admin.token)).length).toBe(2);
  for (const run of await runsOf(admin.token)) {
    expect(run).toMatchObject({
      prompt_source: "pasted",
      pasted_text: "STUB MODEL ERROR",
      status: "error",
      error_reason: "request",
      stub: true,
    });
  }
});

test("test_477_ac1_draft_version_of_one_prompt_key_and_a_sample_that_cannot_fill_it", async ({
  page,
  context,
}) => {
  const admin = await labAccount(page, context, "admin");
  await page.goto("/admin/ai-features/pause_message/run");
  const form = settings(page);
  await form.getByRole("combobox", { name: "Prompt" }).selectOption("stuck_story");
  await form.getByRole("button", { name: "Draft" }).click();
  // A runtime prompt's call inputs are not in a sample: the panel says so before Run, and the
  // server refuses before anything is recorded or sent.
  await expect(form.getByRole("note")).toContainText("A sample does not fill");
  await form.getByRole("button", { name: "Run", exact: true }).click();
  const refused = answerPanel(page).getByRole("alert");
  await expect(refused).toContainText(
    "The prompt could not be built, so the model was not called.",
  );
  await expect(refused).toContainText("A sample has no value for");
  await expect(refused.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(await runsOf(admin.token)).toHaveLength(0);

  await form.getByRole("combobox", { name: "Sample" }).selectOption("");
  await expect(form.getByRole("note")).toHaveCount(0);
  await form.getByRole("button", { name: "Run", exact: true }).click();
  await expect(field(page, "Prompt version")).toHaveText(/^Draft v\d+$/);
  await expect(field(page, "Sample")).toHaveText("No sample");
  await expect(answerPanel(page).getByRole("table", { name: "Checks" })).toContainText(
    "The checks need a sample.",
  );
  const [run] = await runsOf(admin.token);
  expect(run).toMatchObject({ prompt_key: "stuck_story", prompt_source: "draft", sample_id: null });
});

test("test_477_ac1_set_as_candidate_example_then_confirm", async ({ page, context }) => {
  const writer = await labAccount(page, context, "writer");
  await page.goto("/admin/ai-features/p04_plan_historical/run");
  await settings(page).getByRole("button", { name: "Run", exact: true }).click();
  const output = await answerPanel(page).locator('pre[aria-label="Answer"]').textContent();
  expect(output).toBeTruthy();

  await answerPanel(page).getByRole("button", { name: "Set as candidate example" }).click();
  await expect(answerPanel(page).getByRole("status")).toHaveText("Set as the candidate example.");
  expect(await featureRow(writer.token, "p04_plan_historical")).toMatchObject({
    example_text: output,
    example_state: "candidate",
    example_set_by: writer.userId,
  });

  await answerPanel(page).getByRole("button", { name: "Confirm" }).click();
  await expect(answerPanel(page).getByRole("status")).toHaveText(
    "Confirmed as the example. The earlier example stays in history.",
  );
  expect(await featureRow(writer.token, "p04_plan_historical")).toMatchObject({
    example_text: output,
    example_state: "confirmed",
  });

  // The feature page shows it with who and when; the history keeps both steps.
  await page.goto("/admin/ai-features/p04_plan_historical");
  const example = page.getByRole("region", { name: "Confirmed example" });
  await expect(example.locator(".admin-example-meta .admin-pill-example-confirmed")).toBeVisible();
  await expect(example).toContainText("Confirmed by");
  await expect(
    example.getByRole("table", { name: "Example history" }).locator("tbody tr"),
  ).toHaveCount(2);
});

test("test_477_a_run_the_database_did_not_record_is_shown_loudly", async ({ page, context }) => {
  const admin = await labAccount(page, context, "admin", true);
  await page.goto("/admin/ai-features/p04_plan_historical/run");
  await settings(page).getByRole("button", { name: "Run", exact: true }).click();
  const alert = answerPanel(page).getByRole("alert");
  await expect(alert).toContainText("The end of this run was not recorded.");
  await expect(answerPanel(page).locator('pre[aria-label="Answer"]')).toBeVisible();
  const [run] = await runsOf(admin.token);
  expect(run.status).toBe("running");

  await page.goto("/admin/ai-runs");
  const row = page.getByRole("table", { name: "Runs" }).locator("tbody tr").first();
  await expect(row).toContainText("Run in progress");
  await expect(page.locator(".admin-tile").first()).toContainText("1 without a cost");
});

test("test_477_ac2_the_runs_page_lists_a_panel_run_with_its_input_and_output", async ({
  page,
  context,
}) => {
  const admin = await labAccount(page, context, "admin");
  await page.goto("/admin/ai-features/p04_plan_historical/run");
  await settings(page).getByRole("button", { name: "Run", exact: true }).click();
  const output = await answerPanel(page).locator('pre[aria-label="Answer"]').textContent();

  await page
    .getByRole("navigation", { name: "Admin pages" })
    .getByRole("link", { name: /Runs/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/ai-runs$/);
  const row = page.getByRole("table", { name: "Runs" }).locator("tbody tr").first();
  await expect(row).toContainText("P-04");
  await expect(row).toContainText("Published v1");
  await expect(row).toContainText("Lamp maker, first evening (invented)");
  await expect(row).toContainText("150");
  await expect(row).toContainText("$0.000180");
  await expect(row.locator(".admin-pill-mark")).toHaveText("Stub");
  await expect(row).toContainText("Answered");
  const detail = page.getByRole("region", { name: /Run detail/ });
  await expect(detail.locator('pre[aria-label="Output"]')).toHaveText(output ?? "");
  const [run] = await runsOf(admin.token);
  await expect(detail.locator('pre[aria-label="Input"]')).toHaveText(String(run.input));
  await expect(page.getByRole("table", { name: "Total by user, today" })).toContainText(
    `${admin.userId}@example.invalid`,
  );
});
