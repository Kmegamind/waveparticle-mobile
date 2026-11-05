// Builds docs/demo/index.html (one self-contained page) from the generated demo content.
// Usage: node scripts/build-demo-page.mjs
import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(
  await readFile(new URL("../docs/demo/site-search.generated.json", import.meta.url), "utf8"),
);
const json = JSON.stringify(data).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Story Card Demo</title>
<style>
  :root { --bg:#f5f5f7; --card:#fff; --ink:#1d1d1f; --muted:#6e6e73; --line:#d2d2d7; --accent:#0071e3; --him:#e9e9ee; --you:#0071e3; --youink:#fff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#000; --card:#1c1c1e; --ink:#f5f5f7; --muted:#a1a1a6; --line:#3a3a3c; --accent:#2997ff; --him:#2c2c2e; --you:#0a84ff; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; }
  main { max-width:440px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin:32px 0 8px; font-weight:600; }
  .sub { color:var(--muted); font-size:14px; margin:0 0 12px; }
  .note { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 14px; font-size:13px; color:var(--muted); }
  .goal { background:var(--card); border-radius:16px; padding:14px 16px; margin-top:16px; }
  .goal b { display:block; font-size:12px; color:var(--muted); font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
  .row { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:4px; scrollbar-width:none; }
  .row::-webkit-scrollbar { display:none; }
  .card { flex:0 0 88%; scroll-snap-align:center; background:var(--card); border-radius:18px; padding:18px 18px 20px; min-height:140px; }
  .card p { margin:0; font-size:17px; line-height:1.45; }
  .tag { font-size:11px; color:var(--muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:.05em; }
  .dots { display:flex; gap:6px; justify-content:center; margin-top:10px; }
  .dot { width:7px; height:7px; border-radius:50%; background:var(--line); }
  .dot[aria-current="true"] { background:var(--ink); }
  .chat { display:flex; flex-direction:column; gap:8px; background:var(--card); border-radius:18px; padding:16px; }
  .msg { max-width:86%; padding:10px 14px; border-radius:18px; font-size:15px; line-height:1.4; }
  .him { background:var(--him); align-self:flex-start; border-bottom-left-radius:6px; }
  .you { background:var(--you); color:var(--youink); align-self:flex-end; border-bottom-right-radius:6px; }
  .scope { font-size:11px; color:var(--muted); margin:-4px 0 4px 6px; }
  .who { font-size:12px; color:var(--muted); margin:6px 2px 0; }
  .stats { font-size:12px; color:var(--muted); margin-top:28px; }
</style>
</head>
<body>
<main>
  <h1 id="title"></h1>
  <p class="sub" id="date"></p>
  <p class="note">Wireframe-stage demo. The text was written by <span id="model"></span> from the story database and a draft of our prompts. It is an example of the output, not final content, and was not reviewed by a content owner.</p>
  <div class="goal"><b>His goal</b><span id="goal"></span></div>
  <div id="steps"></div>
  <h2 id="pause-h"></h2>
  <div class="chat" id="chat" aria-label="Pause conversation"></div>
  <p class="stats" id="stats"></p>
</main>
<script type="application/json" id="data">${json}</script>
<script>
  const d = JSON.parse(document.getElementById("data").textContent);
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  $("title").textContent = d.meta.story.title;
  $("date").textContent = d.meta.story.date;
  $("model").textContent = d.meta.model;
  $("goal").textContent = d.meta.story.goal;
  const KIND = { opening: "Opening", landing: "Step started", state: "Later in the step", back: "Back from the pause" };
  for (const step of d.steps) {
    $("steps").append(el("h2", "", "Step " + step.n + " of " + d.steps.length + " \\u00b7 " + step.title));
    $("steps").append(el("p", "sub", "Your side: " + step.intent));
    const row = el("div", "row"); row.tabIndex = 0; row.setAttribute("aria-label", "Story cards for step " + step.n);
    const cards = [...step.cards];
    if (step.n === d.meta.pauseAtStep) cards.push(d.pause.back);
    const dots = el("div", "dots");
    cards.forEach((c, i) => {
      const card = el("div", "card"); card.append(el("div", "tag", KIND[c.kind] || c.kind), el("p", "", c.text)); row.append(card);
      const dot = el("span", "dot"); dot.setAttribute("aria-current", i === 0 ? "true" : "false"); dots.append(dot);
    });
    row.addEventListener("scroll", () => {
      const i = Math.round(row.scrollLeft / (row.firstChild.offsetWidth + 12));
      [...dots.children].forEach((x, j) => x.setAttribute("aria-current", j === i ? "true" : "false"));
    });
    $("steps").append(row, dots);
  }
  $("pause-h").textContent = "Pause during step " + d.meta.pauseAtStep;
  const chat = $("chat");
  chat.append(el("div", "who", "He writes first"), el("div", "msg him", d.pause.stuck.text));
  for (const t of d.pause.chat) {
    chat.append(el("div", "msg you", t.user));
    chat.append(el("div", "scope", "scope: " + t.reply.scope));
    chat.append(el("div", "msg him", t.reply.reply));
  }
  const u = d.meta.usage;
  $("stats").textContent = u.calls + " model calls, about $" + u.costUsd + ". Generated " + d.meta.generatedAt.slice(0, 10) + ".";
</script>
</body>
</html>
`;
await writeFile(new URL("../docs/demo/index.html", import.meta.url), html);
console.log("wrote docs/demo/index.html");
