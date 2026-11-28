import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import { promptMark, promptsSince } from "./support/stub-prompts";

// #518 (REST-ROUND-10, R1-C10) with a model configured (the "mobile-live" project, the stub
// model, never the real one): in one Pause, his reply to the tenth message says his own work is
// going to fail, the text field and Send disappear, and only Back and Home stay. The count is kept
// on the account (the Supabase stand-in), so a reload keeps the ended state; a new Pause starts at
// round 1; a failed tenth reply, retried, still ends the chat.

const ENDING = "This piece of my work is going to fail, and I know it now.";
const ORDINARY = "I keep my pencil moving across my notes.";
const INSTRUCTION_WORDS = "tenth message";

/** A Goal of two Steps with an open session on the default story, as Start leaves it. */
async function signInWithASession(page: Page) {
  const goal = randomUUID();
  const session = randomUUID();
  const steps = [randomUUID(), randomUUID()];
  const now = new Date().toISOString();
  await signIn(page.context(), baseUrlOf(page), (userId) => ({
    goals: [
      {
        id: goal,
        user_id: userId,
        title: "Write the report",
        text: "Write the report",
        status: "in_progress",
        kind: "one_time",
        created_at: now,
        updated_at: now,
      },
    ],
    steps: steps.map((id, position) => ({
      id,
      goal_id: goal,
      position,
      title: position === 0 ? "Outline" : "Draft",
      description: null,
      minutes: 15,
    })),
    sessions: [
      {
        id: session,
        goal_id: goal,
        user_id: userId,
        state: "open",
        companion_id: "oppenheimer",
        story_id: "site-search",
        seed: "s",
        step_count: 2,
        started_at: now,
        last_active_at: now,
        completed_at: null,
      },
    ],
    session_steps: steps.map((stepId, position) => ({
      id: randomUUID(),
      session_id: session,
      step_id: stepId,
      position,
      opened_at: null,
      done_at: null,
    })),
  }));
  return { goal, session };
}

const restPage = (page: Page) => page.locator('main.rest-page[data-ready="true"]');

/** Focus page, then Pause: the rest page with his first message. */
async function pause(page: Page) {
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await focus.getByRole("button", { name: "Pause" }).click();
  const rest = restPage(page);
  await expect(rest).toBeVisible();
  await expect(rest.getByTestId("his-message")).toHaveCount(1, { timeout: 15_000 });
  return rest;
}

/** Sends one message and waits for his reply (his first message plus `replies` replies). */
async function send(rest: Locator, text: string, replies: number) {
  await rest.getByLabel("Message").fill(text);
  await rest.getByRole("button", { name: "Send" }).click();
  await expect(rest.getByTestId("his-message")).toHaveCount(1 + replies, { timeout: 15_000 });
}

/** The ended state of R1-C10: no field, no Send, no failure box; Back and Home stay. */
async function expectEnded(rest: Locator) {
  await expect(rest.getByLabel("Message")).toHaveCount(0);
  await expect(rest.getByRole("button", { name: "Send" })).toHaveCount(0);
  await expect(rest.getByRole("button", { name: "Back to step" })).toBeVisible();
  await expect(rest.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(rest.getByRole("button", { name: "Retry" })).toHaveCount(0);
  // No counter and no round number anywhere on the page.
  await expect(rest).not.toContainText(/of 10|round \d|\d+ \/ 10/i);
}

test("test_518_ac1_ac3_the_tenth_message_ends_the_chat_and_a_reload_keeps_it", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const { goal, session } = await signInWithASession(page);
  const marker = `r518-${randomUUID().slice(0, 8)}`;
  const mark = await promptMark(request);
  await page.goto(`/focus?goal=${goal}`);
  const rest = await pause(page);

  for (let round = 1; round <= 9; round += 1) {
    await send(rest, `${marker} message ${round}`, round);
    await expect(rest.getByTestId("his-message").last()).toHaveText(ORDINARY);
    // Nothing warns before round 10.
    await expect(rest.getByLabel("Message")).toBeVisible();
  }
  await send(rest, `${marker} message 10`, 10);
  await expect(rest.getByTestId("his-message").last()).toHaveText(ENDING);
  await expectEnded(rest);
  await testInfo.attach("R1-C10-live", {
    body: await page.screenshot({ fullPage: false }),
    contentType: "image/png",
  });

  // Only the tenth reply's prompt carried the added instruction.
  const mine = (await promptsSince(request, mark)).filter(
    (prompt) => prompt.startsWith('Return JSON only: {"reply"') && prompt.includes(marker),
  );
  expect(mine).toHaveLength(10);
  expect(mine.map((prompt) => prompt.includes(INSTRUCTION_WORDS))).toEqual([
    ...Array<boolean>(9).fill(false),
    true,
  ]);

  // AC3: a reload shows the ended state for this Pause.
  await page.reload();
  await expect(restPage(page)).toBeVisible();
  await expect(restPage(page).getByTestId("his-message").last()).toHaveText(ENDING);
  await expectEnded(restPage(page));

  // The count is on the account: with the ended mark removed from this device, a reload still
  // ends the chat.
  await page.evaluate((key) => {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    delete stored.rest.ended;
    window.localStorage.setItem(key, JSON.stringify(stored));
  }, `waveparticle.session.${session}`);
  await page.reload();
  await expect(restPage(page)).toBeVisible();
  await expectEnded(restPage(page));
});

test("test_518_ac2_a_new_pause_starts_at_round_1", async ({ page, request }) => {
  test.setTimeout(150_000);
  const { goal } = await signInWithASession(page);
  const marker = `r518-${randomUUID().slice(0, 8)}`;
  await page.goto(`/focus?goal=${goal}`);
  let rest = await pause(page);
  for (let round = 1; round <= 10; round += 1) await send(rest, `${marker} m${round}`, round);
  await expectEnded(rest);

  // Back to step, Start, Pause again: a new rest chat with its field.
  await rest.getByRole("button", { name: "Back to step" }).click();
  const popup = page.getByRole("dialog");
  await expect(popup.getByRole("button", { name: "Start" })).toBeVisible({ timeout: 15_000 });
  await popup.getByRole("button", { name: "Start" }).click();
  await expect(popup).toHaveCount(0);
  rest = await pause(page);
  await expect(rest.getByLabel("Message")).toBeVisible();
  const mark = await promptMark(request);
  await send(rest, `${marker} again`, 1);
  await expect(rest.getByTestId("his-message").last()).toHaveText(ORDINARY);
  await expect(rest.getByLabel("Message")).toBeVisible();
  const prompt = (await promptsSince(request, mark)).find((item) =>
    item.includes(`${marker} again`),
  );
  expect(prompt).toBeDefined();
  expect(prompt).not.toContain(INSTRUCTION_WORDS);
});

test("test_518_ac4_a_failed_tenth_reply_retried_still_ends_the_chat", async ({ page }) => {
  test.setTimeout(150_000);
  const { goal } = await signInWithASession(page);
  const marker = `r518-${randomUUID().slice(0, 8)}`;
  await page.goto(`/focus?goal=${goal}`);
  const rest = await pause(page);
  for (let round = 1; round <= 9; round += 1) await send(rest, `${marker} m${round}`, round);

  // The tenth reply's request fails on the way (no connection): the failure box with Retry.
  let blocked = 0;
  await page.route("**/rest", async (route) => {
    if (route.request().method() === "POST" && blocked === 0) {
      blocked += 1;
      await route.abort("internetdisconnected");
      return;
    }
    await route.fallback();
  });
  await rest.getByLabel("Message").fill(`${marker} m10`);
  await rest.getByRole("button", { name: "Send" }).click();
  const retry = rest.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  expect(blocked).toBe(1);
  await expect(rest.getByTestId("his-message")).toHaveCount(10);

  // Retry: the round is kept, so the reply is the ending and the chat ends.
  await retry.click();
  await expect(rest.getByTestId("his-message")).toHaveCount(11, { timeout: 15_000 });
  await expect(rest.getByTestId("his-message").last()).toHaveText(ENDING);
  await expectEnded(rest);
});
