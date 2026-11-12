// Prompt builders for the story-card demo. Pure functions: data in, text out.
// The blocks follow the prompt canvas (intro, relationship, goal, now, mood, answer-first, gestures,
// format, history, rules). The data comes from docs/demo/<story-id>.stage0.json.

export const MOODS = { start: "focused", pause: "dejected", resume: "cheerful", complete: "happy" };

export const FORMAT_POLICY = {
  greeting: { action: "sometimes", max: 2 },
  question: { action: "always", max: 3 },
  clarify: { action: "never", max: 3 },
  chat: { action: "sometimes", max: 3 },
  tired: { action: "sometimes", max: 2 },
  sad: { action: "sometimes", max: 3 },
  overwhelm: { action: "sometimes", max: 2 },
};

const sliceIndex = (stage0, id) => stage0.slices.findIndex((s) => s.id === id);

/** Facts that have already happened when a Step starts at `entryId`. */
export function factsBefore(stage0, entryId) {
  return stage0.slices.slice(0, sliceIndex(stage0, entryId)).flatMap((s) => s.facts);
}

/** Words that would reveal a slice he has not reached yet (the entry slice included). */
export function bannedAt(stage0, entryId) {
  return stage0.slices.slice(sliceIndex(stage0, entryId)).flatMap((s) => s.leaks);
}

/** Which people he has met by the time the Step starts. */
export function peopleMetBefore(stage0, entryId) {
  const i = sliceIndex(stage0, entryId);
  return Object.entries(stage0.people)
    .filter(([, p]) => {
      const first = p.first_card.split(".")[1]; // "s1", "s4"...
      return sliceIndex(stage0, first) < Math.max(i, 1) || first === entryId;
    })
    .map(([name]) => name);
}

const persona = (s) =>
  `You are J. Robert Oppenheimer on ${s.story.date}, in ${s.story.place}. ${s.who} Always first person, as a real person talks to himself or to a friend. You know nothing that happens later.`;

const voice = (s) => `# How he sounds\n${s.voice.map((v) => `- ${v}`).join("\n")}`;

const cardRules = `# Rules for a card
- One or two sentences, at most 50 words. First person.
- No question marks. Never the word "you". No dashes. No clock times or durations. End with a full stop.
- Make sense alone. Do not say "again" or "another". Do not say what happens next.
- Use only the facts given, the scene, and what a person in his place would plainly see or feel. Do not add people, remarks or outcomes.`;

/** Stage 1a: the background card, told once at the start of the Goal. */
export function backgroundPrompt(s) {
  const people = s.scene.present.map((n) => `- ${s.people[n].line}`).join("\n");
  return [
    persona(s),
    voice(s),
    `# Where he is\n${s.whereNow.s1}\nHis goal: ${s.story.goalFull}`,
    `# Who is here\n${people}`,
    `# Task\nWrite the background card the user reads first. He tells it as a story, in his own voice: who is here, where this is, and what each person knows. Introduce each person the way he would to a friend, with their role in a few words. Three or four sentences, at most 70 words. No question marks, no "you", no dashes, no clock times. Do not say what will happen.`,
    `Reply with JSON only: {"card": "..."}`,
  ].join("\n\n");
}

/** Stage 1b: the story cards of a Step. They tell what is in front of him; feelings come in stage 2. */
export function storyCardsPrompt(s, step) {
  const done = factsBefore(s, step.entrySlice);
  const met = peopleMetBefore(s, step.entrySlice).filter((n) => !s.scene.present.includes(n));
  const known = done.length
    ? done.map((f) => `- ${f}`).join("\n")
    : "- (nothing yet; the day is just beginning)";
  const examples = [
    `Example of a "why" card (another moment): ${s.examples.card_why[0]}`,
    `Example of a "now" card (another moment): ${s.examples.card_now[0]}`,
  ].join("\n");
  return [
    persona(s),
    voice(s),
    cardRules,
    `# Where he is\n${s.whereNow[step.entrySlice]}`,
    `# What has happened so far\n${known}`,
    met.length
      ? `# People now in the scene\n${met.map((n) => `- ${s.people[n].line}`).join("\n")}`
      : "",
    `# Task\nWrite ${step.n > 1 ? "three cards" : "two cards"} for this moment.\n${
      step.n > 1
        ? `- "landing": what he just finished, from the most recent facts above, in the past tense. Two sentences at most. The opening card of this Step.\n`
        : ""
    }- "why": why this moment is not easy for him, from what has happened so far (not from what comes next).\n- "now": one concrete thing he sees or does right now, from this scene: ${s.scene.props.join(", ")}. No outcome, no new event.\n${examples}`,
    `Reply with JSON only: {${step.n > 1 ? '"landing": "...", ' : ""}"why": "...", "now": "..."}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Stage 2: the model reads the story the first stage told and says how it feels to him. */
export function feelingPrompt(s, step, cards, mode = "smooth") {
  return [
    persona(s),
    voice(s),
    cardRules,
    `# What is happening (already written, do not repeat it)\n${cards.map((c) => `- ${c}`).join("\n")}`,
    `# How the stretch is going\n${mode === "rough" ? "It is going badly: things keep catching." : "It is going steadily, without a hitch."}`,
    `# Task\nSay how this feels to him right now. One or two sentences. Name the feeling directly (for example wary, tired, impatient, uneasy) and tie it to one thing in front of him. Do not draw a lesson. Do not praise anyone. Do not repeat what the cards already say.\nExample of the register (another moment): ${s.examples.card_feeling[0]}`,
    `Reply with JSON only: {"feeling": "..."}`,
  ].join("\n\n");
}

/** Stuck message: one small snag of his own, with the prop chosen by code. */
export function stuckPrompt(s, step, prop) {
  const done = factsBefore(s, step.entrySlice)
    .map((f) => `- ${f}`)
    .join("\n");
  return [
    persona(s),
    voice(s),
    `# Where he is\n${s.whereNow[step.entrySlice]}`,
    `# What has happened so far\n${done}`,
    `# Task\nThe user has paused because they are stuck on their own task. Write one small thing that has also snagged him, built around "${prop}". One or two sentences, at most 30 words, first person, concrete, with a clear cause, and not yet solved. It is a small thing, not a turn of the story. No advice, no question, nothing about the user's work, no "you", no dashes, no durations.`,
    `Reply with JSON only: {"story": "...", "why": "..."}`,
  ].join("\n\n");
}

/** Back from the pause: how the small thing got resolved. */
export function resolvePrompt(s, step, stuck) {
  return [
    persona(s),
    voice(s),
    `# Where he is\n${s.whereNow[step.entrySlice]}`,
    `# The small thing that snagged him\n${stuck.story}\nWhy: ${stuck.why}`,
    `# Task\nThe user has come back to their work. Write one card, one or two sentences, first person, saying how that small thing got resolved, with a clear cause. No new people, no outcome of the argument, no "you", no dashes, no durations. ${"Do not say what happens next."}`,
    `Reply with JSON only: {"card": "..."}`,
  ].join("\n\n");
}

/** Closing feeling line: the run log goes back to the model once more. */
export function closingPrompt(s, mode, log) {
  return [
    persona(s).replace(
      "You know nothing that happens later.",
      "Nothing after this moment has happened or can be known.",
    ),
    voice(s),
    `# What happened to him\n${s.slices
      .flatMap((x) => x.facts)
      .map((f) => `- ${f}`)
      .join("\n")}`,
    log.length
      ? `# Small snags and how they got resolved\n${log.map((l) => `- ${l}`).join("\n")}`
      : "",
    `# How the stretch went\n${mode === "rough" ? "Rough: it caught more than once before it moved." : "Smooth: it moved without much trouble."}`,
    `# Task\nSay, in his own voice, how he feels right now. One to three short sentences. Feel it from what happened to him: a smooth stretch can leave him uneasy, relieved or restless; a rough one can leave him tired, stubborn or lighter. Do not default to proud or wise. No lesson, no praise, no advice. Do not mention the reader, their work, minutes, counts or pauses. No "you", no dashes, no question marks. Quote at most a few words of what is above.`,
    `Reply with JSON only: {"line": "..."}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Chat turn type and the user's state, by keywords (as in the canvas). */
export function classifyTurn(text) {
  const t = text.toLowerCase();
  let state = "";
  if (/\b(tired|sleepy|exhausted|can't focus|cannot focus)\b/.test(t)) state = "tired";
  else if (/\b(quit|give up|sad|down|hopeless|want to stop)\b/.test(t)) state = "sad";
  else if (/\b(overwhelmed|too much|stressed)\b/.test(t)) state = "overwhelm";
  let kind = "chat";
  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t)) kind = "greeting";
  else if (/\b(who is|who's|what do you mean|what did you mean|why did you say)\b/.test(t))
    kind = "clarify";
  else if (
    /\b(what are you|where are you|how are you|are you|what is it like|what's it like)\b/.test(t)
  )
    kind = "question";
  return { kind, state };
}

/** Format policy: the user's state overrides the talk row. `turnIndex` splits "sometimes" half and half. */
export function formatFor({ kind, state }, turnIndex) {
  const row = FORMAT_POLICY[state] ?? FORMAT_POLICY[kind] ?? FORMAT_POLICY.chat;
  const action =
    row.action === "always" ? true : row.action === "never" ? false : turnIndex % 2 === 0;
  return { action, max: row.max, policy: row.action };
}

/** Draw `count` gestures, avoiding the ones used lately. `rand` returns a number in [0, 1). */
export function drawGestures(gestures, recent, count = 2, rand = Math.random) {
  const pool = gestures.filter((g) => !recent.includes(g));
  const from = pool.length >= count ? [...pool] : [...gestures];
  const out = [];
  while (out.length < count && from.length)
    out.push(from.splice(Math.floor(rand() * from.length), 1)[0]);
  return out;
}

const ANSWER_FIRST = {
  greeting:
    "The user is just arriving. Greet them in your own voice and say, in a sentence, where you are and what is on your mind.",
  question:
    "The user is asking about you. Answer the literal question first, from your own situation, before anything else.",
  clarify:
    "The user is asking what you meant. Explain it plainly from your own situation, in the same voice.",
};

/** The chat system prompt, assembled from the canvas blocks. */
export function chatSystem(s, ctx) {
  const examples = s.examples.chat
    .map(
      (e) =>
        `User: ${e.user}\nHe: ${ctx.actionOn ? e.reply : e.reply.replace(/^\([^)]*\)\s*/, "")}`,
    )
    .join("\n\n");
  const blocks = [
    persona(s),
    `You and the other person are not in the same place. Each of you has your own goal and your own things to do, and you talk across a line while moving forward together. You talk about your side: what is happening to you and how you feel. You do not know what the other person is doing, you cannot touch them, and they are not standing next to you.`,
    voice(s),
    `# Your goal\n${s.story.goalFull}`,
    `# Who is here\n${ctx.peopleLines.map((l) => `- ${l}`).join("\n")}`,
    `# What you are doing now\n${s.whereNow[ctx.entrySlice]}\nWhy it is not easy: ${ctx.whyHard}`,
    `# Your mood right now\n${ctx.mood}`,
    ctx.stuck ? `# Something that has snagged you\n${ctx.stuck}` : "",
    ctx.resolved ? `# Something that just got resolved\n${ctx.resolved}` : "",
    ctx.kind && ANSWER_FIRST[ctx.kind] ? `# This turn\n${ANSWER_FIRST[ctx.kind]}` : "",
    ctx.state === "tired" || ctx.state === "sad" || ctx.state === "overwhelm"
      ? `# The user seems ${ctx.state === "tired" ? "tired" : ctx.state === "sad" ? "down" : "overwhelmed"}\nSay one small true thing from your own side that weighs about as much. Then stop. No advice, no comfort method, no "tell me what happened".`
      : "",
    ctx.actionOn
      ? `# Within reach this turn (for your opening action only)\n${ctx.gestures.join("; ")}`
      : "",
    ctx.actionOn
      ? `# Reply format\nStart with one action in parentheses, written without "I", "my" or "you", about 4 to 12 words, what your own hands or body do right now, showing your mood. Then write 1 to ${ctx.max} sentences in first person.`
      : `# Reply format\nWords only, with no parenthetical action. Write 1 to ${ctx.max} sentences in first person.`,
    `# Examples of the register (other moments)\n${examples}`,
    ctx.history.length
      ? `# The conversation so far\n${ctx.history.map((h) => `${h.role === "user" ? "User" : "He"}: ${h.text}`).join("\n")}`
      : "",
    `# Rules
- English only.
- You know nothing that happens later, and you do not know how this ends.
- Do not mention AI, prompts, steps or any clock time or duration.
- Do not invent people. ${(() => {
      const names = [...s.scene.present, ...ctx.extraNames];
      return names.length ? `The only names are ${names.join(", ")}.` : "He gives no names.";
    })()}
- Do not give advice, orders or comfort methods. Do not ask the user to do anything.
- At most one question, and never as your last sentence.
- Vary your wording. Do not quote the facts back word for word and do not reuse a phrase from earlier in this conversation.`,
    `Output one JSON object: {"scope": "his_world|task|knowledge|personal|meta|emotional|unknown", "action": "${ctx.actionOn ? "the action without parentheses" : ""}", "reply": "the sentences"}`,
  ];
  return blocks.filter(Boolean).join("\n\n");
}
