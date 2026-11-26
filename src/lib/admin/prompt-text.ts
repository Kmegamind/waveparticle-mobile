// #446: what the ADM-08 prompt editor sends on Save draft. Client-safe (no prompt modules), so the
// editor can use it. A text field shows every line end as "\n"; the stored text may hold "\r\n".
// Editing must never change stored text the user did not change, so an untouched field sends the
// stored text itself, and an edited one keeps Windows line ends when the stored text used them
// throughout.

const shown = (text: string) => text.replace(/\r\n?/g, "\n");

/** The text Save draft sends for one field, and whether it differs from the stored text. */
export function savedText(stored: string, typed: string): { text: string; changed: boolean } {
  if (typed === shown(stored)) return { text: stored, changed: false };
  const windowsThroughout = stored.includes("\r\n") && !/\r(?!\n)|(?<!\r)\n/.test(stored);
  return { text: windowsThroughout ? typed.replace(/\n/g, "\r\n") : typed, changed: true };
}

/** "11-25": the month and day of a version's time in UTC, as the prototype's Versions table. */
export function versionDay(time: string): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(5, 10);
}
