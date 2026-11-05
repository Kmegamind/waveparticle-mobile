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
  :root { --bg:#f5f5f7; --card:#fff; --ink:#1d1d1f; --muted:#6e6e73; --line:#d2d2d7; --accent:#0071e3; --him:#e9e9ee; --you:#0071e3; --youink:#fff; --ok:#1a7f37; --warn:#b35900; }
  @media (prefers-color-scheme: dark) { :root { --bg:#000; --card:#1c1c1e; --ink:#f5f5f7; --muted:#a1a1a6; --line:#3a3a3c; --accent:#2997ff; --him:#2c2c2e; --you:#0a84ff; --ok:#30d158; --warn:#ff9f0a; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; }
  main { max-width:460px; margin:0 auto; padding:24px 16px 72px; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin:36px 0 8px; font-weight:600; }
  .sub { color:var(--muted); font-size:14px; margin:0 0 10px; }
  .box { background:var(--card); border-radius:16px; padding:14px 16px; margin-top:12px; }
  .note { border:1px solid var(--line); border-radius:12px; padding:12px 14px; font-size:13px; color:var(--muted); background:var(--card); }
  .box b.lbl { display:block; font-size:12px; color:var(--muted); font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
  .stages { display:grid; gap:8px; margin:12px 0 0; padding:0; list-style:none; }
  .stages li { background:var(--card); border-radius:14px; padding:10px 14px; font-size:14px; }
  .stages b { display:block; font-size:12px; color:var(--accent); letter-spacing:.04em; text-transform:uppercase; }
  .toggle { display:flex; align-items:center; gap:10px; font-size:14px; margin:16px 0 0; }
  .toggle input { width:20px; height:20px; accent-color:var(--accent); }
  .row { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:4px; scrollbar-width:none; }
  .row::-webkit-scrollbar { display:none; }
  .card { flex:0 0 88%; scroll-snap-align:center; background:var(--card); border-radius:18px; padding:16px 18px 18px; min-height:150px; }
  .card p { margin:0; font-size:17px; line-height:1.45; }
  .tag { display:flex; justify-content:space-between; gap:8px; font-size:11px; color:var(--muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:.05em; }
  .ok { color:var(--ok); } .warn { color:var(--warn); }
  .dots { display:flex; gap:6px; justify-content:center; margin-top:10px; }
  .dot { width:7px; height:7px; border-radius:50%; background:var(--line); }
  .dot[aria-current="true"] { background:var(--ink); }
  .chat { display:flex; flex-direction:column; gap:6px; background:var(--card); border-radius:18px; padding:16px; }
  .msg { max-width:88%; padding:10px 14px; border-radius:18px; font-size:15px; line-height:1.4; }
  .msg em { color:var(--muted); font-style:italic; display:block; margin-bottom:2px; }
  .him { background:var(--him); align-self:flex-start; border-bottom-left-radius:6px; }
  .you { background:var(--you); color:var(--youink); align-self:flex-end; border-bottom-right-radius:6px; }
  .meta { font-size:11px; color:var(--muted); margin:0 0 6px 6px; }
  details { font-size:13px; color:var(--muted); margin:2px 0 6px 6px; }
  details pre { white-space:pre-wrap; font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; background:var(--bg); border-radius:10px; padding:10px; color:var(--ink); max-height:320px; overflow:auto; }
  details .alt { margin:6px 0; color:var(--ink); }
  .two { display:grid; gap:10px; }
  .stats { font-size:12px; color:var(--muted); margin-top:28px; }
</style>
</head>
<body>
<main>
  <h1 id="title"></h1>
  <p class="sub" id="date"></p>
  <p class="note">Wireframe-stage demo. The text was written by <span id="model"></span> from the story database, the scene data and a draft of our prompts. It shows the shape of the output, is not final content, and was not reviewed by a content owner. Where there are several tries, the page shows the best one.</p>
  <div class="box"><b class="lbl">His goal</b><span id="goal"></span></div>

  <h2>How it is made</h2>
  <ol class="stages" id="stages"></ol>
  <label class="toggle"><input type="checkbox" id="authored"> Show the hand-written draft instead (where one exists)</label>

  <div id="steps"></div>

  <h2 id="pause-h"></h2>
  <div class="chat" id="chat" aria-label="Pause conversation"></div>

  <h2>When the story ends</h2>
  <p class="sub">The same moment, told after a smooth run and after a rough one. A second model call turns what happened into how he feels.</p>
  <div class="two" id="closing"></div>

  <p class="stats" id="stats"></p>
</main>
<script type="application/json" id="data">${json}</script>
<script>
  const d = JSON.parse(document.getElementById("data").textContent);
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  $("title").textContent = d.meta.story.title;
  $("date").textContent = d.meta.story.date + " \\u00b7 " + d.meta.story.place;
  $("model").textContent = d.meta.model;
  $("goal").textContent = d.meta.story.goalFull;

  const stages = [
    ["Stage 0 \\u00b7 Prepared", "The story's facts cut into 8 moments, who is present, what he can see, and 8 small actions. Drafted from the story database and the hand-written scene notes; not yet read by a content owner."],
    ["Stage 1 \\u00b7 Story", "The model writes the cards for each Step from the facts that have already happened: the background card (once, in his voice), what he just finished, why it is hard, what is in front of him."],
    ["Stage 2 \\u00b7 Feeling", "A second call reads the story the first call wrote and says how it feels to him. It does not repeat the story."],
    ["Stage 3 \\u00b7 Pause", "One small snag is built around an object the code picks. In chat, a third call answers in his voice: an opening action, then one to three sentences, in the mood of the moment."],
    ["Stage 4 \\u00b7 Ending", "The run log goes back to the model once more, and he says how he feels, smooth or rough."]
  ];
  for (const [h, t] of stages) { const li = el("li"); li.append(el("b", "", h), document.createTextNode(t)); $("stages").append(li); }
  const promptKeys = [["background", "Background card prompt"], ["story_step2", "Story cards prompt (Step 2)"], ["feeling_step2", "Feeling prompt (Step 2)"], ["chat", "Chat prompt (turn 3)"], ["closing", "Closing prompt (rough)"]];
  for (const [k, label] of promptKeys) {
    if (!d.prompts[k]) continue;
    const det = el("details"); det.append(el("summary", "", label), el("pre", "", d.prompts[k])); $("stages").after(det);
  }

  const KIND = { opening: "Background card \\u00b7 shown once, first", landing: "What he just finished", why: "Why it is hard", now: "In front of him", feeling: "How it feels", back: "Back from the pause" };
  const rows = [];
  const render = () => {
    const useAuthored = $("authored").checked;
    rows.forEach(({ node, card }) => {
      const text = useAuthored && card.authored ? card.authored : card.text;
      node.querySelector("p").textContent = text;
      node.querySelector(".src").textContent = useAuthored && card.authored ? "hand-written draft" : "stage " + card.stage + (card.checks.ok ? " \\u00b7 checks passed" : " \\u00b7 CHECK FAILED");
      node.querySelector(".src").className = "src " + (card.checks.ok || (useAuthored && card.authored) ? "ok" : "warn");
    });
  };
  for (const step of d.steps) {
    $("steps").append(el("h2", "", "Step " + step.n + " of " + d.steps.length + " \\u00b7 " + step.title));
    $("steps").append(el("p", "sub", "Where he is: " + step.whereNow));
    const row = el("div", "row"); row.tabIndex = 0; row.setAttribute("aria-label", "Story cards for step " + step.n);
    const cards = step.cards.map((c) => ({ ...c, stage: c.stage ?? 2 }));
    if (step.n === d.meta.pauseAtStep) cards.push({ ...d.pause.back, stage: 3, authored: null });
    const dots = el("div", "dots");
    cards.forEach((c, i) => {
      const node = el("div", "card"); const tag = el("div", "tag"); tag.append(el("span", "", KIND[c.kind] || c.kind), el("span", "src", "")); node.append(tag, el("p", "", "")); row.append(node);
      rows.push({ node, card: c });
      const dot = el("span", "dot"); dot.setAttribute("aria-current", i === 0 ? "true" : "false"); dots.append(dot);
    });
    row.addEventListener("scroll", () => {
      const i = Math.round(row.scrollLeft / (row.firstChild.offsetWidth + 12));
      [...dots.children].forEach((x, j) => x.setAttribute("aria-current", j === i ? "true" : "false"));
    });
    $("steps").append(row, dots);
  }
  $("authored").addEventListener("change", render);
  render();

  $("pause-h").textContent = "Pause during step " + d.meta.pauseAtStep;
  const chat = $("chat");
  chat.append(el("div", "meta", "He writes first (a small snag built around: " + d.pause.stuck.prop + ")"), el("div", "msg him", d.pause.stuck.text));
  const bubble = (c) => { const m = el("div", "msg him"); if (c.action) m.append(el("em", "", "(" + c.action.replace(/\\.$/, "") + ".)")); m.append(document.createTextNode(c.reply)); return m; };
  for (const t of d.pause.chat) {
    chat.append(el("div", "msg you", t.user));
    chat.append(el("div", "meta", "turn: " + t.kind + (t.state ? " \\u00b7 user seems " + t.state : "") + " \\u00b7 opening action: " + t.policy + (t.action ? " (on)" : " (off)") + " \\u00b7 scope: " + t.chosen.scope));
    chat.append(bubble(t.chosen));
    if (t.others.length) {
      const det = el("details"); det.append(el("summary", "", "Other tries (" + t.others.length + ")"));
      t.others.forEach((o) => { const a = el("div", "alt", (o.action ? "(" + o.action + ") " : "") + o.reply + "  [" + (o.checks.ok ? "passed" : o.checks.failures.join(", ")) + "]"); det.append(a); });
      chat.append(det);
    }
  }
  for (const mode of ["smooth", "rough"]) {
    const b = el("div", "box"); b.append(el("b", "lbl", mode === "smooth" ? "A smooth run" : "A rough run (one snag, then resolved)"), el("span", "", d.closing[mode].text)); $("closing").append(b);
  }
  const u = d.meta.usage;
  $("stats").textContent = u.calls + " model calls, about $" + u.costUsd + ". Generated " + d.meta.generatedAt.slice(0, 10) + ".";
</script>
</body>
</html>
`;
await writeFile(new URL("../docs/demo/index.html", import.meta.url), html);
console.log("wrote docs/demo/index.html");
