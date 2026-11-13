import { expect, test } from "@playwright/test";

// #43 and #216 on the test focus page. The e2e server has no model keys, so the cards are the
// labelled test data, but the page sends the same request it sends when the model is set.

const steps = [
  { title: "Draft the secret methods section", description: "Only mine.", minutes: 10 },
  { title: "Check the private appendix", description: "", minutes: 15 },
];

test("#216 the card requests carry no Step title; #43 the next Step's cards are asked for ahead of time", async ({
  page,
}) => {
  const bodies: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/try/focus") {
      bodies.push(request.postData() ?? "");
    }
  });
  await page.goto("/try");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.evaluate((planSteps) => {
    window.localStorage.removeItem("waveparticle.prototype.session");
    window.localStorage.setItem(
      "waveparticle.prototype",
      JSON.stringify({
        version: 1,
        goal: { text: "Write the report", minutes: 25 },
        steps: planSteps,
        currentStep: 0,
      }),
    );
  }, steps);
  await page.goto("/try/focus?speed=60");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByTestId("story-card")).toBeVisible();

  // The second Step's cards are requested while Step 1 is still running (NO-BACKUP).
  await expect
    .poll(() => bodies.filter((body) => body.includes('"index":1')).length)
    .toBeGreaterThan(0);
  await expect(page.getByText("Step 1 of 2", { exact: true })).toBeVisible();

  const cardRequests = bodies.filter((body) => body.includes('"planMinutes"'));
  expect(cardRequests.length).toBeGreaterThanOrEqual(2);
  for (const body of bodies) {
    expect(body).not.toContain("secret methods");
    expect(body).not.toContain("private appendix");
    expect(body).not.toContain("Write the report");
  }
  // CARD-NEW: the request for Step 2 carries the cards already shown in Step 1.
  const next = cardRequests.find((body) => body.includes('"index":1'))!;
  expect(next).toMatch(/"earlierCards":\["[^"]/);
});
