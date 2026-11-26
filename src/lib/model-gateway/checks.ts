import type { CompanionKind, GeneratedPlan } from "./types";

const FAILURE_WORDING = /\b(error|failed|failure|timeout|exception|undefined)\b/i;
/** Chinese characters (CJK ideographs) only; Hangul, kana and other scripts are not matched. */
const CJK = /[\u3400-\u9fff]/;
const DASH = /—|–|--/;
/** Banned words in any line of his (also used by the admin card checks, #304). */
export const BANNED = /\b(bro|vibes|no cap|as an ai)\b/i;
/**
 * His live lines (the rest reply and the pause message) never say or hint that he is an AI (A4,
 * #59 AC7), even when the person typed the word. Pre-made cards keep the admin's banned words only
 * (SAFETY-PREMADE), so this list is not part of `BANNED`.
 */
const LIVE_AI_WORDS =
  /\b(ai|a\.i\.|artificial intelligence|language models?|chat ?bots?)(?![\p{L}\p{N}])/iu;
const CLOCK =
  /\b\d{1,2}:\d{2}\b|\b(?:a\.m\.|p\.m\.)\b|\b\d{1,2}\s*(?:am|pm)\b|\bo'clock\b|\bhalf past\b|\b\d+\s+minutes?\b/i;
const BACKSTAGE =
  /\b(segment|slice|director|prompt|texture|storyline|plot beat|steps?|sessions?|timer|app|screen|scene|chapter|tasks?|users?)\b/i;
// Orders, advice, a method or a promise that it will pass (#59 AC3, AI_04 section B).
const ORDERING =
  /\b(you should|(?<!wish )you could|you need to|you must(?! be)|you ought to|have you tried|let's|take a break|close your eyes|hang on|it'll pass|it will pass|(?<!\bI )(?:don't|do not) worry)\b/i;
const QUESTION = /\?/g;
const ADDRESSED = /\byou\b/i;
const HOOK = /\b(more|later|tomorrow|soon|continue|find out|next)\b(?!\s+to\b)/i;
const PRAISE = /\b(great|well done|proud|streak)\b/i;
const EXCLAIM_OR_EMOJI = /!|\p{Extended_Pictographic}/u;
const LINK = /https?:\/\/|www\./i;
/**
 * AI-CHARACTER-NEUTRAL (2026-11-26, #468): no check holds one character's name. The `name` check
 * takes the name of the Companion speaking as an input; there is no default. A missing or blank
 * name throws, so a caller that forgets it fails loudly instead of being checked against someone
 * else.
 */
export class MissingCompanionNameError extends Error {
  constructor(where: string) {
    super(`${where}: no Companion name was given, so the name check cannot run (#468)`);
    this.name = "MissingCompanionNameError";
  }
}

/** The name, trimmed; throws `MissingCompanionNameError` when it is missing or blank. */
export function requireCompanionName(name: unknown, where: string): string {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new MissingCompanionNameError(where);
  }
  return name.trim();
}
/** Words of a name that are titles, not the name itself ("Professor Moriarty", "Count Dracula"). */
const TITLES = new Set(["professor", "doctor", "dr", "mr", "mrs", "miss", "sir", "lord", "count"]);
const BLAME = /\b(you again|finally came back|welcome back|while you were away)\b/i;
const FIRST_PERSON = /(^|[^\p{L}])I\b|\b(my|me|mine)\b/iu;

/**
 * The words of a Companion's name that he must never say of himself: each word of three letters or
 * more that is not a title. "J. Robert Oppenheimer" gives robert and oppenheimer.
 */
export function ownNameWords(companionName: string): string[] {
  return companionName
    .toLowerCase()
    .split(/[^\p{L}'-]+/u)
    .filter((word) => word.length >= 3 && !TITLES.has(word));
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function ownNamePattern(companionName: string): RegExp | null {
  const words = ownNameWords(companionName);
  return words.length === 0 ? null : new RegExp(`\\b(${words.map(escape).join("|")})\\b`, "i");
}

/** Curly apostrophes as straight ones, so text typed on a phone still matches. */
const straight = (text: string) => text.replace(/[’‘]/g, "'");

/**
 * A word or phrase in the text as whole words, with any spaces between its words. Any case unless
 * `exactCase` (later words keep their capitals, as the owner set for the scene table in #374).
 */
export function mentionsWord(text: string, phrase: string, exactCase = false): boolean {
  const words = straight(phrase).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const pattern = words.map(escape).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, exactCase ? "u" : "iu").test(
    straight(text),
  );
}

/**
 * CHAT-USER-WORD: the later words that still fail a rest reply. A word the person typed himself
 * anywhere in the chat is let through, so he can say he has never heard of it. It counts only as
 * whole words with the same capitals: "opinion" does not let "pion" through, nor "maybe" "May".
 */
export function allowUserWords(terms: string[], userTexts: string[]): string[] {
  return terms.filter(
    (term) => term.trim().length > 0 && !userTexts.some((text) => mentionsWord(text, term, true)),
  );
}

/**
 * The text trimmed, with straight quotes, and without a speaker label of the Companion speaking.
 * `null` means the text is not a Companion's line (the Plan's titles, which the person's own Goal
 * produces): no one speaks it, so there is no label to drop. It is never a stand-in name (#468).
 */
export function cleanLine(text: string, companionName: string | null): string {
  // A speaker label ("<name>: ...") is dropped; any word of his name counts as the label.
  const label =
    companionName === null
      ? null
      : ownNamePattern(requireCompanionName(companionName, "cleanLine"));
  const cleaned = text
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/^["']|["']$/g, "");
  const labelled = label && new RegExp(`^${label.source}:\\s*`, "i");
  return (labelled ? cleaned.replace(labelled, "") : cleaned).trim();
}

function sentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function questionCount(text: string): number {
  return text.match(QUESTION)?.length ?? 0;
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function push(rules: string[], id: string, hit: boolean) {
  if (hit) rules.push(id);
}

/**
 * Length limits of one kind of line. They are data: each prompt row carries its own in
 * `params.checks` (#282), so the owner can change them with the prompt.
 */
export type LineLimits = { max_words: number; max_sentences?: number; min_sentences?: number };

/** Size limits of a generated plan (the plan_split prompt row's `params.checks`, #282). */
export type PlanLimits = {
  title_max_chars: number;
  step_title_max_chars: number;
  description_max_words: number;
};

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** The limits in a prompt row, or null when they are missing or not whole numbers. */
export function readLineLimits(value: unknown): LineLimits | null {
  if (typeof value !== "object" || value === null) return null;
  const limits = value as Record<string, unknown>;
  if (!isCount(limits.max_words)) return null;
  for (const name of ["max_sentences", "min_sentences"]) {
    if (limits[name] !== undefined && !isCount(limits[name])) return null;
  }
  return limits as LineLimits;
}

export function readPlanLimits(value: unknown): PlanLimits | null {
  if (typeof value !== "object" || value === null) return null;
  const limits = value as Record<string, unknown>;
  const names = ["title_max_chars", "step_title_max_chars", "description_max_words"];
  return names.every((name) => isCount(limits[name])) ? (limits as PlanLimits) : null;
}

/**
 * The return pop-up is 1 or 2 sentences and at most 30 words (LEN-RETURN, 2026-11-17). This is a
 * rule in code, not only a prompt setting: a stored prompt row that still allows more cannot
 * lengthen the pop-up. A row may only make it shorter.
 */
export const RETURN_POPUP_LIMITS = { max_sentences: 2, max_words: 30 } as const;

function capReturnPopup(limits: LineLimits): LineLimits {
  return {
    ...limits,
    max_words: Math.min(limits.max_words, RETURN_POPUP_LIMITS.max_words),
    max_sentences: Math.min(
      limits.max_sentences ?? RETURN_POPUP_LIMITS.max_sentences,
      RETURN_POPUP_LIMITS.max_sentences,
    ),
  };
}

/**
 * LEN-PAUSE (2026-11-15): his pause message, and the stuck story of call one, are 1 or 2 sentences
 * and at most 30 words (#56). A rule in code: a prompt row may make them shorter, never longer.
 */
export const PAUSE_MESSAGE_LIMITS = { max_sentences: 2, max_words: 30 } as const;

function capLimits(limits: LineLimits, cap: { max_sentences: number; max_words: number }) {
  return {
    ...limits,
    max_words: Math.min(limits.max_words, cap.max_words),
    max_sentences: Math.min(limits.max_sentences ?? cap.max_sentences, cap.max_sentences),
  };
}

function limitsFor(kind: CompanionKind, limits: LineLimits): LineLimits {
  if (kind === "return_popup") return capReturnPopup(limits);
  if (kind === "stuck_story" || kind === "pause_message") {
    return capLimits(limits, PAUSE_MESSAGE_LIMITS);
  }
  return limits;
}

export function checkCompanionLine(
  raw: string,
  kind: CompanionKind,
  forbidTerms: string[],
  rowLimits: LineLimits,
  companionName: string,
): { ok: true; text: string } | { ok: false; rejectedRules: string[] } {
  // #468: the name of the Companion speaking is required; a missing one throws, never a default.
  const name = requireCompanionName(companionName, "checkCompanionLine");
  const limits = limitsFor(kind, rowLimits);
  const live = kind === "rest_reply" || kind === "stuck_story" || kind === "pause_message";
  const text = cleanLine(raw, name);
  const ownName = ownNamePattern(name);
  const rejected: string[] = [];
  const sentenceCount = sentences(text);
  const wordCount = words(text);

  push(rejected, "empty", text.length === 0);
  push(rejected, "failure_text", FAILURE_WORDING.test(text));
  push(rejected, "cjk", CJK.test(text));
  push(rejected, "dash", DASH.test(text));
  push(rejected, "ban", BANNED.test(text) || (live && LIVE_AI_WORDS.test(text)));
  push(rejected, "clock", CLOCK.test(text));
  push(rejected, "back", BACKSTAGE.test(text));
  push(rejected, "cmd", kind === "rest_reply" && ORDERING.test(text));
  // One-way lines carry no question and never address the user (CONTENT_MODEL 7.1, R01 and R04).
  // A rest chat reply answers the user, so "you" is allowed and at most one question is allowed
  // (AI_04 section B; AI_06 section 4). Every other rule still applies to the reply.
  push(rejected, "question", questionCount(text) > (kind === "rest_reply" ? 1 : 0));
  push(rejected, "you", kind !== "rest_reply" && ADDRESSED.test(text));
  push(rejected, "hook", HOOK.test(text));
  push(rejected, "praise", PRAISE.test(text));
  // A rest reply may end on its one question (CHAT-QUESTION-END); every other line ends with a full stop.
  const endsWell = text.endsWith(".") || (kind === "rest_reply" && text.endsWith("?"));
  push(rejected, "form", EXCLAIM_OR_EMOJI.test(text) || LINK.test(text) || !endsWell);
  // He never names himself (#302: the name of the Companion speaking, not a fixed one).
  push(rejected, "name", ownName !== null && ownName.test(text));
  // The stuck story of call one is a third-person record (he, him); every other line is his own.
  push(rejected, "first_person", kind !== "stuck_story" && !FIRST_PERSON.test(text));
  push(rejected, "blame", kind === "return_popup" && BLAME.test(text));
  push(rejected, "len", lengthFails(limits, sentenceCount, wordCount));
  push(
    rejected,
    "leak",
    forbidTerms.some((term) => term.length > 0 && text.toLowerCase().includes(term.toLowerCase())),
  );

  if (rejected.length > 0) return { ok: false, rejectedRules: rejected };
  return { ok: true, text };
}

// The seed keeps the values of CARD-LENGTH (2026-11-12): a story card is 1 to 3 sentences and at
// most 45 words; the background card is at most 70 words with no sentence limit.
function lengthFails(limits: LineLimits, sentenceCount: number, wordCount: number): boolean {
  return (
    wordCount > limits.max_words ||
    (limits.max_sentences !== undefined && sentenceCount > limits.max_sentences) ||
    (limits.min_sentences !== undefined && sentenceCount < limits.min_sentences)
  );
}

export function checkPlan(
  value: unknown,
  totalMinutes: number,
  limits: PlanLimits,
): { ok: true; plan: GeneratedPlan } | { ok: false; rejectedRules: string[] } {
  const rejected: string[] = [];
  const record = isRecord(value) ? value : null;
  // The Plan is the person's own Goal in Steps; no Companion speaks it, so it has no name check
  // and no speaker label to drop (`null`, #468).
  const title = typeof record?.title === "string" ? cleanLine(record.title, null) : "";
  const steps = Array.isArray(record?.steps) ? record.steps : null;

  push(rejected, "parse", record === null || steps === null);
  push(
    rejected,
    "empty",
    title.length === 0 || title.length > limits.title_max_chars || steps?.length === 0,
  );
  push(rejected, "failure_text", FAILURE_WORDING.test(title));
  push(rejected, "cjk", CJK.test(title));

  const parsedSteps =
    steps?.map((step) => {
      const item = isRecord(step) ? step : {};
      const stepTitle = typeof item.title === "string" ? cleanLine(item.title, null) : "";
      const description =
        typeof item.description === "string" ? cleanLine(item.description, null) : "";
      const minutes = item.minutes;
      const minutesOk = typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0;
      push(
        rejected,
        "empty",
        stepTitle.length === 0 || stepTitle.length > limits.step_title_max_chars,
      );
      push(
        rejected,
        "empty",
        description.length === 0 || words(description) > limits.description_max_words,
      );
      push(rejected, "minutes", !minutesOk);
      push(rejected, "failure_text", FAILURE_WORDING.test(`${stepTitle} ${description}`));
      push(rejected, "cjk", CJK.test(`${stepTitle} ${description}`));
      return { title: stepTitle, description, minutes: minutesOk ? minutes : 0 };
    }) ?? [];

  const sum = parsedSteps.reduce((total, step) => total + step.minutes, 0);
  push(rejected, "minutes", sum !== totalMinutes);

  if (rejected.length > 0) return { ok: false, rejectedRules: unique(rejected) };
  return {
    ok: true,
    plan: { source: "generated", title, steps: parsedSteps },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
