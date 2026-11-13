/**
 * Time parsing for the goal dialogue (FLOW 4.3 GD2, issue #35, decision GOAL-TIME).
 * A typed time is 5 to 300 minutes, rounded to the nearest 15 (never below 15).
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

/** Finds a stated length inside the goal text ("study chemistry for one hour"). */
export function findTimeInGoal(goal: string): number | null {
  const text = goal.toLowerCase();
  if (/\bhalf an hour\b/.test(text)) return 30;
  const match = text.match(
    /\b(\d+(?:\.\d+)?|an?|one|two|three|four|five)\s*(minutes?|mins?|hours?|hrs?|h)\b/,
  );
  if (!match) return null;
  const amount = WORD_NUMBERS[match[1]] ?? Number(match[1]);
  return roundToQuarterHour(toMinutes(amount, match[2]));
}

/** "30 min", "1 hour", "1 hour 30 min", "2 hours". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
  return rest === 0 ? hourText : `${hourText} ${rest} min`;
}

/** The time question is a slider from 0 to 3 hours with no fixed example times (TIME-SLIDER). */
export const SLIDER_MAX_MINUTES = 180;
export const SLIDER_STEP_MINUTES = 5;
export const SLIDER_ZERO_HINT = "Choose a time above 0";

/** Where the slider starts: at 0, or at the time read from the goal, never past 3 hours. */
export function sliderStart(understood: number | null): number {
  if (understood === null) return 0;
  return Math.min(Math.max(0, understood), SLIDER_MAX_MINUTES);
}

/** The slider's value in words, shown beside it and read aloud. */
export function sliderValueText(minutes: number): string {
  return minutes <= 0 ? "No time chosen" : formatMinutes(minutes);
}
