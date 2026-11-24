import { expect, test } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import { promptMark, promptsSince } from "./support/stub-prompts";

// #256 with the limit switched off (the "mobile-live" server sets MODEL_CALL_LIMIT_ENABLED=0, the
// test-stage setting): a signed-in /goal keeps splitting past the 20 calls a browser used to get.

const SPLIT_PROMPT = "Return JSON only with a short title";
const CALLS = 22;

test("#256 /goal still splits after 20 model calls when the limit is off", async ({
  page,
  context,
}) => {
  await signIn(context, baseUrlOf(page));
  const goal = "Limit switch check goal 256";
  const mark = await promptMark(page.request);
  await page.goto("/goal");
  await expect(page.locator('main.try-dialogue[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Your goal").fill(goal);
  await page.getByRole("button", { name: "Just split it" }).click();
  await expect(page.getByRole("group", { name: "Your steps" })).toBeVisible();

  const splits = async () =>
    (await promptsSince(page.request, mark)).filter(
      (prompt) => prompt.startsWith(SPLIT_PROMPT) && prompt.includes(goal),
    ).length;
  await expect.poll(splits).toBe(1);

  for (let call = 2; call <= CALLS; call += 1) {
    await page.getByRole("button", { name: "Split again" }).click();
    await expect.poll(splits).toBe(call);
    await expect(page.getByRole("group", { name: "Your steps" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
});
