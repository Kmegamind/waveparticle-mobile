import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";

// #521: Snape (stories, no enterHref) is a preview for admins and writers only. A user account
// cannot reach him by the Companions list, by his address, by the goal dialogue or with a session
// row it wrote itself; an admin can. Snape's stories are the invented drafts of the stand-in.

const STORY = "inv-locked-door";
const PREVIEW_NOTE = "Preview. He is not public yet: only admins and writers can enter him.";

/** A Goal of two Steps and a session on a Snape story, as an account could write with its key. */
function snapeSession(state: "open" | "completed") {
  const goal = randomUUID();
  const session = randomUUID();
  const steps = [randomUUID(), randomUUID()];
  const now = new Date().toISOString();
  return {
    goal,
    session,
    tables: (userId: string) => ({
      goals: [
        {
          id: goal,
          user_id: userId,
          title: "Write the report",
          text: "Write the report",
          status: state === "open" ? "in_progress" : "done",
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
          state,
          companion_id: "snape",
          story_id: STORY,
          seed: "s",
          step_count: 2,
          started_at: now,
          last_active_at: now,
          completed_at: state === "completed" ? now : null,
        },
      ],
      session_steps: steps.map((stepId, position) => ({
        id: randomUUID(),
        session_id: session,
        step_id: stepId,
        position,
        opened_at: now,
        done_at: state === "completed" ? now : null,
      })),
    }),
  };
}

async function selectSnape(page: Page) {
  await page.goto("/companions");
  await page.getByRole("radio", { name: /Severus Snape/ }).click();
}

test("test_521_ac1_refusal_a_user_sees_snape_with_enter_off_and_his_address_is_404", async ({
  page,
}) => {
  await signIn(page.context(), baseUrlOf(page));
  await selectSnape(page);
  await expect(page.getByText("His stories are not ready yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter" })).toBeDisabled();
  await expect(page.getByText(PREVIEW_NOTE)).toHaveCount(0);

  // The normal not-found page (a streamed page answers it with status 200, as every signed-in page
  // that calls notFound() after reading the account).
  await page.goto("/companions/snape");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByText("Invented story 1")).toHaveCount(0);

  // The goal dialogue for him sends a user back to the list.
  await page.goto("/goal?companion=snape");
  await expect(page).toHaveURL(/\/companions$/);
});

test("test_521_ac1_refusal_a_session_row_a_user_wrote_for_snape_opens_nothing", async ({
  page,
}) => {
  const open = snapeSession("open");
  await signIn(page.context(), baseUrlOf(page), open.tables);
  for (const address of [`/focus?goal=${open.goal}`, `/focus?goal=${open.goal}&companion=snape`]) {
    await page.goto(address);
    await expect(page.getByText("There is no Goal to work on yet.")).toBeVisible();
    await expect(page.getByTestId("story-card")).toHaveCount(0);
  }
  await page.goto("/rest");
  await expect(page.getByText("There is no Step to rest from.")).toBeVisible();
});

test("test_521_ac1_refusal_a_finished_snape_session_of_a_user_has_no_summary", async ({ page }) => {
  const done = snapeSession("completed");
  await signIn(page.context(), baseUrlOf(page), done.tables);
  await page.goto(`/end?session=${done.session}`);
  await expect(page.getByText("There is no finished Step to sum up.")).toBeVisible();
  await expect(page.getByTestId("closing-line")).toHaveCount(0);
});

test("test_521_ac1_an_admin_enters_snapes_life_path_from_the_companions_list", async ({ page }) => {
  await signIn(page.context(), baseUrlOf(page), () => ({}), { contentRole: "admin" });
  await selectSnape(page);
  await expect(page.getByText(PREVIEW_NOTE)).toBeVisible();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/companions\/snape$/);
  await expect(page.getByRole("heading", { name: "Snape", level: 1 })).toBeVisible();
  const current = page.locator('[data-state="current"]');
  await expect(current).toContainText("Invented story 1");
  await expect(current.getByRole("link", { name: "Begin" })).toHaveAttribute(
    "href",
    "/goal?companion=snape",
  );
});

test("test_521_ac1_a_writer_may_preview_him_too", async ({ page }) => {
  await signIn(page.context(), baseUrlOf(page), () => ({}), { contentRole: "writer" });
  await page.goto("/companions/snape");
  await expect(page.locator("main.life-path").getByText(PREVIEW_NOTE)).toBeVisible();
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toHaveCount(0);
});

test("test_521_ac2_oppenheimer_is_unchanged_for_a_user", async ({ page }) => {
  await signIn(page.context(), baseUrlOf(page));
  await page.goto("/companions");
  await page.getByRole("radio", { name: /Oppenheimer/ }).click();
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/companions\/oppenheimer$/);
  await expect(page.getByRole("heading", { name: "Oppenheimer", level: 1 })).toBeVisible();
  await expect(page.getByText(PREVIEW_NOTE)).toHaveCount(0);
  await expect(
    page.locator('[data-state="current"]').getByRole("link", { name: "Begin" }),
  ).toHaveAttribute("href", "/goal");
});
