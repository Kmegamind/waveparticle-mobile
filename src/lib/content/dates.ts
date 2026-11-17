// The DATES-ADMIN-ONLY check (#304, #309): a year, a date or an age in a text the user will see.
// Shared by the story card checks and the Companion and story fields. Pure.

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const YEAR = /\b(?:1[5-9]\d\d|20\d\d)s?\b/;
// "May 3", "3 May", "the 4th of July", "3/5" or "3/5/1943". "May" alone is a word, not a date.
const DATE = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS})\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b`,
  "i",
);
const AGE =
  /\b(?:\d{1,3}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)[- ]years?[- ]old\b|\b(?:aged|at the age of)\s+\d{1,3}\b/i;

/** A year, a date or an age in the text (DATES-ADMIN-ONLY). */
export function datesProblems(text: string): string[] {
  const problems: string[] = [];
  const year = text.match(YEAR);
  if (year) problems.push(`Mentions a year ("${year[0]}"). Years and dates stay in the admin.`);
  const date = text.match(DATE);
  if (date) problems.push(`Mentions a date ("${date[0]}"). Years and dates stay in the admin.`);
  const age = text.match(AGE);
  if (age) problems.push(`Mentions an age ("${age[0]}"). Ages stay in the admin.`);
  return problems;
}
