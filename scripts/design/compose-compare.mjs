#!/usr/bin/env node
// Puts the prototype picture, the app before and the app after side by side (issue #240).
// Usage: node scripts/design/compose-compare.mjs <folder with <screen>-<scheme>-before/after.png>
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const folder = process.argv[2] ?? "docs/design/prototype/pr-240";
const reference = "docs/design/prototype/reference-screenshots";
// App screen → prototype picture for the light (day) and dark (night) setting.
const PROTOTYPE = {
  "auth-in": ["auth-in-day", "auth-in-night"],
  "auth-up": ["auth-up-day", "auth-up-night"],
  s1: ["s1", "s1"],
  cpage: ["cpage-day", "cpage-night"],
  gd1: ["gd1", "gd1"],
  gd4: ["gd4", "gd4"],
  f1: ["f1", "f1"],
};
const dataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1230, height: 900 } });
for (const [screen, [day, night]] of Object.entries(PROTOTYPE)) {
  for (const [scheme, proto] of [
    ["light", day],
    ["dark", night],
  ]) {
    const files = [
      [`Prototype v4 (${proto})`, path.join(reference, `${proto}.png`)],
      ["App before (main)", path.join(folder, `${screen}-${scheme}-before.png`)],
      ["App after (this pull request)", path.join(folder, `${screen}-${scheme}-after.png`)],
    ];
    if (!files.every(([, file]) => existsSync(file))) continue;
    const cells = files
      .map(
        ([label, file]) =>
          `<figure><figcaption>${label}</figcaption><img src="${dataUrl(file)}"></figure>`,
      )
      .join("");
    await page.setContent(
      `<style>body{margin:0;background:#fff;font:600 16px system-ui;display:flex;gap:15px;padding:15px}
       figure{margin:0;width:390px}img{width:390px;height:800px;object-fit:cover;object-position:top;border:1px solid #999}
       figcaption{margin-bottom:6px}</style>${cells}`,
    );
    await page.screenshot({
      path: path.join(folder, `compare-${screen}-${scheme}.png`),
      fullPage: true,
    });
    console.log(`compare-${screen}-${scheme}.png`);
  }
}
await browser.close();
