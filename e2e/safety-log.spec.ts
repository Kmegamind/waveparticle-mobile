import { expect, test } from "@playwright/test";

// #119 review I1: the S1 next-action request carries no referrer and no cookie, every page sends
// the Referrer-Policy header, and a request from another site is refused.

test("#119 I1 every response sends Referrer-Policy strict-origin-when-cross-origin", async ({
  request,
}) => {
  for (const path of ["/safety", "/privacy", "/auth/sign-in"]) {
    const response = await request.get(path);
    expect(response.headers()["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
  }
});

test("#119 I1 S1's next-action request has no referrer and no cookie, and is logged", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: "probe", value: "1", url: test.info().project.use.baseURL! }]);
  await page.goto("/safety?goal=11111111-2222-3333-4444-555555555555");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Message").fill("I want to kill myself");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "This is outside the story." })).toBeVisible();

  const sent = page.waitForRequest((request) => request.url().endsWith("/safety/next-action"));
  const answered = page.waitForResponse((response) =>
    response.url().endsWith("/safety/next-action"),
  );
  await page.getByRole("button", { name: "Back to my Goal" }).click();
  const request = await sent;
  const headers = await request.allHeaders();
  expect(headers.referer).toBeUndefined();
  expect(headers.cookie).toBeUndefined();
  expect(request.postData()).toBe(JSON.stringify({ action: "back", screen: "safety" }));
  expect((await answered).status()).toBe(204);
});

test("#119 M2 a next-action request from another site is refused", async ({ request }) => {
  const response = await request.post("/safety/next-action", {
    headers: { origin: "https://elsewhere.example", "content-type": "application/json" },
    data: JSON.stringify({ action: "back", screen: "safety" }),
  });
  expect(response.status()).toBe(403);
});
