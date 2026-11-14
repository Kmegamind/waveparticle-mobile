import { expect, test, type Page } from "@playwright/test";
import { baseUrlOf, signIn } from "./support/account";
import { GOAL, sampleGoals } from "./support/goals-seed";
import { largeText, overflowReport } from "./support/large-text";

// #100: large text, narrow screens and short screens. The e2e app talks to the test-only Supabase
// stub, so the signed-in pages are checked with the prototype v4 sample Goals.

const NARROW = { width: 320, height: 640 };

type PlanStep = { title: string; description: string; minutes: number };

const twoSteps: PlanStep[] = [
  { title: "Outline the methods section", description: "List the sections.", minutes: 10 },
  { title: "Draft", description: "", minutes: 15 },
];

const fifteenSteps: PlanStep[] = Array.from({ length: 15 }, (_, index) => ({
  title: `Step number ${index + 1}`,
  description: "",
  minutes: 5,
}));

/** The /try Plan in this browser, as the goal dialogue's Start leaves it. */
async function seedPlan(page: Page, steps: PlanStep[]) {
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate((planSteps) => {
    window.localStorage.removeItem("waveparticle.prototype.session");
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Write the methods section for Friday", minutes: 30 },
        steps: planSteps,
        currentStep: 0,
      }),
    );
  }, steps);
}

async function expectNothingCutOff(page: Page, width: number) {
  await largeText(page);
  expect(await overflowReport(page)).toEqual([]);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

const signedInPages = [
  "/",
  "/goals",
  "/goals?tab=history",
  `/goals/${GOAL.methods}`,
  "/me",
  "/companions",
  "/companions/oppenheimer",
  "/goal",
];

for (const path of signedInPages) {
  test(`#100 AC1 and AC2 ${path} at 200% text on 320 px cuts nothing off`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(NARROW);
    await signIn(context, baseUrlOf(page), sampleGoals);
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    await expectNothingCutOff(page, NARROW.width);
  });
}

test("#100 AC1 at 200% text on 320 px the tab bar labels stay inside their own tab", async ({
  page,
  context,
}) => {
  await page.setViewportSize(NARROW);
  await signIn(context, baseUrlOf(page), sampleGoals);
  await page.goto("/");
  await largeText(page);
  const spill = await page.locator(".app-tab").evaluateAll((tabs) =>
    tabs.flatMap((tab) => {
      const cell = tab.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(tab);
      return Array.from(range.getClientRects())
        .filter((line) => line.left < cell.left - 1 || line.right > cell.right + 1)
        .map(() => tab.textContent);
    }),
  );
  expect(spill).toEqual([]);
});

for (const path of ["/try/goal", "/try/focus", "/try/rest"]) {
  test(`#100 AC1 and AC2 ${path} at 200% text on 320 px cuts nothing off`, async ({ page }) => {
    await page.setViewportSize(NARROW);
    await seedPlan(page, twoSteps);
    await page.goto(path);
    await expect(page.locator('[data-ready="true"]').first()).toBeVisible();
    await expectNothingCutOff(page, NARROW.width);
  });
}

test("#100 AC2 on the focus page with large text Done and Pause stack", async ({ page }) => {
  await page.setViewportSize(NARROW);
  await seedPlan(page, twoSteps);
  await page.goto("/try/focus");
  await largeText(page);
  const done = await page.getByRole("button", { name: "Done" }).boundingBox();
  const pause = await page.getByRole("button", { name: "Pause" }).boundingBox();
  expect(pause!.y).toBeGreaterThanOrEqual(done!.y + done!.height);
});

test("#100 AC2 at normal size Done and Pause sit side by side at about 62 to 38", async ({
  page,
}) => {
  await page.setViewportSize(NARROW);
  await seedPlan(page, twoSteps);
  await page.goto("/try/focus");
  const done = await page.getByRole("button", { name: "Done" }).boundingBox();
  const pause = await page.getByRole("button", { name: "Pause" }).boundingBox();
  expect(Math.abs(done!.y - pause!.y)).toBeLessThan(1);
  const share = done!.width / (done!.width + pause!.width);
  expect(share).toBeGreaterThan(0.6);
  expect(share).toBeLessThan(0.64);
});

test("finding: the Step ticks wrap with 15 Steps", async ({ page }) => {
  await page.setViewportSize(NARROW);
  await seedPlan(page, fifteenSteps);
  await page.goto("/try/focus");
  for (const scale of ["100%", "200%"]) {
    if (scale === "200%") await largeText(page);
    const rights = await page
      .locator(".focus-mark")
      .evaluateAll((marks) => marks.map((mark) => mark.getBoundingClientRect().right));
    expect(rights).toHaveLength(15);
    for (const right of rights) expect(right).toBeLessThanOrEqual(NARROW.width);
  }
});

test("finding: on a short landscape screen at 200% his card, Done and Pause can all be reached", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 320 });
  await seedPlan(page, twoSteps);
  await page.goto("/try/focus?speed=60");
  await largeText(page);
  expect(await overflowReport(page)).toEqual([]);
  const targets = [
    page.getByTestId("story-card").locator(".focus-card-text"),
    page.getByRole("button", { name: "Done", exact: true }),
    page.getByRole("button", { name: "Pause", exact: true }),
  ];
  for (const target of targets) {
    await target.evaluate((element) => element.scrollIntoView({ block: "start" }));
    // On screen (all of it, or half the screen for a card taller than that) and not covered by
    // anything: a tap in the middle of what shows reaches it.
    const reached = await target.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = Math.max(box.top, 0);
      const bottom = Math.min(box.bottom, window.innerHeight);
      const hit = document.elementFromPoint(box.x + box.width / 2, (top + bottom) / 2);
      return {
        shows: bottom - top >= Math.min(box.height, window.innerHeight / 2) - 1,
        hit: hit === element || element.contains(hit),
      };
    });
    expect(reached).toEqual({ shows: true, hit: true });
  }
});

/** Every element whose animation or transition still lasts longer than a hundredth of a second. */
async function movingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seconds = (value: string) =>
      Math.max(
        ...value.split(",").map((part) => {
          const number = parseFloat(part);
          return part.trim().endsWith("ms") ? number / 1000 : number;
        }),
      );
    const found: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        const animates = style.animationName !== "none" && seconds(style.animationDuration) > 0.01;
        const transitions =
          style.transitionProperty !== "none" && seconds(style.transitionDuration) > 0.01;
        if (animates || transitions) {
          found.push(`${element.tagName.toLowerCase()}.${element.className}${pseudo ?? ""}`);
        }
      }
    }
    return found;
  });
}

test("#100 AC4 with reduced motion nothing on the session pages animates or transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedPlan(page, twoSteps);
  for (const path of ["/try/goal", "/try/focus", "/try/rest"]) {
    await page.goto(path);
    await expect(page.locator('[data-ready="true"]').first()).toBeVisible();
    expect(await movingElements(page)).toEqual([]);
  }
});

test("#100 AC4 with reduced motion nothing on the signed-in pages animates or transitions", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(context, baseUrlOf(page), sampleGoals);
  for (const path of ["/", "/goals", `/goals/${GOAL.methods}`, "/me", "/companions"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await movingElements(page)).toEqual([]);
  }
  // An open sheet and its shade.
  await page.goto("/goals");
  await page.getByRole("button", { name: "New goal" }).first().click();
  expect(await movingElements(page)).toEqual([]);
});
