// Generates the demo content for "The Canyon and the Mesa" with DeepSeek, in four stages:
//   1. story cards (background card, landing, why, now), 2. a second call that says how it feels,
//   3. the pause (stuck message, roleplay chat with an opening action, resolved card), 4. the closing line.
// Usage: node --env-file=.env scripts/demo-story.mjs
// Demo only. The production path is the server-side model gateway (issue #132).
import { readFile, writeFile } from "node:fs/promises";
import { checkCard, checkChatReply, checkStuck } from "./demo-checks.mjs";
import {
  MOODS,
  backgroundPrompt,
  bannedAt,
  chatSystem,
  classifyTurn,
  closingPrompt,
  drawGestures,
  feelingPrompt,
  formatFor,
  peopleMetBefore,
  resolvePrompt,
  storyCardsPrompt,
  stuckPrompt,
} from "./demo-prompts.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), "utf8"));
const stage0 = await read("../docs/demo/site-search.stage0.json");
const config = await read("./live-generation-benchmark.config.json");
const provider = config.providers.find((p) => p.provider === "deepseek");
const OUT = new URL("../docs/demo/site-search.generated.json", import.meta.url);
const key = process.env.DEEPSEEK_API_KEY;
if (!key) {
  console.error("DEEPSEEK_API_KEY is missing in .env");
  process.exit(1);
}

const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
const prompts = {};

async function chat(messages, { maxTokens = 2500, temperature = 0.8 } = {}) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: provider.model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek answered status ${response.status}`);
  const body = await response.json();
  usage.calls += 1;
  usage.inputTokens += body.usage?.prompt_tokens ?? 0;
  usage.outputTokens += body.usage?.completion_tokens ?? 0;
  // The served model reasons first and reasoning tokens count toward max_tokens.
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("empty answer (token budget used by reasoning)");
  return JSON.parse(text);
}

const alwaysAllowed = stage0.scene.allowedWords;
const allowedAt = (entry) => {
  const met = peopleMetBefore(stage0, entry);
  return alwaysAllowed.filter(
    (w) =>
      !["Groves", "Mesa", "Pajarito", "Plateau", "Los", "Alamos", "Ranch", "School"].includes(w) ||
      (w === "Groves" && met.includes("Groves")),
  );
};
const baseCtx = (entry) => ({
  forbidden: stage0.story.forbidTerms,
  banned: bannedAt(stage0, entry),
  allowedWords: allowedAt(entry),
});

/** Calls the model until every field passes its check (3 attempts), keeping the best attempt. */
async function writeFields(prompt, fields, ctxFor, label) {
  let best = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let json;
    try {
      json = await chat([{ role: "user", content: prompt }]);
    } catch (e) {
      console.log(`  ${label}: ${e.message}`);
      continue;
    }
    const seen = [];
    const out = {};
    for (const f of fields) {
      const text = String(json[f] ?? "");
      const checks = checkCard(text, { ...ctxFor(f), seen: [...seen] });
      seen.push(text);
      out[f] = { text, checks };
    }
    const failed = fields.filter((f) => !out[f].checks.ok).length;
    if (!best || failed < best.failed) best = { out, failed, attempts: attempt };
    if (failed === 0) break;
  }
  return best;
}

const authored = (slice, role) =>
  stage0.authoredCards.find((c) => c.slice === slice && c.role === role)?.text ?? null;
const prevSlice = (entry) => stage0.slices[stage0.slices.findIndex((x) => x.id === entry) - 1]?.id;

// ---- Stage 1 and 2: the cards of the four Steps ----
const steps = [];
prompts.background = backgroundPrompt(stage0);
const bg = await writeFields(
  prompts.background,
  ["card"],
  () => ({ ...baseCtx("s1"), maxChars: 520 }),
  "background",
);
console.log(
  `background card: ${bg.out.card.checks.ok ? "OK" : "checks failed: " + bg.out.card.checks.failures.join(", ")}`,
);

for (const step of stage0.steps) {
  const fields = step.n > 1 ? ["landing", "why", "now"] : ["why", "now"];
  const p1 = storyCardsPrompt(stage0, step);
  if (step.n <= 2) prompts[`story_step${step.n}`] = p1;
  // Landing describes the finished Step, so only the later slices are banned for it.
  const story = await writeFields(
    p1,
    fields,
    () => baseCtx(step.entrySlice),
    `step ${step.n} story`,
  );
  const cards = [];
  if (step.n === 1)
    cards.push({
      kind: "opening",
      stage: 1,
      text: bg.out.card.text,
      checks: bg.out.card.checks,
      attempts: bg.attempts,
      authored: authored("s1", "opening"),
    });
  if (step.n > 1)
    cards.push({
      kind: "landing",
      stage: 1,
      text: story.out.landing.text,
      checks: story.out.landing.checks,
      attempts: story.attempts,
      authored: authored(prevSlice(step.entrySlice), "landing"),
    });
  cards.push({
    kind: "why",
    stage: 1,
    text: story.out.why.text,
    checks: story.out.why.checks,
    attempts: story.attempts,
    authored: authored(step.entrySlice, "why"),
  });
  cards.push({
    kind: "now",
    stage: 1,
    text: story.out.now.text,
    checks: story.out.now.checks,
    attempts: story.attempts,
    authored: authored(step.entrySlice, "now"),
  });
  // Stage 2: a second call reads the story the first call wrote and says how it feels.
  const told = cards.map((c) => c.text);
  const p2 = feelingPrompt(stage0, step, told);
  if (step.n <= 2) prompts[`feeling_step${step.n}`] = p2;
  const feel = await writeFields(
    p2,
    ["feeling"],
    () => ({ ...baseCtx(step.entrySlice), seen: told }),
    `step ${step.n} feeling`,
  );
  cards.push({
    kind: "feeling",
    stage: 2,
    text: feel.out.feeling.text,
    checks: feel.out.feeling.checks,
    attempts: feel.attempts,
    authored: authored(step.entrySlice, "worry"),
  });
  steps.push({
    n: step.n,
    title: step.title,
    userSide: step.userSide,
    entrySlice: step.entrySlice,
    whereNow: stage0.whereNow[step.entrySlice],
    cards,
  });
  console.log(
    `step ${step.n}: ${cards.filter((c) => !c.checks.ok).length} card(s) with failed checks`,
  );
}

// ---- Stage 3: the pause during Step 2 ----
const pauseStep = stage0.steps[1];
const entry = pauseStep.entrySlice;
const props = stage0.scene.props;
const prop = props[props.indexOf("map")];
prompts.stuck = stuckPrompt(stage0, pauseStep, prop);
let stuck = null;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const json = await chat([{ role: "user", content: prompts.stuck }]);
  const text = String(json.story ?? "");
  const checks = checkStuck(text, { ...baseCtx(entry), maxChars: 300 });
  stuck = { prop, text, why: String(json.why ?? ""), checks, attempts: attempt };
  if (checks.ok) break;
}
console.log(
  `stuck message: ${stuck.checks.ok ? "OK" : "checks failed: " + stuck.checks.failures.join(", ")}`,
);

const whyHard = authored(entry, "worry");
const peopleLines = stage0.scene.present.map((n) => stage0.people[n].line);
const turns = [
  "hey",
  "I'm so tired I can't focus anymore",
  "I'm stuck on a proof in my math homework",
  "what are you doing right now?",
  "wait, who's Dudley?",
  "honestly I just want to quit",
];
let seed = 7;
const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const history = [];
const recentGestures = [];
const recentActions = [];
const said = [stuck.text];
const chatTurns = [];
for (let i = 0; i < turns.length; i += 1) {
  const text = turns[i];
  const cls = classifyTurn(text);
  const fmt = formatFor(cls, i);
  const gestures = fmt.action ? drawGestures(stage0.gestures, recentGestures, 2, rand) : [];
  const system = chatSystem(stage0, {
    entrySlice: entry,
    whyHard,
    mood: MOODS.pause,
    stuck: stuck.text,
    resolved: "",
    kind: cls.kind,
    state: cls.state,
    actionOn: fmt.action,
    gestures,
    max: fmt.max,
    history,
    extraNames: [],
    peopleLines,
  });
  if (i === 2) prompts.chat = system;
  const ctx = {
    ...baseCtx(entry),
    actionAllowed: fmt.action,
    actionRequired: fmt.action,
    recentActions: [...recentActions],
    maxSentences: fmt.max,
    userTerm: "",
    seen: [...said],
  };
  const attempts = await Promise.all(
    [0, 1, 2].map(() =>
      chat(
        [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
        { temperature: 1 },
      )
        .then((j) => ({
          scope: String(j.scope ?? ""),
          action: String(j.action ?? "")
            .replace(/^\(|\)$/g, "")
            .trim(),
          reply: String(j.reply ?? ""),
        }))
        .catch(() => null),
    ),
  );
  const scored = attempts.filter(Boolean).map((c) => ({ ...c, checks: checkChatReply(c, ctx) }));
  scored.sort((a, b) => a.checks.failures.length - b.checks.failures.length);
  const chosen = scored[0];
  const others = scored.slice(1);
  chatTurns.push({
    user: text,
    kind: cls.kind,
    state: cls.state,
    action: fmt.action,
    policy: fmt.policy,
    gestures,
    chosen,
    others,
  });
  history.push({ role: "user", text }, { role: "he", text: chosen.reply });
  said.push(chosen.reply);
  if (chosen.action) recentActions.push(chosen.action);
  gestures.forEach((g) => recentGestures.push(g));
  console.log(
    `chat ${i + 1}: ${chosen.checks.ok ? "OK" : "failed: " + chosen.checks.failures.join(", ")}  [${scored.filter((c) => c.checks.ok).length}/${scored.length} candidates passed]`,
  );
}

prompts.resolve = resolvePrompt(stage0, pauseStep, stuck);
let back = null;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const json = await chat([{ role: "user", content: prompts.resolve }]);
  const text = String(json.card ?? "");
  const checks = checkCard(text, { ...baseCtx(entry), seen: [stuck.text] });
  back = { kind: "back", text, checks, attempts: attempt };
  if (checks.ok) break;
}
console.log(
  `resolved card: ${back.checks.ok ? "OK" : "checks failed: " + back.checks.failures.join(", ")}`,
);

// ---- Stage 4: the closing line, smooth and rough ----
const closing = {};
for (const mode of ["smooth", "rough"]) {
  const log = mode === "rough" ? [`${stuck.text} Resolved: ${back.text}`] : [];
  const p = closingPrompt(stage0, mode, log);
  if (mode === "rough") prompts.closing = p;
  const ctx = {
    forbidden: stage0.story.forbidTerms,
    banned: [],
    allowedWords: alwaysAllowed,
    seen: [],
  };
  let best = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const json = await chat([{ role: "user", content: p }]);
    const text = String(json.line ?? "");
    const checks = checkCard(text, { ...ctx, maxChars: 360 });
    if (!best || checks.failures.length < best.checks.failures.length)
      best = { text, checks, attempts: attempt };
    if (checks.ok) break;
  }
  closing[mode] = best;
  console.log(
    `closing (${mode}): ${best.checks.ok ? "OK" : "checks failed: " + best.checks.failures.join(", ")}`,
  );
}

const costUsd =
  (usage.inputTokens * provider.inputPricePerMillion +
    usage.outputTokens * provider.outputPricePerMillion) /
  1e6;
const output = {
  meta: {
    story: { ...stage0.story },
    who: stage0.who,
    model: provider.model,
    generatedAt: new Date().toISOString(),
    pauseAtStep: 2,
    note: "Draft content generated for a demo from the story database, the NF3 scene data and the canvas prompt blocks. The checks are a subset of docs/ai/AI_06. Not reviewed by a content owner.",
    usage: { ...usage, costUsd: Number(costUsd.toFixed(4)) },
  },
  prompts,
  steps,
  pause: { stuck, chat: chatTurns, back },
  closing,
};
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `wrote docs/demo/site-search.generated.json (${usage.calls} calls, about $${costUsd.toFixed(4)})`,
);
