import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn, stubTables } from "./support/account";

// #300: the signed-in focus page shows the story's published pre-made cards (from the Supabase
// stub's seed deck), with no model call; a failed read shows the failure screen and the clock
// does not start (FAIL-PREMADE). The stub's read switch is shared, so these tests run in order.

test.describe.configure({ mode: "serial" });

const GOAL = "dddddddd-dddd-4ddd-8ddd-dddddddddd01";
const SESSION = "dddddddd-dddd-4ddd-8ddd-dddddddddd02";
const STEP = ["dddddddd-dddd-4ddd-8ddd-dddddddddd03", "dddddddd-dddd-4ddd-8ddd-dddddddddd04"];
const decks = JSON.parse(
  readFileSync(
    path.join(__dirname, "..", "src", "content", "oppenheimer", "story-decks.json"),
    "utf8",
  ),
);
const BACKGROUND: string = decks["site-search"].background;

async function storyCardsStub(failReads: boolean) {
  const answer = await fetch(`${STUB_SUPABASE}/__story_cards`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ failReads }),
  });
  if (!answer.ok) throw new Error(`stub story cards failed: ${answer.status}`);
}

test.afterEach(() => storyCardsStub(false));

/** A Goal of two 15 minute Steps with its open session on "The Canyon and the Mesa". */
async function signInWithOpenSession(page: Page) {
  const now = new Date().toISOString();
  return signIn(page.context(), baseUrlOf(page), (userId) => ({
    goals: [
      {
        id: GOAL,
        user_id: userId,
        title: "Write the report",
        text: "Write the report",
        status: "in_progress",
        kind: "one_time",
        created_at: now,
        updated_at: now,
      },
    ],
    steps: STEP.map((id, position) => ({
      id,
      goal_id: GOAL,
      position,
      title: position === 0 ? "Outline" : "Draft",
      description: null,
      minutes: 15,
    })),
    sessions: [
      {
        id: SESSION,
        goal_id: GOAL,
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
    session_steps: STEP.map((stepId, position) => ({
      id: `dddddddd-dddd-4ddd-8ddd-dddddddddd1${position}`,
      session_id: SESSION,
      step_id: stepId,
      position,
      opened_at: null,
      done_at: null,
    })),
  }));
}

test("test_300_ac3_the_signed_in_focus_page_opens_with_the_pre_made_background_card", async ({
  page,
}) => {
  const account = await signInWithOpenSession(page);
  await page.goto(`/focus?goal=${GOAL}`);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await expect(focus.getByText("Step 1 of 2", { exact: true })).toBeVisible();
  await expect(focus.getByTestId("story-card")).toContainText(BACKGROUND);
  await expect(focus.getByText(/Test data/)).toHaveCount(0);
  // AC4: the session records the versions of the cards it uses.
  await expect
    .poll(async () => {
      const tables = await stubTables(account);
      const session = (tables.sessions as { id: string; card_versions?: unknown }[]).find(
        (row) => row.id === SESSION,
      );
      return session?.card_versions ?? null;
    })
    .toMatchObject({ "crd.opp.site-search.bg": 1, "crd.opp.site-search.p1.c1": 1 });
});

test("test_300_ac3_a_failed_read_shows_the_failure_screen_and_the_clock_waits", async ({
  page,
}) => {
  await signInWithOpenSession(page);
  await storyCardsStub(true);
  await page.goto(`/focus?goal=${GOAL}`);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  const retry = focus.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await expect(focus.getByTestId("story-card")).toHaveCount(0);
  const clock = focus.getByRole("timer", { name: "Time left" });
  await expect(clock).toHaveText("15:00");
  await page.waitForTimeout(1_500);
  await expect(clock).toHaveText("15:00");

  await storyCardsStub(false);
  await retry.click();
  await expect(focus.getByTestId("story-card")).toContainText(BACKGROUND);
});
