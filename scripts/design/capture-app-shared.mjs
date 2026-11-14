#!/usr/bin/env node
// Takes app screenshots at the prototype's phone size (390 by 800, device pixel ratio 2) in the
// light and dark system settings, for comparing shared styling with prototype version 4 (#240).
// Used again for #263 (the session screens). Usage: start the app with PROTOTYPE_ENABLED=1 (and
// placeholder Supabase values), then
//   node scripts/design/capture-app-shared.mjs <base url> <output folder> <label> [screens]
// Files are named <screen>-<scheme>-<label>.png. No model keys are needed: the test path then uses
// its labelled test data, and the safety page uses its local keyword check only.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [base = "http://localhost:3000", out = "shots", label = "app"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const settle = (page, ms = 700) => page.waitForTimeout(ms);
const hideDevBadge = (page) =>
  page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

async function goalDialogue(page, stage) {
  await page.goto(`${base}/try`);
  await settle(page);
  await page
    .getByRole("button", { name: "Reset test data" })
    .click()
    .catch(() => {});
  await settle(page, 300);
  await page.getByRole("link", { name: "Begin" }).click();
  await settle(page, 900);
  if (stage === "gd1") return;
  const goal = page.locator("form input").first();
  if (stage === "gd-f") {
    await goal.fill("Methods section for Friday [fail-split]");
    await page.getByRole("button", { name: "Just split it" }).click();
    await settle(page, 1500);
    return;
  }
  if (stage === "gd3-understood") {
    await goal.fill("Methods section for Friday, 60 minutes");
    await page.getByRole("button", { name: "Send" }).click();
    await settle(page, 1000);
    return;
  }
  await goal.fill("Methods section for Friday");
  await page.getByRole("button", { name: "Send" }).click();
  await settle(page, 1000);
  if (stage === "gd2") return;
  await page.getByRole("slider", { name: "Your time" }).fill("60");
  await page.getByRole("button", { name: "Send" }).click();
  await settle(page, 1000);
  if (stage === "gd3") return;
  await page.getByRole("button", { name: "Keep it broad" }).click();
  await settle(page, 1500);
  if (stage === "gd4") return;
  if (stage === "gd4-edit") {
    await page.locator(".try-step-button").first().click();
    await settle(page, 500);
    await page.locator(".try-step-editor").scrollIntoViewIfNeeded();
    return;
  }
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await settle(page, 1800);
  if (stage === "f1-you") {
    await page.getByRole("button", { name: /Your steps/i }).click();
    await settle(page, 500);
  }
}

const SCREENS = {
  "auth-in": (page) => page.goto(`${base}/auth/sign-in`),
  "auth-up": (page) => page.goto(`${base}/auth/sign-up`),
  s1: async (page) => {
    await page.goto(`${base}/safety`);
    await settle(page, 1000);
    await page.locator("textarea, input").first().fill("test input: suicide");
    await page.getByRole("button", { name: "Send" }).click();
  },
  cpage: (page) => page.goto(`${base}/try`),
  gd1: (page) => goalDialogue(page, "gd1"),
  gd2: (page) => goalDialogue(page, "gd2"),
  gd3: (page) => goalDialogue(page, "gd3"),
  gd4: (page) => goalDialogue(page, "gd4"),
  "gd4-edit": (page) => goalDialogue(page, "gd4-edit"),
  "gd3-understood": (page) => goalDialogue(page, "gd3-understood"),
  "gd-f": (page) => goalDialogue(page, "gd-f"),
  f1: (page) => goalDialogue(page, "f1"),
  "f1-you": (page) => goalDialogue(page, "f1-you"),
};

// Optional fourth argument: a comma-separated list of screens (default: all).
const only = process.argv[5] ? new Set(process.argv[5].split(",")) : null;

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  for (const [name, reach] of Object.entries(SCREENS)) {
    if (only && !only.has(name)) continue;
    const context = await browser.newContext({
      viewport: { width: 390, height: 800 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    try {
      await reach(page);
      await settle(page, 900);
      await page.evaluate(() => document.fonts.ready);
      await hideDevBadge(page);
      await settle(page, 300);
      await page.screenshot({ path: `${out}/${name}-${scheme}-${label}.png` });
      console.log(`ok ${name} ${scheme}`);
    } catch (error) {
      console.log(`failed ${name} ${scheme}: ${error.message.split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
