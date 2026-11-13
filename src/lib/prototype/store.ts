/**
 * Browser-only state for the sign-in-free test path (#208). Nothing here reaches the server.
 * Every storage call is wrapped: private windows and blocked storage must not break the page.
 */
export const STORAGE_KEY = "waveparticle.prototype";
const VERSION = 1;

export type PrototypeStep = { title: string; description: string; minutes: number };

export type PrototypeState = {
  version: typeof VERSION;
  goal: { text: string; minutes: number } | null;
  steps: PrototypeStep[];
  currentStep: number;
  /** The chosen Oppenheimer story (#254). Missing: chapter 8, as before. */
  storyId?: string;
};

export type PrototypeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function emptyPrototypeState(): PrototypeState {
  return { version: VERSION, goal: null, steps: [], currentStep: 0 };
}

function isState(value: unknown): value is PrototypeState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === VERSION &&
    Array.isArray(record.steps) &&
    typeof record.currentStep === "number" &&
    (record.goal === null || typeof record.goal === "object")
  );
}

export function loadPrototypeState(storage: PrototypeStorage): PrototypeState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyPrototypeState();
    const parsed: unknown = JSON.parse(raw);
    return isState(parsed) ? parsed : emptyPrototypeState();
  } catch {
    return emptyPrototypeState();
  }
}

export function savePrototypeState(storage: PrototypeStorage, state: PrototypeState): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage is unavailable; the page keeps working for this visit only.
  }
}

export function resetPrototypeState(storage: PrototypeStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
