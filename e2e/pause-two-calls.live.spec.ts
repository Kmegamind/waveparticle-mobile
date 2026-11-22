import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { e2ePorts } from "./support/ports";

// #56 (US-AI-3, PAUSE-TWO-CALLS) with a model configured (the "mobile-live" project, stub model):
// R1 shows call one's stuck story first, then his message from call two, as in the merged
// prototype (wp-prototype_2026-11-12_v4_live-ai.html, R1). Set R1_SCREENSHOT to a file path to
// save the screen for the pull request.

const STUB = `http://127.0.0.1:${e2ePorts.stub}`;
const scene = JSON.parse(readFileSync("docs/demo/site-search.stage0.json", "utf8")).scene as {
  pauseProp: string;
  props: string[];
};

async function seed(page: Page) {
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
  await expect(page.getByTestId("story-card")).toBeVisible();
}

async function pauseAndWait(page: Page) {
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page).toHaveURL(/\/try\/rest/);
  await expect(page.getByTestId("his-message").first()).toBeVisible({ timeout: 15_000 });
}

test("#56 AC1 AC2 R1 shows the stuck story, then his words, a new prop on each Pause", async ({
  page,
  request,
}) => {
  await seed(page);
  await pauseAndWait(page);

  const story = page.getByTestId("his-stuck-story");
  const message = page.getByTestId("his-message").first();
  await expect(story).toContainText(scene.pauseProp);
  await expect(message).toHaveText("I cannot get on with it, and I feel restless.");
  // The stuck story comes first on the page, with the tape; his message follows it.
  const storyBox = (await story.boundingBox())!;
  const messageBox = (await message.boundingBox())!;
  expect(storyBox.y).toBeLessThan(messageBox.y);
  await expect(page.getByText(/Test data/)).toHaveCount(0);
  if (process.env.R1_SCREENSHOT) await page.screenshot({ path: process.env.R1_SCREENSHOT });

  // Both calls were made, with the pause number; call two carries call one's story.
  const prompts = (await (await request.get(`${STUB}/prompts`)).json()) as string[];
  const callOne = prompts.filter((prompt) => prompt.startsWith('Return JSON only: {"prop"'));
  const callTwo = prompts.filter((prompt) => prompt.startsWith("Write plain text only"));
  expect(callOne.at(-1)).toContain("Pause number: 1");
  expect(callTwo.at(-1)).toContain(await story.innerText());
  for (const prompt of [...callOne, ...callTwo]) expect(prompt).not.toContain("Outline");

  const first = await story.innerText();

  // The second Pause in the Step gets another prop and another category.
  await page.getByRole("button", { name: "Back to step" }).click();
  await expect(page).toHaveURL(/\/try\/focus/);
  await page.getByRole("dialog").getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pauseAndWait(page);
  const second = await page.getByTestId("his-stuck-story").innerText();
  expect(second).not.toContain(scene.pauseProp);
  expect(scene.props.some((prop) => second.includes(prop))).toBe(true);
  const after = (await (await request.get(`${STUB}/prompts`)).json()) as string[];
  const lastOne = after.filter((prompt) => prompt.startsWith('Return JSON only: {"prop"')).at(-1)!;
  expect(lastOne).toContain("Pause number: 2");
  // Fix round 1 (I4): the earlier stuck story comes from the browser, so it is only checked
  // against, never put into the prompt (#216).
  expect(lastOne).not.toContain(first);
});
