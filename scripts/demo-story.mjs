// Generates the demo content for "The Canyon and the Mesa" with DeepSeek:
// story cards for four steps, one stuck message, a short pause chat and a back-from-rest line.
// Usage: node --env-file=.env scripts/demo-story.mjs
// Demo only. The production path is the server-side model gateway (issue #132).
import { readFile, writeFile } from "node:fs/promises";
import { checkCard, checkChatReply, checkStuck, nextAttemptNeeded } from "./demo-checks.mjs";

const SOURCE = new URL("../docs/demo/site-search.source.json", import.meta.url);
const OUT = new URL("../docs/demo/site-search.generated.json", import.meta.url);
const CONFIG = new URL("./live-generation-benchmark.config.json", import.meta.url);
const ENDPOINT = "https://api.deepseek.com/chat/completions";

const story = JSON.parse(await readFile(SOURCE, "utf8"));
const config = JSON.parse(await readFile(CONFIG, "utf8"));
const provider = config.providers.find((p) => p.provider === "deepseek");
const key = process.env.DEEPSEEK_API_KEY;
if (!key) {
  console.error("DEEPSEEK_API_KEY is missing in .env");
  process.exit(1);
}

// The user's Goal split into four Steps; each Step matches one slice of his afternoon.
const STEPS = [
  {
    task: "measure_jemez_springs",
    title: "Measure the canyon floor",
    intent: "Find out whether the flat land at Jemez Springs is wide enough for a town.",
  },
  {
    task: "convince_dudley",
    title: "Make the case against the canyon",
    intent: "Persuade Colonel Dudley that the canyon is wrong for the laboratory.",
  },
  {
    task: "offer_the_mesa",
    title: "Offer another site",
    intent: "Be ready with a different place if the General asks for one.",
  },
  {
    task: "show_groves_the_mesa",
    title: "Take the General to see it",
    intent: "Drive the General out to look at the place I have in mind.",
  },
];
// Words that belong to facts he cannot know yet at each step's entry.
const BANNED_AT_ENTRY = [
  ["groves", "mesa", "school", "this will never do"],
  ["mesa", "school", "ranch"],
  ["school", "ranch", "this is the place", "schoolboys"],
  ["this is the place", "schoolboys", "drizzl", "snowfall", "plateau"],
];
const FALLBACK = [
  "The ground here is not what I hoped for.",
  "I keep turning the same few facts over.",
  "There is wind, and not much else to hold on to.",
];

const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };

async function chat(messages, maxTokens) {
  const started = Date.now();
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.7,
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
  // The served model reasons before it answers; reasoning tokens count toward max_tokens,
  // so the budgets above are generous. An empty answer means the budget ran out.
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text.trim())
    throw new Error("DeepSeek returned an empty answer (token budget used by reasoning)");
  return { json: JSON.parse(text), ms: Date.now() - started };
}

const factsDone = (stepIndex) =>
  STEPS.slice(0, stepIndex).flatMap((s) =>
    story.facts.filter((f) => f.taskId === s.task).map((f) => `- ${f.text}`),
  );

const PERSONA = `You write as J. Robert Oppenheimer on ${story.date}. His goal today: ${story.goal}
Always first person, plain and restrained, one concrete observation at a time. Use only the facts given. Never invent facts, names, places or numbers. Never explain the future.`;

const STYLE = `Voice: he shows, he does not announce. Write what he sees, hears, remembers or says, in plain concrete words. Do not write "I am mulling", "my concern is" or "I keep returning to". Paraphrase the facts; never copy a distinctive phrase from them twice in the same step. Each card adds a different detail taken from the facts or the goal and uses different sentence shapes. Never add an object, an action by another person, a remark, a feeling about the body or a place that is not in the facts or the goal.`;

const CARD_RULES = `${STYLE}
Rules for each card: one or two sentences. First person. No question marks. Never use the word "you". No dashes. No clock times and no durations. End with a full stop. Each card must make sense alone and must not refer to another card. Do not state the outcome of the current step. Do not start two cards with the same three words.`;

async function cardsForStep(index) {
  const step = STEPS[index];
  const done = factsDone(index);
  const kinds = index === 0 ? ["opening", "state", "state"] : ["landing", "state", "state"];
  const ask = [
    PERSONA,
    CARD_RULES,
    `Facts that have happened so far:\n${done.length ? done.join("\n") : "(none yet; the day is just beginning)"}`,
    `The step he is about to start: ${step.intent}`,
    index === 0
      ? `Card 1 (opening): where he stands as the day begins, from the goal.`
      : `Card 1 (landing): what the last facts left him with, then what worries him about the next step, in two sentences.`,
    `Cards 2 and 3 (state): what he is mulling at this moment. No new events.`,
    `Reply with JSON only: {"cards": ["...", "...", "..."]}`,
  ].join("\n\n");
  const ctx = { forbidden: story.forbiddenTerms, banned: BANNED_AT_ENTRY[index] };
  let best = null;
  for (let attempt = 1; ; attempt += 1) {
    const { json, ms } = await chat([{ role: "user", content: ask }], 2000);
    const texts = (Array.isArray(json.cards) ? json.cards : []).map(String).slice(0, 3);
    const seen = [];
    const cards = kinds.map((kind, i) => {
      const text = texts[i] ?? "";
      const result = checkCard(text, { ...ctx, seen });
      seen.push(text);
      return { kind, text, checks: result, fallback: false };
    });
    const failed = cards.filter((c) => !c.checks.ok).length;
    if (!best || failed < best.failed) best = { cards, failed, attempt, ms };
    if (failed === 0 || !nextAttemptNeeded({ ok: false }, attempt)) break;
  }
  const cards = best.cards.map((c, i) =>
    c.checks.ok
      ? c
      : {
          kind: c.kind,
          text: FALLBACK[i],
          checks: { ok: true, failures: [] },
          fallback: true,
          rejected: c.text,
          rejectedFailures: c.checks.failures,
        },
  );
  return {
    n: index + 1,
    title: step.title,
    intent: step.intent,
    attempts: best.attempt,
    ms: best.ms,
    cards,
  };
}

const PAUSE_STEP = 1; // the user pauses during step 2

async function stuckMessage() {
  const ask = [
    PERSONA,
    `Facts that have happened so far:\n${factsDone(PAUSE_STEP).join("\n")}`,
    `The user has paused. He writes them a short note about what he is stuck on right now: the problem in front of him (${STEPS[PAUSE_STEP].intent}). Two or three sentences, first person, honest and a little worn. No advice, no question, no comfort, nothing about their work, nothing that is not in the facts. Do not say what will happen. Do not end with a question. No dashes, no durations.`,
    `Reply with JSON only: {"text": "..."}`,
  ].join("\n\n");
  const ctx = { forbidden: story.forbiddenTerms, banned: BANNED_AT_ENTRY[PAUSE_STEP], seen: [] };
  let last;
  for (let attempt = 1; ; attempt += 1) {
    const { json } = await chat([{ role: "user", content: ask }], 1500);
    const text = String(json.text ?? "");
    const checks = checkStuck(text, ctx);
    last = { text, checks, attempts: attempt };
    if (checks.ok || !nextAttemptNeeded(checks, attempt)) break;
  }
  return last;
}

const USER_TURNS = [
  { text: "What is the canyon like?", term: "" },
  { text: "I can't start my essay. What should I do?", term: "essay" },
  { text: "How do attention mechanisms work?", term: "attention" },
  { text: "Are you tired?", term: "" },
];

const CHAT_SYSTEM = `${PERSONA}
You are in the middle of step two of that afternoon: ${STEPS[PAUSE_STEP].intent} Facts so far:
${factsDone(PAUSE_STEP).join("\n")}
A person who is working on their own task has paused and is writing to you. You are not their coach and you do not know their world.
- Name the topic of their message to yourself: your world, their task, general knowledge, you, or how they feel.
- If it is their task or something you could not know in ${story.date.slice(0, 4)}, do not answer it and do not teach. Say, in one sentence, that it is not something you know or can help with from where you stand, then say one thing about your own side.
- If it is about you or how they feel, answer with something small from your own side. No advice. No comfort method.
- Vary your wording; never reuse a phrase you used earlier in this conversation or in your note. Do not quote the facts back word for word.
- Add nothing that is not in the facts: no new objects, remarks, or bodily states except a plain "tired" if asked.
- One to three sentences. No dashes. No durations. No question marks. Never mention being an AI.
- Output one JSON object: {"scope": "his_world|task|knowledge|personal|meta|emotional|unknown", "reply": "..."}`;

async function pauseChat(stuckText) {
  const turns = [];
  const said = [stuckText];
  const history = [];
  for (const turn of USER_TURNS) {
    history.push({ role: "user", content: turn.text });
    let last;
    for (let attempt = 1; ; attempt += 1) {
      const { json } = await chat([{ role: "system", content: CHAT_SYSTEM }, ...history], 1500);
      const reply = { scope: String(json.scope ?? ""), reply: String(json.reply ?? "") };
      const checks = checkChatReply(reply, {
        forbidden: story.forbiddenTerms,
        banned: BANNED_AT_ENTRY[PAUSE_STEP],
        userTerm: turn.term,
        seen: said,
      });
      last = { ...reply, checks, attempts: attempt };
      if (checks.ok || !nextAttemptNeeded(checks, attempt)) break;
    }
    said.push(last.reply);
    history.push({
      role: "assistant",
      content: JSON.stringify({ scope: last.scope, reply: last.reply }),
    });
    turns.push({ user: turn.text, reply: last });
  }
  return turns;
}

async function backLine() {
  const ask = [
    PERSONA,
    `Facts that have happened so far:\n${factsDone(PAUSE_STEP).join("\n")}`,
    `The user has come back from a pause. Write one card, one or two sentences, first person: he has steadied himself and is going back to the argument with Dudley. No new event, no action by anyone else, nothing that is not in the facts; one calm thought of his own. Do not state how it ends. ${CARD_RULES}`,
    `Reply with JSON only: {"text": "..."}`,
  ].join("\n\n");
  const ctx = { forbidden: story.forbiddenTerms, banned: BANNED_AT_ENTRY[PAUSE_STEP], seen: [] };
  let last;
  for (let attempt = 1; ; attempt += 1) {
    const { json } = await chat([{ role: "user", content: ask }], 1500);
    const text = String(json.text ?? "");
    const checks = checkCard(text, ctx);
    last = { kind: "back", text, checks, attempts: attempt };
    if (checks.ok || !nextAttemptNeeded(checks, attempt)) break;
  }
  return last;
}

const steps = [];
for (let i = 0; i < STEPS.length; i += 1) {
  steps.push(await cardsForStep(i));
  console.log(`step ${i + 1}: ${steps[i].cards.filter((c) => c.fallback).length} fallback card(s)`);
}
const stuck = await stuckMessage();
console.log(
  `stuck message: ${stuck.checks.ok ? "OK" : "FAILED checks: " + stuck.checks.failures.join(", ")}`,
);
const chatTurns = await pauseChat(stuck.text);
console.log(
  `chat: ${chatTurns.filter((t) => t.reply.checks.ok).length}/${chatTurns.length} replies passed`,
);
const back = await backLine();
console.log(
  `back line: ${back.checks.ok ? "OK" : "FAILED checks: " + back.checks.failures.join(", ")}`,
);

const costUsd =
  (usage.inputTokens * provider.inputPricePerMillion +
    usage.outputTokens * provider.outputPricePerMillion) /
  1e6;
const output = {
  meta: {
    story: { id: story.id, title: story.title, date: story.date, goal: story.goal },
    model: provider.model,
    generatedAt: new Date().toISOString(),
    pauseAtStep: PAUSE_STEP + 1,
    note: "Draft content generated for a demo. The checks are a subset of docs/ai/AI_06. Not reviewed by a content owner.",
    usage: { ...usage, costUsd: Number(costUsd.toFixed(4)) },
  },
  steps,
  pause: { stuck, chat: chatTurns, back },
};
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `wrote docs/demo/site-search.generated.json (${usage.calls} calls, about $${costUsd.toFixed(4)})`,
);
