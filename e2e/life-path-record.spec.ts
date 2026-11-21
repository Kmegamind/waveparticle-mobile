import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #94 AC1: a finished row on the Life Path opens the record of that Story as played, and the
// record's back link returns to the Life Path. AC4: rows that were not played open nothing.

const GOAL = "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f901";
const SESSION = "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f902";
const STEP = "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f903";
const SESSION_STEP = "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f904";
const CLOSING = "I left the seminar room with one clear sentence.";
const CARD = "The chalk dust settled on my sleeve.";

async function signInWithFinishedStory(page: Page) {
  const at = new Date(Date.now() - 60 * 60_000).toISOString();
  return signIn(page.context(), baseUrlOf(page), (userId) => ({
    goals: [
      {
        id: GOAL,
        user_id: userId,
        title: "Write the report",
        text: "Write the report",
        status: "done",
        kind: "one_time",
        created_at: at,
        updated_at: at,
      },
    ],
    steps: [
      { id: STEP, goal_id: GOAL, position: 0, title: "Outline", description: null, minutes: 10 },
    ],
    sessions: [
      {
        id: SESSION,
        goal_id: GOAL,
        user_id: userId,
        state: "completed",
        companion_id: "oppenheimer",
        story_id: "bohr-difficulties",
        seed: "s",
        step_count: 1,
        started_at: at,
        last_active_at: at,
        completed_at: at,
        closing_line: CLOSING,
      },
    ],
    session_steps: [
      {
        id: SESSION_STEP,
        session_id: SESSION,
        step_id: STEP,
        position: 0,
        opened_at: at,
        done_at: at,
      },
    ],
    session_lines: [
      {
        id: "f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f905",
        session_id: SESSION,
        session_step_id: SESSION_STEP,
        seq: 0,
        kind: "background",
        card_id: null,
        source: "authored",
        text: CARD,
        pause_number: null,
        shown_at: at,
      },
    ],
  }));
}

test("test_94_ac1_a_finished_life_path_row_opens_the_record_of_that_story", async ({ page }) => {
  await signInWithFinishedStory(page);
  await page.goto("/companions/oppenheimer");

  const finished = page.locator('.life-row[data-state="finished"]');
  await expect(finished).toHaveCount(1);
  await expect(finished).toContainText(CLOSING);
  const link = finished.getByRole("link", { name: /^Finished: / });
  await expect(link).toHaveAttribute("href", `/me/history/${SESSION}/chapter?from=life-path`);

  // #97 AC1: the arrow marks the row as tappable and is not read aloud.
  await expect(link.locator(".life-arrow")).toHaveText("›");
  await expect(link).toHaveAccessibleName(/^Finished: .*[^›]$/);

  // AC4: the current and later rows open no record.
  await expect(
    page.locator('.life-row:not([data-state="finished"]) a[href*="/chapter"]'),
  ).toHaveCount(0);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/me/history/${SESSION}/chapter\\?from=life-path$`));
  // The record's own sections: the Life Path page left by the client navigation stays in the DOM
  // (cacheComponents keeps it in a hidden Activity), so look only inside the record.
  await expect(page.getByText(CARD)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "How his day ended" }).getByText(CLOSING),
  ).toBeVisible();

  await page.getByRole("link", { name: "Back to the Life Path" }).click();
  await expect(page).toHaveURL(/\/companions\/oppenheimer$/);
});
