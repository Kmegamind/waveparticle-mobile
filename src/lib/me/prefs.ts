/**
 * Settings that belong to this device (#83, #74): appearance, plain text and the signals. Every
 * storage call is guarded: a private window or blocked storage gives the defaults and never throws.
 */
export const PREFS_KEY = "waveparticle.prefs";

export type Appearance = "day" | "night" | "system";

export type Prefs = {
  appearance: Appearance;
  plainText: boolean;
  signals: { timeUp: boolean; newCard: boolean; lockScreen: boolean };
};

export const DEFAULT_PREFS: Prefs = {
  appearance: "system",
  plainText: false,
  signals: { timeUp: true, newCard: false, lockScreen: false },
};

type PrefsStorage = Pick<Storage, "getItem" | "setItem">;

/** This device's storage, or null when the browser blocks it (reading the property can throw). */
export function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const APPEARANCES = new Set<Appearance>(["day", "night", "system"]);

function isPrefs(value: unknown): value is Prefs {
  if (typeof value !== "object" || value === null) return false;
  const prefs = value as Record<string, unknown>;
  const signals = prefs.signals as Record<string, unknown> | undefined;
  return (
    APPEARANCES.has(prefs.appearance as Appearance) &&
    typeof prefs.plainText === "boolean" &&
    typeof signals === "object" &&
    signals !== null &&
    typeof signals.timeUp === "boolean" &&
    typeof signals.newCard === "boolean" &&
    typeof signals.lockScreen === "boolean"
  );
}

export function readPrefs(storage: PrefsStorage | null): Prefs {
  if (!storage) return DEFAULT_PREFS;
  try {
    const raw = storage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    return isPrefs(parsed) ? parsed : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(storage: PrefsStorage | null, prefs: Prefs): void {
  if (!storage) return;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage is unavailable; the choice holds for this visit only.
  }
}

/**
 * Makes one change to this device's settings, stores it and returns the result (#490). The change
 * starts from what is stored, never from a screen's own copy: just after a page loads that copy can
 * still be the defaults (it is read after hydration), so a tap in that moment would undo an earlier
 * choice and announce the wrong state. `held` is this visit's last change, or null before the
 * first; once set it is the starting point, so blocked storage still works for the visit.
 */
export function changePrefs(
  storage: PrefsStorage | null,
  held: Prefs | null,
  change: (current: Prefs) => Prefs,
): Prefs {
  const next = change(held ?? readPrefs(storage));
  writePrefs(storage, next);
  return next;
}

/** The class on <html> for an appearance; System follows the device (no class). */
export function themeClass(appearance: Appearance): "theme-light" | "theme-dark" | null {
  if (appearance === "day") return "theme-light";
  if (appearance === "night") return "theme-dark";
  return null;
}

/** Applies the stored appearance and plain text to <html> (the control and the layout script). */
export function applyPrefs(root: HTMLElement, prefs: Prefs): void {
  root.classList.remove("theme-light", "theme-dark");
  const theme = themeClass(prefs.appearance);
  if (theme) root.classList.add(theme);
  root.classList.toggle("plain-text", prefs.plainText);
}

/**
 * The same as `applyPrefs`, as a script for the root layout so the page paints in the chosen
 * appearance. Kept in step with `applyPrefs` by tests/me-settings.test.ts.
 */
export const PREFS_SCRIPT = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"null");var r=document.documentElement;if(p&&p.appearance==="day")r.classList.add("theme-light");if(p&&p.appearance==="night")r.classList.add("theme-dark");if(p&&p.plainText===true)r.classList.add("plain-text")}catch(e){}`;
