import { expect, test, type Page } from "@playwright/test";
import { signIn, STUB_SUPABASE, stubTables } from "./support/account";

// #118 (US-SAF-5): help lines by region, against the Supabase stub (no live database). The S1
// states S1-0, S1-E and S1-N, S1 offline from the phone copy, the country picker (ME-REGION),
// the admin role check on ADM-14 and ADM-15, and the country in the data export.

const KEY = "waveparticle.helpLine";

/** The /safety test page: types a crisis message and sends it (the keyword layer, on the phone). */
async function openS1(page: Page) {
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Message").fill("I want to kill myself");
  await page.getByRole("button", { name: "Send" }).click();
  const crisis = page.locator("main.crisis-page");
  await expect(crisis.getByRole("heading", { name: "This is outside the story." })).toBeVisible();
  return crisis;
}

/** Waits until the shell has copied the account's help line to the phone. */
async function waitForCopy(page: Page, country: string | null) {
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as { country: string | null }).country : "none";
      }, KEY),
    )
    .toBe(country);
}

const profile = (country: string | null) => (userId: string) => ({
  profiles: [
    { user_id: userId, nickname: "Ada", keep_clock_running: false, help_country: country },
  ],
});

test("#118 AC2 S1-0: no country chosen shows the directory, the labelled US line and Choose your country", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile(null));
  await page.goto("/safety");
  await waitForCopy(page, null);
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis.getByText("If you are in the United States:")).toBeVisible();
  await expect(crisis).toContainText("If you are in the United States: call or text 988.");
  await expect(crisis.getByRole("link", { name: "Choose your country" })).toHaveAttribute(
    "href",
    "/me/country",
  );
  await expect(
    crisis.getByRole("link", { name: "Find A Helpline: findahelpline.com" }),
  ).toHaveAttribute("href", "https://findahelpline.com");
  await expect(crisis.getByRole("link", { name: "Get support now" })).toHaveAttribute(
    "href",
    "https://findahelpline.com",
  );
  // No unlabelled US entry, and still two buttons only.
  await expect(crisis).not.toContainText("Help in");
  await expect(crisis.locator(".button-filled, .button-tinted")).toHaveCount(2);
});

test("#118 AC1 S1-E: the chosen country's entry, call or text 988, with the directory link", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("US"));
  await page.goto("/safety");
  await waitForCopy(page, "US");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "entry");
  await expect(crisis.getByText("Help in United States")).toBeVisible();
  await expect(crisis.getByText("Call or text 988", { exact: true })).toBeVisible();
  await expect(crisis.getByRole("link", { name: "Text 988" })).toHaveAttribute("href", "sms:988");
  await expect(crisis.getByRole("link", { name: "Get support now" })).toHaveAttribute(
    "href",
    "tel:988",
  );
  await expect(
    crisis.getByRole("link", { name: "Find A Helpline: findahelpline.com" }),
  ).toBeVisible();
  await expect(crisis.getByRole("link", { name: "Choose your country" })).toHaveCount(0);
});

test("#118 AC3 S1-N: a chosen country with no entry opens the directory, with no US line", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("FR"));
  await page.goto("/safety");
  await waitForCopy(page, "FR");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "no-entry");
  await expect(crisis.getByText("No help line is listed for France yet.")).toBeVisible();
  await expect(
    crisis.getByText("If you are in immediate danger, contact your local emergency services."),
  ).toBeVisible();
  await expect(crisis).not.toContainText("988");
  await expect(crisis.getByRole("link", { name: "Get support now" })).toHaveAttribute(
    "href",
    "https://findahelpline.com",
  );
});

test("#118 S1 offline: the phone copy shows the entry; with no copy, S1-0 without Choose your country", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("US"));
  await page.goto("/safety");
  await waitForCopy(page, "US");
  await context.setOffline(true);
  let crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "entry");
  await expect(crisis.getByRole("link", { name: "Get support now" })).toHaveAttribute(
    "href",
    "tel:988",
  );

  // The copy cannot be read and nothing answers: the S1-0 content written in the code.
  await crisis.getByRole("button", { name: "Back to my Goal" }).click();
  await page.evaluate((key) => window.localStorage.setItem(key, "{broken"), KEY);
  crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis).toContainText("If you are in the United States: call or text 988.");
  await expect(crisis.getByRole("link", { name: "Choose your country" })).toHaveCount(0);
  await expect(
    crisis.getByRole("link", { name: "Find A Helpline: findahelpline.com" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("#118 ME-REGION: choosing a country saves it on the account and on the phone", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, profile(null));
  await page.goto("/me");
  const row = page.getByRole("link", { name: /Country/ });
  await expect(row).toContainText("Not chosen");
  await row.click();
  await expect(page).toHaveURL(/\/me\/country$/);
  await expect(page.getByRole("heading", { name: "Country", level: 1 })).toBeVisible();
  await expect(
    page.getByText("Used only to show help lines on the safety page. We never read your location."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "No country" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("Search countries").fill("fran");
  await expect(page.getByRole("button", { name: "Germany" })).toHaveCount(0);
  await page.getByRole("button", { name: "France", exact: true }).click();

  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("link", { name: /Country/ })).toContainText("France");
  expect((await stubTables(account)).profiles[0]).toMatchObject({ help_country: "FR" });
  await waitForCopy(page, "FR");

  await page.getByRole("link", { name: /Country/ }).click();
  await expect(page.getByRole("button", { name: "France", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "No country" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole("link", { name: /Country/ })).toContainText("Not chosen");
  expect((await stubTables(account)).profiles[0]).toMatchObject({ help_country: null });
  await waitForCopy(page, null);
});

test("#118 export: the chosen country is in the data export", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("FR"));
  await page.goto("/me");
  const answer = await page.request.get("/me/export/download");
  expect(answer.ok()).toBe(true);
  const file = (await answer.json()) as { profile: { help_country?: unknown } };
  expect(file.profile.help_country).toBe("FR");
});

test("#118 ADM-14 ADM-15: a writer reads the hotline list but cannot change it", async ({
  page,
  context,
  baseURL,
}) => {
  const writer = await signIn(context, baseURL!, () => ({}), { contentRole: "writer" });
  await page.goto("/admin/hotlines");
  await expect(page.getByRole("heading", { name: "Hotlines", level: 1 })).toBeVisible();
  const row = page.getByRole("row", { name: /United States/ });
  await expect(row).toContainText("None (optional)");
  await expect(row).toContainText("Call 988");
  await expect(row).toContainText("Published");
  await expect(page.getByRole("button", { name: "Add an entry" })).toHaveCount(0);

  await page.getByRole("link", { name: "United States" }).click();
  await expect(page).toHaveURL(/\/admin\/hotlines\/US$/);
  await expect(
    page.getByText("Read only: only an admin edits and publishes hotlines."),
  ).toBeVisible();
  await expect(page.getByLabel("Main contact number or https address")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  await expect(
    page.getByText(
      "A new or changed entry should be checked against the legal review (#121) before Publish.",
    ),
  ).toBeVisible();

  // The database refuses a writer too.
  const refused = await fetch(`${STUB_SUPABASE}/rest/v1/rpc/publish_hotline`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${writer.token}`,
    },
    body: JSON.stringify({ entry_country: "US", entry_version: 1 }),
  });
  expect(refused.status).toBe(403);
});

// #448: Add an entry now sits at the right end of the header row, like every admin page's actions,
// so this test opens the admin at a desktop width (the admin is desktop only, ADMIN-DESKTOP).
test.describe("#118 ADM-15 at a desktop width", () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

  test("#118 ADM-15: an admin saves a draft for a new country and publishes it, with a history row", async ({
    page,
    context,
    baseURL,
  }) => {
    await fetch(`${STUB_SUPABASE}/__hotlines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    try {
      await signIn(context, baseURL!, () => ({}), { contentRole: "admin" });
      await page.goto("/admin/hotlines");
      await page.getByLabel("Add an entry for a country with none").selectOption("NZ");
      await page.getByRole("button", { name: "Add an entry" }).click();
      await expect(page).toHaveURL(/\/admin\/hotlines\/NZ$/);
      await expect(page.getByText("Nothing is published for New Zealand")).toBeVisible();

      // A test-only web address (a reserved example domain), never a real help line.
      await page.getByLabel("Main contact: what Get support now opens").selectOption("web");
      await page.getByLabel("Main contact number or https address").fill("call us");
      await page.getByLabel("Checked by").fill("e2e test");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Not saved: fix the fields listed below.")).toBeVisible();

      await page
        .getByLabel("Main contact number or https address")
        .fill("https://example.org/help");
      await page.getByRole("button", { name: "Save draft" }).click();
      await expect(page.getByText("Draft v1 saved.")).toBeVisible();
      await page.getByRole("button", { name: "Publish v1" }).click();
      await expect(page.getByText("Published v1.")).toBeVisible();

      await page.goto("/admin/publish-history");
      const history = page.getByRole("row", { name: "NZ v1, Published" });
      await expect(history.getByRole("cell", { name: "Hotline · New Zealand NZ" })).toBeVisible();
    } finally {
      await fetch(`${STUB_SUPABASE}/__hotlines`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
    }
  });
});

// Review of #406, I-1 and I-2: the copy belongs to one account and never outlives it.

test("#118 I-1 Sign out removes the copy, so S1 on /safety is S1-0", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("FR"));
  await page.goto("/me");
  await waitForCopy(page, "FR");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await waitForCopy(page, "none");
  await page.goto("/safety");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis).not.toContainText("France");
});

test("#118 I-1 deleting the account removes the copy", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL!, profile("US"));
  await page.goto("/me/delete-account");
  await waitForCopy(page, "US");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?deleted=1$/);
  await waitForCopy(page, "none");
  await page.goto("/safety");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis).not.toContainText("Help in");
});

test("#118 I-1 an account switch drops the last account's copy", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("FR"));
  await page.goto("/safety");
  await waitForCopy(page, "FR");
  // Another person signs in on the same phone without a Sign out (the cookie is replaced).
  const second = await signIn(context, baseURL!, profile(null));
  await page.reload();
  await waitForCopy(page, null);
  const owner = await page.evaluate(
    (key) => (JSON.parse(window.localStorage.getItem(key) ?? "{}") as { userId?: string }).userId,
    KEY,
  );
  expect(owner).toBe(second.userId);
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis).not.toContainText("France");
});

test("#118 I-1 a session that ended on another device removes the copy on the next load", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, profile("US"));
  await page.goto("/safety");
  await waitForCopy(page, "US");
  await context.clearCookies();
  await page.reload();
  await waitForCopy(page, "none");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis.getByRole("link", { name: "Get support now" })).toHaveAttribute(
    "href",
    "https://findahelpline.com",
  );
});

test("#118 I-2 a failed profile read keeps the copy and shows an error on Me, never Not chosen", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, profile("US"));
  await page.goto("/me");
  await waitForCopy(page, "US");
  await fetch(`${STUB_SUPABASE}/__fail_reads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: account.token, tables: ["profiles"] }),
  });
  await page.reload();
  const row = page.getByRole("link", { name: /Country/ });
  await expect(row).toContainText("Couldn’t load. Try again.");
  await expect(row).not.toContainText("Not chosen");
  await expect(
    page.getByRole("alert").filter({ hasText: "Your country could not be read." }),
  ).toBeVisible();
  // The refresh failed too: the copy is still this account's US entry.
  await page.goto("/safety");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.waitForLoadState("networkidle");
  await waitForCopy(page, "US");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "entry");
  await fetch(`${STUB_SUPABASE}/__fail_reads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: account.token, tables: [] }),
  });
});

test("#118 M-1 a corrupt entry in the copy is S1-0, never S1-N", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, profile("US"));
  await page.goto("/safety");
  await waitForCopy(page, "US");
  await context.setOffline(true);
  await page.evaluate(
    ([key, userId]) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({
          userId,
          country: "US",
          entry: { country: "US", primary: { kind: "phone", value: "not a number" } },
        }),
      ),
    [KEY, account.userId],
  );
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
  await expect(crisis).not.toContainText("No help line is listed");
  await context.setOffline(false);
});

// Coordinator ruling on the refresh: only { signedIn: false }, a redirect to sign-in or another
// user clears the copy; a 5xx, a timeout, a network failure or a 200 that is not JSON keeps it.

async function copyOwner(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), KEY);
}

for (const [name, answer] of [
  ["a 5xx HTML page", { status: 503, contentType: "text/html", body: "<h1>Down</h1>" }],
  ["a 500 JSON error", { status: 500, contentType: "application/json", body: '{"error":"x"}' }],
  ["a 200 that is not JSON", { status: 200, contentType: "text/html", body: "<p>portal</p>" }],
] as const) {
  test(`#118 the refresh keeps the copy on ${name}`, async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, profile("US"));
    await page.goto("/me");
    await waitForCopy(page, "US");
    const before = await copyOwner(page);
    let answered = false;
    await page.route("**/me/help-line", async (route) => {
      answered = true;
      await route.fulfill(answer);
    });
    await page.reload();
    await expect.poll(() => answered).toBe(true);
    await page.waitForLoadState("networkidle");
    expect(await copyOwner(page)).toBe(before);
  });
}

test("#118 a redirect to the sign-in page clears the copy", async ({ page, context, baseURL }) => {
  await signIn(context, baseURL!, profile("US"));
  await page.goto("/safety");
  await waitForCopy(page, "US");
  // The session ends, and the refresh is sent to a signed-in page instead, which the app answers
  // with its real redirect to /auth/sign-in (Playwright cannot fulfil a redirect itself).
  await context.clearCookies();
  let rerouted = false;
  await page.route("**/me/help-line", async (route) => {
    rerouted = true;
    await route.continue({ url: new URL("/me/signals", baseURL!).toString() });
  });
  await page.reload();
  await expect.poll(() => rerouted).toBe(true);
  await waitForCopy(page, "none");
  const crisis = await openS1(page);
  await expect(crisis).toHaveAttribute("data-s1", "none");
});

test("#118 I-R1 an auth server outage keeps the copy (only a missing session signs out)", async ({
  page,
  context,
  baseURL,
}) => {
  const account = await signIn(context, baseURL!, profile("US"));
  await page.goto("/safety");
  await waitForCopy(page, "US");
  const fail = (tables: string[]) =>
    fetch(`${STUB_SUPABASE}/__fail_reads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: account.token, tables }),
    });
  await fail(["auth"]);
  try {
    const answer = page.waitForResponse("**/me/help-line");
    await page.reload();
    expect(await (await answer).json()).toEqual({ signedIn: true, ok: false });
    await page.waitForLoadState("networkidle");
    await waitForCopy(page, "US");
  } finally {
    await fail([]);
  }
});
