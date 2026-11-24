import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, PREFS_KEY } from "@/lib/me/prefs";
import { timeUpHaptic } from "@/lib/me/time-up-haptic";

// #115 (US-PLAT-3): one light haptic at 00:00 where the device supports it, and only while the
// time-up signal is on.

function storageWith(value: unknown): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: (key) => (key === PREFS_KEY ? JSON.stringify(value) : null),
    setItem: () => {},
  };
}

describe("#115 time-up haptic", () => {
  it("AC1 vibrates once, lightly, when the signal is on (the default) and the device supports it", () => {
    const vibrate = vi.fn(() => true);
    expect(timeUpHaptic({ vibrate }, null)).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("AC1 reads the stored setting when it is on", () => {
    const vibrate = vi.fn(() => true);
    expect(timeUpHaptic({ vibrate }, storageWith(DEFAULT_PREFS))).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("AC2 does nothing and does not throw when the device has no haptics", () => {
    expect(timeUpHaptic({}, null)).toBe(false);
    expect(timeUpHaptic(undefined, null)).toBe(false);
  });

  it("AC2 swallows an error from the browser", () => {
    const vibrate = vi.fn(() => {
      throw new Error("blocked");
    });
    expect(() => timeUpHaptic({ vibrate }, null)).not.toThrow();
    expect(timeUpHaptic({ vibrate }, null)).toBe(false);
  });

  it("AC3 never vibrates when the time-up signal is off", () => {
    const vibrate = vi.fn(() => true);
    const off = { ...DEFAULT_PREFS, signals: { ...DEFAULT_PREFS.signals, timeUp: false } };
    expect(timeUpHaptic({ vibrate }, storageWith(off))).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
