/**
 * Time parsing for the goal dialogue (FLOW 4.3 GD2, issue #35, decision GOAL-TIME).
 * A typed time is 5 to 300 minutes, rounded to the nearest 15 (never below 15). A time read from the
 * goal text is not rounded (NO-ROUNDING).
 */
export const TIME_HINT = "Type a time like 45 or 1.5 hours";
export const MIN_TYPED_MINUTES = 5;
export const MAX_TYPED_MINUTES = 300;

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

function roundToQuarterHour(minutes: number): number | null {
  if (!Number.isFinite(minutes)) return null;
  if (minutes < MIN_TYPED_MINUTES || minutes > MAX_TYPED_MINUTES) return null;
  return Math.max(15, Math.round(minutes / 15) * 15);
}

function toMinutes(amount: number, unit: string | undefined): number {
  return unit && /^h/.test(unit) ? amount * 60 : amount;
}

/** Reads a typed answer to "how long". Returns minutes, or null when it is not a time. */
export function parseTypedTime(text: string): number | null {
  const match = text
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)?$/);
  if (!match) return null;
  return roundToQuarterHour(toMinutes(Number(match[1]), match[2]));
}

const AMOUNT = "(\\d+(?:\\.\\d+)?|an?|one|two|three|four|five)";
const UNIT = "(minutes?|mins?|hours?|hrs?|h)";
// "for an hour", "in 45 minutes": the user's own work time.
const SESSION_LEAD = /\b(?:for|in|within|spend|spending|about|around|next|over)\s+$/;
// A duration followed by one of these still says how long the user works ("2 hours of revision").
const SESSION_TAIL =
  /^(?:of|on|today|tonight|to|and|then|or|max|total|straight|daily|each|every|per|before|after|please)\b/;

type TimeHit = { minutes: number; start: number; end: number };

/** Whole minutes as written, from 1 to 300 (NO-ROUNDING); anything else is no time. */
function wholeMinutes(minutes: number): number | null {
  if (!Number.isFinite(minutes)) return null;
  const whole = Math.round(minutes);
  return whole < 1 || whole > MAX_TYPED_MINUTES ? null : whole;
}

/**
 * Finds the user's work time in the goal text. A duration that describes the thing ("a 2 hour
 * lecture", "a 90-minute video") is not the user's time and is skipped (US-GD-11 AC2).
 */
function locateTime(goal: string): TimeHit | null {
  const text = goal.toLowerCase();
  const half = text.match(/\bhalf an hour\b/);
  const candidates: { minutes: number; start: number; end: number; hyphen: boolean }[] = [];
  if (half?.index !== undefined) {
    candidates.push({
      minutes: 30,
      start: half.index,
      end: half.index + half[0].length,
      hyphen: false,
    });
  }
  // "an hour and a half" and "one and a half hours" add half a unit (#416, NF7 v7 section 3.1).
  const pattern = new RegExp(
    `\\b${AMOUNT}(\\s+and\\s+a\\s+half)?(\\s*|-)${UNIT}(\\s+and\\s+a\\s+half)?\\b`,
    "g",
  );
  for (const match of text.matchAll(pattern)) {
    const half = match[2] !== undefined || match[5] !== undefined ? 0.5 : 0;
    const amount = (WORD_NUMBERS[match[1]] ?? Number(match[1])) + half;
    const minutes = wholeMinutes(toMinutes(amount, match[4]));
    if (minutes === null) continue;
    const start = match.index;
    candidates.push({ minutes, start, end: start + match[0].length, hyphen: match[3] === "-" });
  }
  candidates.sort((x, y) => x.start - y.start);
  for (const hit of candidates) {
    const led = SESSION_LEAD.test(text.slice(0, hit.start));
    const rest = text.slice(hit.end).replace(/^\s+/, "");
    const closed = rest.length === 0 || /^[^\p{L}\p{N}]/u.test(rest) || SESSION_TAIL.test(rest);
    if (led || (closed && !hit.hyphen)) return hit;
  }
  return null;
}

/** Finds a stated length inside the goal text ("study chemistry for one hour"), as written. */
export function findTimeInGoal(goal: string): number | null {
  return locateTime(goal)?.minutes ?? null;
}

/** The goal without its time phrase ("study chemistry for one hour" becomes "study chemistry"). */
export function removeTimePhrase(goal: string): string {
  const hit = locateTime(goal);
  if (!hit) return goal;
  let before = goal
    .slice(0, hit.start)
    .replace(/\b(?:for|in|within|spend|spending|about|around|next|over)\s+$/i, "");
  let after = goal.slice(hit.end).replace(/^\s+of\b/i, "");
  before = before.trimEnd();
  after = after.trimStart();
  const joined =
    before && after && !/^[,;:.!?]/.test(after) ? `${before} ${after}` : `${before}${after}`;
  const clean = joined.replace(/\s{2,}/g, " ").replace(/^[\s,;:.-]+|[\s,;:-]+$/g, "");
  return clean.length > 0 ? clean : goal;
}

/** "30 min", "1 hour", "1 hour 30 min", "2 hours". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
  return rest === 0 ? hourText : `${hourText} ${rest} min`;
}

/** Minutes as the goal dialogue shows them after an answer: always "N min" (prototype v4, #236). */
export function minutesLabel(minutes: number): string {
  return `${minutes} min`;
}

/**
 * The time question is a slider from 1 minute to 3 hours, with no 0 and no fixed example times
 * (TIME-SLIDER, SLIDER-RANGE).
 */
export const SLIDER_MIN_MINUTES = 1;
export const SLIDER_MAX_MINUTES = 180;
export const SLIDER_STEP_MINUTES = 1;
/** Where the slider rests when no time is known: the same 30 minutes as "Not sure" and "Just split it". */
export const SLIDER_DEFAULT_MINUTES = 30;

/** Where the slider starts: at the time read from the goal, else 30 minutes; always within 1 to 180. */
export function sliderStart(understood: number | null): number {
  if (understood === null) return SLIDER_DEFAULT_MINUTES;
  return Math.min(Math.max(SLIDER_MIN_MINUTES, understood), SLIDER_MAX_MINUTES);
}

/** The slider's value in words, shown beside it and read aloud. */
export function sliderValueText(minutes: number): string {
  return formatMinutes(minutes);
}

/** A time read from the goal text is held to the most one Goal can hold (#351, SLIDER-RANGE). */
export function capGoalMinutes(minutes: number | null): number | null {
  return minutes === null ? null : Math.min(minutes, SLIDER_MAX_MINUTES);
}

/** True when the goal text states more time than one Goal can hold, so the split was made for 3 hours. */
export function goalTimeWasCapped(goal: string): boolean {
  const found = findTimeInGoal(goal);
  return found !== null && found > SLIDER_MAX_MINUTES;
}

export const CAPPED_TIME_NOTE = "Split for 3 hours, the most one Goal can hold.";
