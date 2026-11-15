import entries from "@/content/app-text.json";

// The app's own words (#288, decision APP-TEXT): every key the app reads, with the default written
// in the code. src/content/app-text.json is the one source: the app imports it here and the seed
// script (scripts/app-text/import.mjs) loads the same file into public.app_text as version 1.
// Safe for the browser: no database access here.

export type AppTextEntry = { key: string; text: string; note: string };

export const APP_TEXT_ENTRIES: readonly AppTextEntry[] = entries;

export const APP_TEXT_KEYS = [
  "ui.F3.fail.body",
  "ui.F3.fail.retry",
  "ui.F-RET.fail.body",
  "ui.F-RET.fail.retry",
  "ui.R1.fail.body",
  "ui.R1.fail.retry",
  "ui.END.fail.body",
  "ui.END.fail.retry",
  "ui.R-OFF.body",
  "ui.S1.title",
  "ui.S1.support",
  "ui.S1.back",
  "ui.HOME-0.greeting",
] as const;

export type AppTextKey = (typeof APP_TEXT_KEYS)[number];

/** Every key with the text to show. */
export type AppTexts = Record<AppTextKey, string>;

/** `ui.<screen>.<slot>` (decision NAMING); the screen is a docs/FLOW.md id. The migration checks the same. */
export const APP_TEXT_KEY_PATTERN = /^ui\.[A-Z][A-Z0-9-]*\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export function isAppTextKey(value: unknown): value is AppTextKey {
  return typeof value === "string" && (APP_TEXT_KEYS as readonly string[]).includes(value);
}

/** The FLOW.md screen id of a key: `ui.F3.fail.body` → `F3`. */
export function screenOf(key: string): string {
  return key.split(".")[1] ?? "";
}

function defaults(): AppTexts {
  const found = new Map(APP_TEXT_ENTRIES.map((entry) => [entry.key, entry.text]));
  return Object.fromEntries(
    APP_TEXT_KEYS.map((key) => {
      const text = found.get(key);
      if (!text) throw new Error(`app text ${key} has no default in src/content/app-text.json`);
      return [key, text];
    }),
  ) as AppTexts;
}

/** The text written in the code for every key: shown when the database has no published text. */
export const APP_TEXT_DEFAULTS: AppTexts = Object.freeze(defaults());
