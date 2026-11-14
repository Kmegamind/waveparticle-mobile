#!/usr/bin/env node
// Puts the prototype picture, the app before and the app after side by side (issues #240, #263).
// A screen whose prototype state has no picture (null) gets a blank first column with a note.
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
  gd2: ["gd2", "gd2"],
  gd3: ["gd3", "gd3"],
  gd4: ["gd4", "gd4"],
  "gd4-edit": [null, null],
  "gd3-understood": [null, null],
  "gd-f": ["gd-f", "gd-f"],
  f1: ["f1", "f1"],
  "f1-you": ["f1-you", "f1-you"],
  // The Goals area (#73): the prototype has a day and a night picture of each.
  g1: ["g1-day", "g1-night"],
  g3: ["g3-day", "g3-night"],
  g4: ["g4-day", "g4-night"],
  "g4-n": ["g4-n-day", "g4-n-night"],
  "g4-h": ["g4-h-day", "g4-h-night"],
  g5: ["g5-day", "g5-night"],
  "g5-d": ["g5-d-day", "g5-d-night"],
  g6: ["g6-day", "g6-night"],
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
      proto
        ? [`Prototype v4 (${proto})`, path.join(reference, `${proto}.png`)]
        : ["Prototype v4: no picture of this state", null],
      ["App before (main)", path.join(folder, `${screen}-${scheme}-before.png`)],
      ["App after (this pull request)", path.join(folder, `${screen}-${scheme}-after.png`)],
    ];
    if (!files.every(([, file]) => file === null || existsSync(file))) continue;
    const cells = files
      .map(
        ([label, file]) =>
          `<figure><figcaption>${label}</figcaption>${
            file ? `<img src="${dataUrl(file)}">` : '<div class="none"></div>'
          }</figure>`,
      )
      .join("");
    await page.setContent(
      `<style>body{margin:0;background:#fff;font:600 16px system-ui;display:flex;gap:15px;padding:15px}
       figure{margin:0;width:390px}img{width:390px;height:800px;object-fit:cover;object-position:top;border:1px solid #999}
       figcaption{margin-bottom:6px}.none{width:390px;height:800px;border:1px dashed #999}</style>${cells}`,
    );
    await page.screenshot({
      path: path.join(folder, `compare-${screen}-${scheme}.png`),
      fullPage: true,
    });
    console.log(`compare-${screen}-${scheme}.png`);
  }
}
await browser.close();
