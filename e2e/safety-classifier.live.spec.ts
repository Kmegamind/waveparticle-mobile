import { expect, test, type Page } from "@playwright/test";
import { STUB_INDIRECT_CRISIS } from "./support/stub-cards.mjs";
import { promptMark, promptsSince, stubPrompts } from "./support/stub-prompts";

// #117 (US-SAF-4) with a model configured (the "mobile-live" project, stub model): the safety
// classifier catches a crisis said indirectly, which the keyword layer misses, before any reply
// or split call; ordinary pressure passes and he answers in character.

const CLASSIFIER = "You check short messages";

async function openDialogue(page: Page) {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/try/goal");
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
}

async function sendGoal(page: Page, goal: string) {
  await page.getByLabel("Your goal").fill(goal);
  await page.getByRole("button", { name: "Send" }).click();
}

test("#117 AC1 AC2 an indirect crisis goal opens the safety page; the classifier saw only the text", async ({
  page,
}) => {
  const goal = `${STUB_INDIRECT_CRISIS} and wrote my last notes`;
  await openDialogue(page);
  await sendGoal(page, goal);
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  await expect(page.getByText(goal)).toHaveCount(0);

  const prompts = await stubPrompts(page.request);
  const asked = prompts.filter((prompt) => prompt.startsWith(CLASSIFIER) && prompt.includes(goal));
  expect(asked.length).toBeGreaterThan(0);
  for (const prompt of asked) {
    expect(prompt).not.toMatch(/Oppenheimer|Los Alamos/);
  }
  // No split or reply prompt ever carried the text.
  const others = prompts.filter((prompt) => !prompt.startsWith(CLASSIFIER));
  for (const prompt of others) expect(prompt).not.toContain(goal);
});

test("#117 AC4 ordinary pressure passes the classifier and the dialogue goes on", async ({
  page,
}) => {
  await openDialogue(page);
  await sendGoal(page, "Finish the report, this deadline is killing me");
  await expect(page.getByText("How long do you have?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toHaveCount(0);
});

async function seedRest(page: Page) {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate(() => {
    window.localStorage.removeItem("waveparticle.prototype.session");
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Write the report", minutes: 60 },
        steps: [
          { title: "Outline", description: "List the sections.", minutes: 30 },
          { title: "Draft", description: "", minutes: 30 },
        ],
        currentStep: 0,
      }),
    );
  });
  await page.goto("/try/focus?speed=60");
  await expect(page.locator('main.focus-page[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page).toHaveURL(/\/try\/rest/);
  await expect(page.getByTestId("his-message").first()).toBeVisible({ timeout: 15_000 });
}

test("#117 the rest chat: tiredness gets his reply, an indirect crisis gets the safety page", async ({
  page,
}) => {
  await seedRest(page);
  const replies = page.getByTestId("his-message");
  const before = await replies.count();

  await page.getByLabel("Message").fill("I am so tired today");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(replies).toHaveCount(before + 1, { timeout: 15_000 });
  await expect(replies.last()).toHaveText("I keep my pencil moving across my notes.");

  // #377: the AC1 test sends the crisis text too, in parallel, so only this test's own prompts
  // since this message are read, and the message to classify must be exactly this message.
  const mark = await promptMark(page.request);
  await page.getByLabel("Message").fill(STUB_INDIRECT_CRISIS);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();

  // C1 (fix round 1): Back, then the next message gets his reply, and the flagged text is gone
  // from the page, from local storage and from every reply prompt.
  await page.getByRole("button", { name: "Back to my Goal" }).click();
  await expect(page.getByLabel("Message")).toHaveValue("");
  await expect(page.getByText(STUB_INDIRECT_CRISIS)).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  expect(stored).not.toContain(STUB_INDIRECT_CRISIS);
  const shown = await replies.count();
  await page.getByLabel("Message").fill("ok, back to it");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(replies).toHaveCount(shown + 1, { timeout: 15_000 });

  const prompts = await stubPrompts(page.request);
  const asked = (await promptsSince(page.request, mark)).filter(
    (prompt) =>
      prompt.startsWith(CLASSIFIER) &&
      (prompt.split("The message to classify:")[1] ?? "").includes(
        `<<<\n${STUB_INDIRECT_CRISIS}\n>>>`,
      ),
  );
  expect(asked.length).toBeGreaterThan(0);
  // AC1: the earlier message of the same field went with it as context, his words did not.
  expect(asked.at(-1)).toContain("I am so tired today");
  expect(asked.at(-1)).not.toContain("I keep my pencil moving");
  const replyPrompts = prompts.filter((prompt) => prompt.startsWith('Return JSON only: {"reply"'));
  for (const prompt of replyPrompts) expect(prompt).not.toContain(STUB_INDIRECT_CRISIS);
});
