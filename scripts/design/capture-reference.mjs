#!/usr/bin/env node
// Capture reference screenshots of every prototype screen/state, so "does the app look like
// the prototype?" has a picture to compare against (docs/design/reference/*.png).
//
// Usage (run from a project that has @playwright/test installed):
//   node capture_reference.mjs reference-screens.json
//
// reference-screens.json:
// {
//   "url": "http://127.0.0.1:3200/mockup.html",      // serve the prototype: python3 -m http.server
//   "outDir": "docs/design/reference",
//   "viewport": { "width": 1000, "height": 1100 },   // the prototype's own page size
//   "clip": ".phone",                                  // element to screenshot (the phone frame)
//   "screens": [
//     { "name": "home" },
//     { "name": "stories", "steps": [{ "click": "button:visible:has-text('Stories')" }] },
//     { "name": "you",     "steps": [{ "click": "button:visible:has-text('You')" }] }
//   ]
// }
// Each screen starts from a fresh page load. Steps run in order: { "click": selector } or
// { "wait": ms } or { "eval": "js to run in the page" }.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");

const configPath = process.argv[2];
if (!configPath) {
  console.error("usage: capture_reference.mjs reference-screens.json");
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
fs.mkdirSync(cfg.outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: cfg.viewport || { width: 1000, height: 1100 },
  deviceScaleFactor: 2,
});
for (const screen of cfg.screens) {
  await page.goto(cfg.url);
  await page.waitForTimeout(300);
  for (const step of screen.steps || []) {
    if (step.click) await page.locator(step.click).first().click();
    if (step.eval) await page.evaluate(step.eval);
    await page.waitForTimeout(step.wait ?? 250);
  }
  const file = path.join(cfg.outDir, `${screen.name}.png`);
  const target = cfg.clip ? page.locator(cfg.clip).first() : page;
  await target.screenshot({ path: file });
  console.log("wrote", file);
}
await browser.close();
