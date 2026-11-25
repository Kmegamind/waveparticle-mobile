import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import { promptMark, promptsSince } from "./support/stub-prompts";

// #114, fix round 1 (I2): with a model configured (the stub model), a flagged participant goes
// through the focus page, Pause, Back to step and Done, and no model call is made for them.
//
// The stub's prompt list is shared by the live tests running at the same time, so each test plays
// an open session on a story no other live test plays (fermi-award) and looks only for prompts
// that carry that story's own words. The control test, without the flag, shows that Pause does
// send such a prompt, so the flagged test's "none" means something.

const STORY = "fermi-award";
const stage0 = JSON.parse(readFileSync(`docs/demo/${STORY}.stage0.json`, "utf8")) as {
  who: string;
  story: { goalShort: string; title: string };
};
/** Words of this story that its pause and return prompts carry. */
const STORY_WORDS = [stage0.who.slice(0, 40), stage0.story.goalShort, stage0.story.title];
const aboutThisStory = (prompt: string) => STORY_WORDS.some((words) => prompt.includes(words));

/** A Goal of two Steps with an open session on this story, as Start leaves it. */
async function signInOnTheStory(page: Page, researchCondition?: "no_story") {
  const goal = randomUUID();
  const session = randomUUID();
  const steps = [randomUUID(), randomUUID()];
  const now = new Date().toISOString();
  await signIn(
    page.context(),
    baseUrlOf(page),
    (userId) => ({
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
          story_id: STORY,
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
    }),
    researchCondition ? { researchCondition } : {},
  );
  return goal;
}

// The flagged test runs first and alone: the control's own prompts must not fall in its window.
test.describe.configure({ mode: "serial" });

test("test_114_i2_a_flagged_participant_causes_no_model_call_through_focus_pause_and_done", async ({
  page,
  request,
}) => {
  const goal = await signInOnTheStory(page, "no_story");
  const mark = await promptMark(request);

  await page.goto(`/focus?goal=${goal}`);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();
  await focus.getByRole("button", { name: "Pause" }).click();
  const rest = page.locator('main.rest-page[data-ready="true"]');
  await expect(rest).toBeVisible();
  // His first message would arrive within 2.5 seconds; wait past that.
  await page.waitForTimeout(3_000);
  await expect(rest.getByTestId("his-message")).toHaveCount(0);
  await rest.getByRole("button", { name: "Back to step" }).click();
  await expect(focus).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await focus.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(1_400);
  await focus.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Step done")).toBeVisible();
  await page.waitForTimeout(1_000);

  expect((await promptsSince(request, mark)).filter(aboutThisStory)).toEqual([]);
});

test("test_114_i2_control_without_the_flag_pause_sends_a_prompt_about_the_story", async ({
  page,
  request,
}) => {
  const goal = await signInOnTheStory(page);
  const mark = await promptMark(request);
  await page.goto(`/focus?goal=${goal}`);
  await expect(page.locator('main.focus-page[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator('main.rest-page[data-ready="true"]')).toBeVisible();
  await expect
    .poll(async () => (await promptsSince(request, mark)).some(aboutThisStory), {
      timeout: 10_000,
    })
    .toBe(true);
});
