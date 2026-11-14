import { expect, test } from "@playwright/test";
import { signIn } from "./support/account";

// The signed-in Goals area (#73, #77, #78, #39, #79, #80) against the test-only Supabase stub
// (e2e/support/stub-supabase.mjs). Prototype v4 phone size.

test.use({ viewport: { width: 390, height: 800 } });

const NOW = new Date().toISOString();

test("#73 a signed-in account opens /goals and sees its Goal titles", async ({
  context,
  page,
  baseURL,
}) => {
  await signIn(context, baseURL!, (userId) => ({
    goals: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: userId,
        title: "Methods section for Friday",
        text: "Methods section for Friday",
        status: "in_progress",
        kind: "one_time",
        created_at: NOW,
        updated_at: NOW,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: userId,
        title: "Lab report",
        text: "Lab report",
        status: "in_progress",
        kind: "one_time",
        created_at: NOW,
        updated_at: NOW,
      },
    ],
  }));
  await page.goto("/goals");
  await expect(page.getByText("Methods section for Friday")).toBeVisible();
  await expect(page.getByText("Lab report")).toBeVisible();
});
