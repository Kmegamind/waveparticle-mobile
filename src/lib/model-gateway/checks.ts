import type { CompanionKind, GeneratedPlan } from "./types";

const FAILURE_WORDING = /\b(error|failed|failure|timeout|exception|undefined)\b/i;
const CJK = /[\u3400-\u9fff]/;
const DASH = /—|–|--/;
const BANNED = /\b(bro|vibes|no cap|as an ai)\b/i;
const CLOCK =
  /\b\d{1,2}:\d{2}\b|\b(?:a\.m\.|p\.m\.)\b|\b\d{1,2}\s*(?:am|pm)\b|\bo'clock\b|\bhalf past\b|\b\d+\s+minutes?\b/i;
const BACKSTAGE =
  /\b(segment|slice|director|prompt|texture|storyline|plot beat|steps?|sessions?|timer|app|screen|scene|chapter|tasks?|users?)\b/i;
const ORDERING = /\b(you should|let's|take a break|close your eyes|hang on|it'll pass)\b/i;
const QUESTION = /\?/g;
const ADDRESSED = /\byou\b/i;
const HOOK = /\b(more|later|tomorrow|soon|continue|find out|next)\b(?!\s+to\b)/i;
const PRAISE = /\b(great|well done|proud|streak)\b/i;
const EXCLAIM_OR_EMOJI = /!|\p{Extended_Pictographic}/u;
const LINK = /https?:\/\/|www\./i;
/**
 * The Companion whose name the `name` check uses when a caller gives none. Every server caller
 * passes the story's Companion (#302); this keeps older callers checked as before.
 */
export const DEFAULT_COMPANION_NAME = "J. Robert Oppenheimer";
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

export function cleanLine(text: string, companionName = DEFAULT_COMPANION_NAME): string {
  // A speaker label ("Oppenheimer: ...") is dropped; any word of his name counts as the label.
  const label = ownNamePattern(companionName);
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

export function checkCompanionLine(
  raw: string,
  kind: CompanionKind,
  forbidTerms: string[],
  limits: LineLimits,
  companionName = DEFAULT_COMPANION_NAME,
): { ok: true; text: string } | { ok: false; rejectedRules: string[] } {
  const text = cleanLine(raw, companionName);
  const ownName = ownNamePattern(companionName);
  const rejected: string[] = [];
  const sentenceCount = sentences(text);
  const wordCount = words(text);

  push(rejected, "empty", text.length === 0);
  push(rejected, "failure_text", FAILURE_WORDING.test(text));
  push(rejected, "cjk", CJK.test(text));
  push(rejected, "dash", DASH.test(text));
  push(rejected, "ban", BANNED.test(text));
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
  push(rejected, "first_person", !FIRST_PERSON.test(text));
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
  const title = typeof record?.title === "string" ? cleanLine(record.title) : "";
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
      const stepTitle = typeof item.title === "string" ? cleanLine(item.title) : "";
      const description = typeof item.description === "string" ? cleanLine(item.description) : "";
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
