import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import stories from "../src/content/oppenheimer/stories.json";
import { e2ePorts } from "./support/ports";

// #254 AC3, AC4 and AC8 with a model configured (the "mobile-live" project): the app's
// MODEL_API_URL points at the test-only stub model (e2e/support/stub-model.mjs).

const STUB = `http://127.0.0.1:${e2ePorts.stub}`;
const bohr = stories.find((story) => story.id === "bohr-difficulties")!;
const stage0 = JSON.parse(readFileSync("docs/demo/bohr-difficulties.stage0.json", "utf8"));
const cache = JSON.parse(readFileSync("docs/demo/bohr-difficulties.generated.json", "utf8"));

/** Every stored line of his for this story: the demo cache, authored cards and example lines. */
function storedLines(): string[] {
  const lines: string[] = [];
  for (const step of cache.steps ?? []) for (const card of step.cards ?? []) lines.push(card.text);
  for (const card of stage0.authoredCards ?? [])
    lines.push(typeof card === "string" ? card : card.text);
  for (const [kind, value] of Object.entries(stage0.examples ?? {})) {
    for (const item of value as unknown[]) {
      lines.push(kind === "chat" ? (item as { reply: string }).reply : String(item));
    }
  }
  return lines.filter((line) => typeof line === "string" && line.split(/\s+/).length >= 4);
}

test("#254 AC8 bohr-difficulties: start, the first card is generated, one Step is finished", async ({
  page,
  request,
}) => {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Reset test data" }).click();

  // AC3: the chapter's goal sentence and Who I am come from its own data.
  await page.getByLabel("Chapter").selectOption({ label: bohr.title });
  await expect(page.getByText(stage0.story.goalShort)).toBeVisible();
  await page.getByText("Who I am").click();
  await expect(page.getByText(stage0.who)).toBeVisible();

  await page.getByRole("link", { name: "Begin" }).click();
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
  // AC3: the goal dialogue opens with this story's own opening.
  await expect(page.locator(".try-slip").first()).toContainText(stage0.whereNow.s1);

  await page.getByLabel("Your goal").fill("Read the paper on scattering");
  await page.getByRole("button", { name: "Just split it" }).click();
  await expect(page.getByRole("group", { name: "Your steps" })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/try\/focus/);
  const focus = page.locator('main.focus-page[data-ready="true"]');
  await expect(focus).toBeVisible();

  // The first card is generated (by the stub), not test data, and "My goal" is this story's.
  const slip = focus.getByTestId("story-card");
  await expect(slip).toContainText("I move the pencil beside my cup.");
  await expect(focus.getByText(/Test data/)).toHaveCount(0);
  await expect(focus.getByText(stage0.story.goalShort)).toBeVisible();

  // AC1: the card prompt was built from this story's inputs and facts, nothing from chapter 8.
  const prompts = (await (await request.get(`${STUB}/prompts`)).json()) as string[];
  const cardPrompts = prompts.filter(
    (prompt) => prompt.startsWith('Return JSON only: {"cards"') && prompt.includes(stage0.who),
  );
  expect(cardPrompts.length).toBeGreaterThan(0);
  expect(cardPrompts.some((prompt) => prompt.includes(bohr.facts[0].text))).toBe(true);
  for (const prompt of cardPrompts) expect(prompt).not.toContain("Jemez");

  // AC4: no stored line of his reaches the page.
  const shown = await focus.innerText();
  for (const line of storedLines()) expect(shown, line).not.toContain(line);

  // Finish one Step.
  await expect(focus.getByText("Step 1 of 2", { exact: true })).toBeVisible();
  await focus.getByRole("button", { name: "Done", exact: true }).click();
  await expect(focus.getByText("Step 2 of 2", { exact: true })).toBeVisible({ timeout: 10_000 });
});
