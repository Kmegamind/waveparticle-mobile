#!/usr/bin/env node
// Reads computed design values from prototype version 4 in a real browser (no values are typed by hand).
// Usage: serve docs/design/prototype as UTF-8 on port 3200, then
//   node scripts/design/probe-prototype-v4.mjs > docs/design/prototype/prototype-v4-computed.json
// The prototype has no charset meta tag, so the server must send "text/html; charset=utf-8".
import { chromium } from "@playwright/test";

const URL =
  process.env.PROTO_URL || "http://127.0.0.1:3200/wp-prototype_2026-11-12_v4_live-ai.html";
const jump = (id) => {
  const a = document.createElement("a");
  a.dataset.jump = id;
  document.body.append(a);
  a.click();
  a.remove();
};
const act = (v) => {
  const b = document.createElement("button");
  b.dataset.a = v;
  document.body.append(b);
  b.click();
  b.remove();
};

const SKINS = [
  { skin: "day", screen: "HOME-1" },
  { skin: "night", screen: "HOME-1", night: true },
  { skin: "opp", screen: "F1" },
];
// [component name, screen id, selector, night?]; "selector|text" picks the element whose text matches
const COMPONENTS = [
  ["phone frame", "HOME-1", "#phone"],
  ["primary button (paper tag)", "HOME-1", "#phone button.btn:not(.s):not(.ghost):not(.send)"],
  ["primary button (paper tag), Oppenheimer skin", "F1", "#phone .btns button.btn:not(.s)"],
  ["secondary button", "F1", "#phone .btns button.btn.s"],
  ["sheet button (secondary)", "HOME-MENU", "#phone .sheet button.btn.s"],
  ["ghost button", "HOME-MENU", "#phone .sheet button.btn.ghost"],
  ["send button", "R1-C", "#phone button.btn.send"],
  ["small button", "G3", "#phone button.btn.s.sm"],
  ["card menu trigger", "HOME-1", "#phone section.card .row.sp button.link"],
  ["text link", "HOME-1", "#phone button.link|Start something else"],
  ["overline label", "HOME-1", "#phone section.card .over"],
  ["display title", "ME", "#phone h1.display"],
  ["card title", "HOME-1", "#phone h2.title"],
  ["card", "HOME-1", "#phone section.card"],
  ["slip (his words)", "HOME-1", "#phone .note.m"],
  ["focus card stack slip", "F1", "#phone .note.cslip"],
  ["focus card stack frame", "F1", "#phone .crd"],
  ["timer", "F1", "#phone .timer"],
  ["my goal row", "F1", "#phone .mygoal"],
  ["your Steps panel", "F1", "#phone section.pn.you"],
  ["avatar", "HOME-1", "#phone span.av"],
  ["large avatar", "ME", "#phone span.av.l"],
  ["text field", "GD4", "#phone input.field"],
  ["chat composer field", "R1-C", "#phone .composer input.field"],
  ["his chat message", "R1-C", "#phone .thread .note.him"],
  ["my chat message", "R1-C", "#phone .thread .me"],
  ["plan step row", "GD4", "#phone button.step"],
  ["tab bar", "HOME-1", "#phone nav.tabbar"],
  ["tab bar item", "HOME-1", "#phone nav.tabbar button"],
  ["sheet", "HOME-MENU", "#phone .sheet"],
  ["sheet shade", "HOME-MENU", "#phone .shade"],
  ["settings row", "ME", "#phone div.setrow"],
  ["segmented control", "ME", "#phone .seg-in"],
  ["segmented control, selected", "ME", "#phone .seg-in button[aria-pressed=true]"],
  ["Goals tabs item", "G3", "#phone .tabs button"],
  ["toast", "END", "#phone .toast"],
  ["Life Path finished row", "CPAGE", "#phone .lpr.mem"],
  ["Life Path current card", "CPAGE", "#phone .lp .card"],
  ["Life Path later row", "CPAGE", "#phone .lpr.ah"],
  ["Life Path period heading", "CPAGE", "#phone .era"],
  ["summary closing slip", "END", "#phone .note.l"],
];
const PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-decoration-line",
  "color",
  "background-color",
  "background-image",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-bottom-width",
  "border-bottom-color",
  "border-radius",
  "padding",
  "min-height",
  "height",
  "width",
  "box-shadow",
  "transform",
  "opacity",
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
});
await page.goto(URL);
await page.waitForTimeout(1500); // web fonts
const goto = async (id, night) => {
  await page.evaluate(jump, id);
  await page.waitForTimeout(500);
  if (night) {
    await page.evaluate(act, "theme:night");
    await page.waitForTimeout(300);
  }
};
const out = { source: URL, measuredAt: new Date().toISOString(), skins: {}, components: {} };
for (const s of SKINS) {
  await goto(s.screen, s.night);
  out.skins[s.skin] = await page.evaluate(() => {
    const names = new Set();
    const walk = (rules) => {
      for (const r of rules) {
        if (r.style) for (const n of r.style) if (n.startsWith("--")) names.add(n);
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sh of document.styleSheets) {
      try {
        walk(sh.cssRules);
      } catch {}
    }
    const el = document.querySelector("#phone");
    const cs = getComputedStyle(el);
    const t = {};
    for (const n of [...names].sort()) {
      if (n.startsWith("--pg-")) continue;
      const v = cs.getPropertyValue(n).trim();
      if (v) t[n] = v;
    }
    return { phoneClass: el.className, tokens: t };
  });
}
for (const [name, screen, sel, night] of COMPONENTS) {
  await goto(screen, night);
  out.components[name] = await page.evaluate(
    ([sel, PROPS]) => {
      const [css, text] = sel.split("|");
      const el = text
        ? [...document.querySelectorAll(css)].find((e) => e.textContent.trim() === text)
        : document.querySelector(css);
      if (!el) return { screen: null, missing: sel };
      const pick = (cs) => Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
      const r = { selector: sel, ...pick(getComputedStyle(el)) };
      for (const pseudo of ["::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.content && cs.content !== "none") r[pseudo] = pick(cs);
      }
      return r;
    },
    [sel, PROPS],
  );
  out.components[name].screen = screen;
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
