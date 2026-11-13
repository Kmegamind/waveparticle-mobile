/**
 * Remembers which returning opening was shown last on /try, so the next one differs (#30 AC2).
 * Browser storage only; every call is wrapped like store.ts.
 */
import type { PrototypeStorage } from "./store";

export const LAST_OPENING_KEY = "waveparticle.prototype.lastOpening";

export function loadLastOpening(storage: PrototypeStorage): number | null {
  try {
    const raw = storage.getItem(LAST_OPENING_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLastOpening(storage: PrototypeStorage, index: number): void {
  try {
    storage.setItem(LAST_OPENING_KEY, String(index));
  } catch {
    // Storage is unavailable; the next visit may repeat a line.
  }
}
