import { describe, expect, it } from "vitest";
import { APP_TEXT_ENTRIES } from "@/lib/app-text/catalog";

// #9 (US-GM-14): the app's own words never drift into debt, streak or shame language (FLOW rule
// R-N, DESIGN section 9), and never call the user's work a Mission or a Task (X1). The scan runs on
// the code default of every app text key (#288, `src/content/app-text.json`), so CI fails the
// build when one of these words appears, and the failure lists each offending key and text.

const FORBIDDEN: readonly { word: string; pattern: RegExp }[] = [
  { word: "overdue", pattern: /\boverdue\b/i },
  { word: "behind", pattern: /\bbehind\b/i },
  { word: "missed", pattern: /\bmissed\b/i },
  { word: "owe", pattern: /\bowe[sd]?\b/i },
  { word: "catch up", pattern: /\bcatch(?:es|ing)?[\s-]+up\b/i },
  { word: "abandoned", pattern: /\babandoned\b/i },
  { word: "partial", pattern: /\bpartial(?:ly)?\b/i },
  // A streak count ("3-day streak", "streak: 4") or any streak at all.
  { word: "streak", pattern: /\bstreaks?\b/i },
  { word: "Mission", pattern: /\bmissions?\b/i },
  { word: "Task", pattern: /\btasks?\b/i },
];

/** Every forbidden word in the texts, as `key: "text" (word)`; empty when the copy is clean. */
function forbiddenCopy(texts: readonly { key: string; text: string }[]): string[] {
  const found: string[] = [];
  for (const { key, text } of texts) {
    for (const { word, pattern } of FORBIDDEN) {
      if (pattern.test(text)) found.push(`${key}: "${text}" (${word})`);
    }
  }
  return found;
}

describe("copy rules (#9)", () => {
  it("test_9_ac1_ac2_the_scan_lists_each_offending_string", () => {
    const texts = [
      { key: "ui.T.a", text: "This Goal is overdue." },
      { key: "ui.T.b", text: "You are behind. Catch up today." },
      { key: "ui.T.c", text: "You missed a day and owe two Steps." },
      { key: "ui.T.d", text: "Abandoned, partial work. 3-day streak." },
      { key: "ui.T.e", text: "Your Mission has one Task left." },
      { key: "ui.T.f", text: "Pick up where you left off." },
    ];
    expect(forbiddenCopy(texts)).toEqual([
      'ui.T.a: "This Goal is overdue." (overdue)',
      'ui.T.b: "You are behind. Catch up today." (behind)',
      'ui.T.b: "You are behind. Catch up today." (catch up)',
      'ui.T.c: "You missed a day and owe two Steps." (missed)',
      'ui.T.c: "You missed a day and owe two Steps." (owe)',
      'ui.T.d: "Abandoned, partial work. 3-day streak." (abandoned)',
      'ui.T.d: "Abandoned, partial work. 3-day streak." (partial)',
      'ui.T.d: "Abandoned, partial work. 3-day streak." (streak)',
      'ui.T.e: "Your Mission has one Task left." (Mission)',
      'ui.T.e: "Your Mission has one Task left." (Task)',
    ]);
  });

  it("test_9_ac1_whole_words_only", () => {
    // "Owen", "bowed", "submissions" and "multitasking" contain the letters, not the words.
    const texts = [{ key: "ui.T.a", text: "Owen bowed; submissions and multitasking." }];
    expect(forbiddenCopy(texts)).toEqual([]);
  });

  it("test_9_ac1_no_app_text_default_uses_a_forbidden_word", () => {
    expect(APP_TEXT_ENTRIES.length).toBeGreaterThan(0);
    expect(forbiddenCopy(APP_TEXT_ENTRIES)).toEqual([]);
  });
});
