// A subset of the AI-6 checks (docs/ai/AI_06_check-and-fallback.md) for the demo generator.
// The production checks live behind the model gateway (issue #132).

const SCOPES = ["his_world", "task", "knowledge", "personal", "meta", "emotional", "unknown"];

const words = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const opener = (text) => words(text).slice(0, 3).join(" ");
const fourGrams = (text) => {
  const w = words(text);
  return new Set(w.slice(0, Math.max(0, w.length - 3)).map((_, i) => w.slice(i, i + 4).join(" ")));
};
/** True when `text` shares any four-word run with an earlier text. */
const repeatsPhrase = (text, earlier) => {
  const mine = fourGrams(text);
  return earlier.some((e) => [...fourGrams(e)].some((g) => mine.has(g)));
};

export const countSentences = (text) => (text.match(/[^.!?]+[.!?]+/g) ?? [text]).length;

/** Capitalised words inside a sentence that are not on the allowed list (a person or place he could not know). */
export function unknownNames(text, allowed) {
  const ok = new Set(allowed);
  const found = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const rest = sentence.replace(/^\W*\S+/, "");
    for (const w of rest.match(/\b[A-Z][a-z]+\b/g) ?? []) if (!ok.has(w)) found.push(w);
  }
  return found;
}

function commonFailures(text, ctx) {
  const failures = [];
  if (!text || !text.trim()) return ["empty"];
  if (ctx.allowedWords) {
    for (const w of unknownNames(text, ctx.allowedWords)) failures.push(`unknown name: ${w}`);
  }
  const lower = text.toLowerCase();
  if (/[–—]| - /.test(text)) failures.push("dash");
  if (/\b\d+\s*(min|mins|minutes|hour|hours|sec|seconds)\b/i.test(text)) failures.push("duration");
  if (/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(text)) failures.push("clock time");
  if (/\bmull(ing|ed)?\b/i.test(text)) failures.push("narrates his own thinking");
  if (repeatsPhrase(text, ctx.seen ?? [])) failures.push("repeated phrase");
  for (const term of ctx.forbidden ?? []) {
    if (lower.includes(term.toLowerCase())) failures.push(`forbidden term: ${term}`);
  }
  for (const term of ctx.banned ?? []) {
    if (lower.includes(term.toLowerCase())) failures.push(`not known yet: ${term}`);
  }
  return failures;
}

/** Story card: one-way, self-contained, ends with a full stop. */
export function checkCard(text, ctx) {
  const failures = commonFailures(text, ctx);
  if (text && text.length > (ctx.maxChars ?? 360)) failures.push("too long");
  if (text && countSentences(text) > 4) failures.push("too many sentences");
  if (text?.includes("?")) failures.push("question");
  if (/\byou(r|rs|rself)?\b/i.test(text ?? "")) failures.push("addresses the reader");
  if (/\b(again|as i said|another card)\b/i.test(text ?? ""))
    failures.push("refers to another card");
  if (text && !/[.]["”]?$/.test(text.trim())) failures.push("no full stop");
  if (text && (ctx.seen ?? []).some((s) => opener(s) === opener(text)))
    failures.push("repeated opener");
  return { ok: failures.length === 0, failures };
}

const ADVICE =
  /\b(you should|you could|you must|you need to|try to|i suggest|i recommend|let's|let us|give it some time|reach out|be gentle with|rest your mind|don't force|do not force|stay with me|listen with me|my friend|tell me what happened|take a break)\b/i;
const BREAKS_CHARACTER =
  /\b(as an ai|language model|as a character|prompt|i cannot help|i can't help)\b|\bAI\b/;

/** Chat reply with a scope label (AI_04 section A). */
export function checkChatReply(reply, ctx) {
  const failures = [];
  if (!reply || typeof reply.reply !== "string") return { ok: false, failures: ["not an object"] };
  if (!SCOPES.includes(reply.scope)) failures.push("unknown scope");
  failures.push(...commonFailures(reply.reply, ctx));
  if (reply.reply.length > 320) failures.push("too long");
  if (ADVICE.test(reply.reply)) failures.push("advice");
  if (BREAKS_CHARACTER.test(reply.reply)) failures.push("breaks character");
  if (/\?\s*$/.test(reply.reply)) failures.push("ends with a question");
  if ((reply.reply.match(/\?/g) ?? []).length > 1) failures.push("more than one question");
  if (ctx.maxSentences && countSentences(reply.reply) > ctx.maxSentences)
    failures.push("too many sentences");
  failures.push(...checkAction(reply.action ?? "", ctx));
  if (ctx.userTerm && reply.reply.toLowerCase().includes(ctx.userTerm.toLowerCase())) {
    failures.push("echoes a term he could not know");
  }
  return { ok: failures.length === 0, failures };
}

/** Stuck message: his own snag, no advice, no question as the last line. */
export function checkStuck(text, ctx) {
  const failures = commonFailures(text, ctx);
  if (text && text.length > 420) failures.push("too long");
  if (ADVICE.test(text ?? "")) failures.push("advice");
  if (BREAKS_CHARACTER.test(text ?? "")) failures.push("breaks character");
  if (/\?\s*$/.test(text ?? "")) failures.push("ends with a question");
  return { ok: failures.length === 0, failures };
}

export function nextAttemptNeeded(result, attempt, maxAttempts = 3) {
  return !result.ok && attempt < maxAttempts;
}

/** Opening action: present only when the format asks for it, short, impersonal, not a repeat. */
export function checkAction(action, ctx) {
  const failures = [];
  const text = (action ?? "").trim();
  if (ctx.actionAllowed === false) {
    if (text) failures.push("action where none is wanted");
    return failures;
  }
  if (ctx.actionRequired && !text) return ["action missing"];
  if (!text) return failures;
  const n = words(text).length;
  if (n < 3 || n > 16) failures.push("action length");
  if (/\b(you|your|user)\b/i.test(text)) failures.push("action mentions the user");
  if (/\b(i|my|me|his|he)\b/i.test(text)) failures.push("action uses a pronoun");
  const o = opener(text);
  if ((ctx.recentActions ?? []).some((a) => opener(a) === o))
    failures.push("action repeats a recent one");
  return failures;
}
