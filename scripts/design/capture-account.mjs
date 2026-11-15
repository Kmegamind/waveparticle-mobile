#!/usr/bin/env node
// Screenshots of the account and privacy pages (#103, #102, #104) at the prototype's phone size
// (390 by 800, device pixel ratio 2), light and dark, for comparing with prototype v4.
// Needs the test-only Supabase stub (node e2e/support/stub-supabase.mjs, port 3198) and an app built
// and started with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3198.
// Usage: node scripts/design/capture-account.mjs <base url> <output folder> <label>
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [base = "http://127.0.0.1:3200", out = "shots", label = "after"] = process.argv.slice(2);
const STUB = "http://127.0.0.1:3198";
mkdirSync(out, { recursive: true });

async function signIn(context) {
  const token = `stub-${randomUUID()}`;
  const userId = randomUUID();
  await fetch(`${STUB}/__seed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token,
      user: { id: userId, email: "reviewer@example.test" },
      tables: { profiles: [{ user_id: userId, nickname: "Yue", keep_clock_running: false }] },
    }),
  });
  const session = {
    access_token: token,
    refresh_token: "stub-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, aud: "authenticated", role: "authenticated" },
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      url: base,
    },
  ]);
}

const SCREENS = {
  me: async (page) => {
    await page.goto(`${base}/me`);
    await page.getByRole("link", { name: "Data" }).scrollIntoViewIfNeeded();
  },
  data: (page) => page.goto(`${base}/me/data`),
  about: (page) => page.goto(`${base}/me/about`),
  privacy: (page) => page.goto(`${base}/privacy?from=me`),
  terms: (page) => page.goto(`${base}/terms`),
  export: (page) => page.goto(`${base}/me/export`),
  "account-delete": (page) => page.goto(`${base}/me/delete-account`),
};

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  for (const [name, reach] of Object.entries(SCREENS)) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 800 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    try {
      await signIn(context);
      await reach(page);
      await page.waitForTimeout(900);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: `${out}/${name}-${scheme}-${label}.png` });
      console.log(`ok ${name} ${scheme}`);
    } catch (error) {
      console.log(`failed ${name} ${scheme}: ${error.message.split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
