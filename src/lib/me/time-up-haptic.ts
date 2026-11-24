import { readPrefs } from "./prefs";

type Haptics = { vibrate?: (pattern: number) => boolean } | undefined;

/**
 * One light haptic at 00:00 (#115, US-PLAT-3; #25 AC3). It reads the time-up signal from this
 * device's settings at that moment, so a change on the Signals page applies to the next 00:00.
 * Where the device or browser has no haptics, nothing happens and nothing is shown. Returns
 * whether the browser accepted the vibration.
 */
export function timeUpHaptic(
  haptics: Haptics,
  storage: Pick<Storage, "getItem" | "setItem"> | null,
): boolean {
  if (!readPrefs(storage).signals.timeUp) return false;
  try {
    return typeof haptics?.vibrate === "function" ? haptics.vibrate(10) === true : false;
  } catch {
    return false;
  }
}
