import { expect, test } from "@playwright/test";
import { STUB_SUPABASE, baseUrlOf, signIn } from "./support/account";

// As e2e/support/invented-card-export.mjs (Playwright loads specs as CommonJS, so that ES module,
// which reads import.meta, cannot be imported here).
const newCardText = (storyId: string, part: number | null, position: number) =>
  part === null
    ? `Invented new background of ${storyId}.`
    : `Invented new card ${position} of part ${part} in ${storyId}.`;

// #521 AC1 with a model configured (the "mobile-live" project, the stub model): an admin account
// plays a whole run with Snape before he is public: Companions, his Life Path, the goal dialogue,
// the Plan, his cards, Pause, the rest chat, the return pop-up, the last Done and the closing.
// Snape's stories in the stand-in are the invented drafts of e2e/support/stub-drafts.mjs (his
// enterHref stays null); his first story gets an invented published deck for this test only.

const STORY = "inv-locked-door";
const PREVIEW_NOTE = "Preview. He is not public yet: only admins and writers can enter him.";

async function post(route: string, body: unknown) {
  const answer = await fetch(`${STUB_SUPABASE}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`${route} failed: ${answer.status}`);
}

test("test_521_ac1_an_admin_plays_a_whole_run_with_snape_before_he_is_public", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page.context(), baseUrlOf(page), () => ({}), { contentRole: "admin" });
  await post("/__story_cards", { deck: { story: STORY, cards: [2, 2] } });
  try {
    // Companions: Enter is on for an admin, with the preview note.
    await page.goto("/companions");
    await page.getByRole("radio", { name: /Severus Snape/ }).click();
    await expect(page.getByText(PREVIEW_NOTE)).toBeVisible();
    await page.getByRole("button", { name: "Enter" }).click();

    // His Life Path: his invented stories, the current one with Begin.
    await expect(page).toHaveURL(/\/companions\/snape$/);
    await expect(page.getByRole("heading", { name: "Snape", level: 1 })).toBeVisible();
    await expect(page.locator("main.life-path").getByText(PREVIEW_NOTE)).toBeVisible();
    const current = page.locator('[data-state="current"]');
    await expect(current).toContainText("Invented story 1");
    // His goal sentence is not published yet: nothing is invented in its place.
    await expect(current).toContainText("Not written yet");
    await current.getByRole("link", { name: "Begin" }).click();

    // The goal dialogue, headed by him; his opening is not published yet.
    await expect(page).toHaveURL(/\/goal\?companion=snape$/);
    const dialogue = page.locator('main.try-dialogue[data-ready="true"]');
    await expect(dialogue).toBeVisible();
    await expect(dialogue.locator(".try-companion-name")).toHaveText("Snape");
    await expect(dialogue.locator(".try-slip").first()).toHaveText("Not written yet");
    await expect(dialogue).not.toContainText(/Jemez|canyon|Dudley|McMillan/);
    await page.getByLabel("Your goal").fill("Read the paper on scattering");
    await page.getByRole("button", { name: "Just split it" }).click();
    await expect(page.getByRole("group", { name: "Your steps" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Start", exact: true }).click();

    // The focus page: his portrait and his first published card.
    await expect(page).toHaveURL(/\/focus\?goal=[^&]+&companion=snape$/);
    const focus = page.locator('main.focus-page[data-ready="true"]');
    await expect(focus).toBeVisible();
    await expect(focus.locator(".focus-avatar img")).toHaveAttribute(
      "src",
      "/companions/snape.png",
    );
    await expect(focus.getByTestId("story-card")).toContainText(newCardText(STORY, null, 1));
    await expect(focus.getByText("Not written yet").first()).toBeVisible();

    // Pause: his message, then one reply in the rest chat.
    await focus.getByRole("button", { name: "Pause" }).click();
    const rest = page.locator('main.rest-page[data-ready="true"]');
    await expect(rest).toBeVisible();
    await expect(rest.getByTestId("his-message").first()).toBeVisible({ timeout: 15_000 });
    await rest.getByLabel("Message").fill("How is it going?");
    await rest.getByRole("button", { name: "Send" }).click();
    await expect(rest.getByTestId("his-message")).toHaveCount(2, { timeout: 15_000 });

    // Back to the Step: the return pop-up.
    await rest.getByRole("button", { name: "Back to step" }).click();
    const popup = page.getByRole("dialog");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("I kept my notes in order", { timeout: 15_000 });
    await popup.getByRole("button", { name: "Start" }).click();
    await expect(popup).toHaveCount(0);

    // Both Steps done: the closing.
    const done = focus.getByRole("button", { name: "Done", exact: true });
    await done.click();
    await expect(focus.getByText(/^Step 2 of \d+$/)).toBeVisible();
    await page.waitForTimeout(1_400);
    await done.click();
    await expect(page).toHaveURL(/\/end\?session=/);
    const end = page.locator('main.end-page[data-ready="true"]');
    await expect(end.getByTestId("closing-line")).toContainText("I set the lamp down", {
      timeout: 15_000,
    });
    await expect(end.getByTestId("carry-line")).toContainText("I still do not know");
    // Next opens his own Life Path, where the next story is now current.
    await end.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/\/companions\/snape$/);
    await expect(page.locator('[data-state="current"]')).toContainText("Invented story 2");
  } finally {
    await post("/__story_cards", { restore: STORY });
  }
});
