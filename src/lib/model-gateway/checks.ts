import type { CompanionKind, PlanSplitResult } from "./types";

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
const OWN_NAME = /\b(oppenheimer|robert)\b/i;
const BLAME = /\b(you again|finally came back|welcome back|while you were away)\b/i;
const FIRST_PERSON = /(^|[^\p{L}])I\b|\b(my|me|mine)\b/iu;

export function cleanLine(text: string): string {
  return text
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/^["']|["']$/g, "")
    .replace(/^oppenheimer:\s*/i, "")
    .trim();
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

export function checkCompanionLine(
  raw: string,
  kind: CompanionKind,
  forbidTerms: string[] = [],
): { ok: true; text: string } | { ok: false; rejectedRules: string[] } {
  const text = cleanLine(raw);
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
  push(rejected, "name", OWN_NAME.test(text));
  push(rejected, "first_person", !FIRST_PERSON.test(text));
  push(rejected, "blame", kind === "return_popup" && BLAME.test(text));
  push(rejected, "len", lengthFails(kind, sentenceCount, wordCount));
  push(
    rejected,
    "leak",
    forbidTerms.some((term) => term.length > 0 && text.toLowerCase().includes(term.toLowerCase())),
  );

  if (rejected.length > 0) return { ok: false, rejectedRules: rejected };
  return { ok: true, text };
}

function lengthFails(kind: CompanionKind, sentenceCount: number, wordCount: number): boolean {
  if (kind === "step_card") return sentenceCount > 4 || wordCount > 60;
  if (kind === "stuck_story") return sentenceCount > 2 || wordCount > 20;
  if (kind === "rest_reply") return sentenceCount < 1 || sentenceCount > 3 || wordCount > 80;
  return sentenceCount > 3 || wordCount > 40;
}

export function checkPlan(
  value: unknown,
  totalMinutes: number,
): { ok: true; plan: PlanSplitResult } | { ok: false; rejectedRules: string[] } {
  const rejected: string[] = [];
  const record = isRecord(value) ? value : null;
  const title = typeof record?.title === "string" ? cleanLine(record.title) : "";
  const steps = Array.isArray(record?.steps) ? record.steps : null;

  push(rejected, "parse", record === null || steps === null);
  push(rejected, "empty", title.length === 0 || title.length > 40 || steps?.length === 0);
  push(rejected, "failure_text", FAILURE_WORDING.test(title));
  push(rejected, "cjk", CJK.test(title));

  const parsedSteps =
    steps?.map((step) => {
      const item = isRecord(step) ? step : {};
      const stepTitle = typeof item.title === "string" ? cleanLine(item.title) : "";
      const description = typeof item.description === "string" ? cleanLine(item.description) : "";
      const minutes = item.minutes;
      const minutesOk = typeof minutes === "number" && Number.isInteger(minutes) && minutes > 0;
      push(rejected, "empty", stepTitle.length === 0 || stepTitle.length > 80);
      push(rejected, "empty", description.length === 0 || words(description) > 40);
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
