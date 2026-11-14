/**
 * His lines in the goal dialogue on the test path /try (FLOW 4.3, issues #30, #33, #34, #35, #36).
 *
 * draft prototype lines, not read by Yue (READ-STATUS: written).
 *
 * FLOW 4.3 says his dialogue lines come from small authored pools. Decision NO-BACKUP ("no stored
 * or pre-written text is ever shown") may also cover these lines; that is an open question for the
 * product owner. Situation: chapter 8, "site search" (a canyon at Jemez Springs, 1942-11-16, with
 * Major Dudley and Edwin McMillan). No line may name a later fact or a number of Steps.
 */
export const READ_STATUS = "written" as const;

export const FIRST_OPENING =
  "Dudley has brought us to a canyon at Jemez Springs, and McMillan is already frowning at the walls. I have the afternoon to look before I say anything. What are you working on?";

/** For a returning visit: one sentence that is only the question. */
export const RETURNING_OPENINGS = [
  "What are you working on?",
  "What is the work in front of you?",
  "What will you take on as I walk this canyon?",
  "What are you setting out to do?",
  "What is on your table?",
  "What would you like to get done?",
] as const;

export type GoalShape = "specific" | "vague" | "big";

/** One sentence about the shape of the Goal; never a question, a method or encouragement. */
export const REACTIONS: Record<GoalShape, readonly string[]> = {
  // The first line is the prototype v4's (#235).
  specific: ["That has a clear edge to it.", "That is a shape I can hold in my head."],
  vague: ["That is still as open as this canyon floor.", "The edges of that are still soft to me."],
  big: [
    "That is a whole country, not a single site.",
    "That is more ground than one ride can cover.",
  ],
};

export const TIME_QUESTION = "How long do you have?";

/** His reaction and the time question share one slip, as in prototype v4 (#235). */
export function timeQuestionSlip(reaction: string): string {
  return `${reaction} ${TIME_QUESTION}`;
}

// The lines below are prototype v4's wording (#235, #236, #237). There is no acknowledgement line
// after a time answer any more: the prototype goes straight to the split question.
export const NOT_SURE_LINE = "Then thirty minutes. Long enough to start, short enough to keep.";

export const SPLIT_QUESTION = "Do you want it cut fine, or kept in a few broad pieces?";

export const PLAN_INTRO =
  "Here is how I would cut it. Argue with it now, in ink, where it’s cheap.";

/** The split-failed screen (GD-F). */
export const SPLIT_FAILED_TITLE = "That one wouldn’t split.";

export function splitFailedLine(goal: string): string {
  return `Nothing is lost. Your words are kept: “${goal}”.`;
}

export const SPLITTING_LINES = [
  "I am writing it out on the back of Dudley's map.",
  "McMillan lends me a pencil.",
] as const;

type Random = () => number;

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/** Index into RETURNING_OPENINGS that is never the previous one. */
export function pickReturningOpening(previous: number | null, random: Random = Math.random) {
  const count = RETURNING_OPENINGS.length;
  if (previous === null || previous < 0 || previous >= count) {
    return Math.min(count - 1, Math.floor(random() * count));
  }
  const offset = 1 + Math.min(count - 2, Math.floor(random() * (count - 1)));
  return (previous + offset) % count;
}

const BIG_WORDS =
  /\b(learn|master|understand|whole|entire|all of|everything|study for (?:the|my) exams?)\b/i;
const VAGUE_WORDS = /\b(stuff|things|something|work|whatever|some)\b/i;

/**
 * Prototype stand-in for the shape classifier (FLOW 4.3 says the model classifies the shape; the
 * gateway has no such call yet). Deterministic and local: the goal text is not sent anywhere.
 */
export function classifyGoalShape(goal: string): GoalShape {
  const text = goal.trim();
  if (BIG_WORDS.test(text)) return "big";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || (wordCount <= 3 && VAGUE_WORDS.test(text))) return "vague";
  return "specific";
}

export function reactionFor(shape: GoalShape, random: Random = Math.random): string {
  return pick(REACTIONS[shape], random);
}

export function splittingLine(random: Random = Math.random): string {
  return pick(SPLITTING_LINES, random);
}
