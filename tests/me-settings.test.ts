import { describe, expect, it } from "vitest";
import {
  changePrefs,
  DEFAULT_PREFS,
  PREFS_KEY,
  PREFS_SCRIPT,
  readPrefs,
  themeClass,
  writePrefs,
} from "@/lib/me/prefs";
import { saveDisplayName, setKeepClockRunning, type ProfileWriter } from "@/lib/me/profile";

// #83, #74, #71, #81: settings on the device (appearance, plain text, signals) and on the
// account (display name, keep the clock running).

function memoryStorage(initial: Record<string, string> = {}) {
  const items = { ...initial };
  return {
    items,
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => {
      items[key] = value;
    },
    removeItem: (key: string) => {
      delete items[key];
    },
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("#83 #74 device settings", () => {
  it("defaults: System, plain text off, time-up on, new card and lock screen off", () => {
    expect(DEFAULT_PREFS).toEqual({
      appearance: "system",
      plainText: false,
      signals: { timeUp: true, newCard: false, lockScreen: false },
    });
    expect(readPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
  });

  it("stored choices come back; bad data and blocked storage give the defaults", () => {
    const storage = memoryStorage();
    const chosen = { ...DEFAULT_PREFS, appearance: "night" as const, plainText: true };
    writePrefs(storage, chosen);
    expect(readPrefs(storage)).toEqual(chosen);
    expect(readPrefs(memoryStorage({ "waveparticle.prefs": "{nope" }))).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memoryStorage({ "waveparticle.prefs": '{"appearance":"pink"}' }))).toEqual(
      DEFAULT_PREFS,
    );
    expect(readPrefs(throwing)).toEqual(DEFAULT_PREFS);
    expect(() => writePrefs(throwing, chosen)).not.toThrow();
  });

  it("appearance maps to the theme class; System uses none", () => {
    expect(themeClass("day")).toBe("theme-light");
    expect(themeClass("night")).toBe("theme-dark");
    expect(themeClass("system")).toBeNull();
  });
});

function memoryProfile() {
  const rows: { nickname?: string; keepClockRunning?: boolean }[] = [];
  const writer: ProfileWriter = {
    async upsert(userId, fields) {
      rows.push(fields);
      void userId;
    },
  };
  return { rows, writer };
}

describe("#81 #71 account settings", () => {
  it("saves a trimmed display name of 1 to 60 characters", async () => {
    const { rows, writer } = memoryProfile();
    expect(await saveDisplayName({ name: "  Yue  " }, { userId: "u", writer })).toEqual({
      status: "ok",
      name: "Yue",
    });
    expect(rows).toEqual([{ nickname: "Yue" }]);
    for (const name of ["", "   ", "x".repeat(61), 42]) {
      expect(await saveDisplayName({ name }, { userId: "u", writer })).toEqual({
        status: "invalid",
      });
    }
    expect(await saveDisplayName({ name: "Yue" }, { userId: null, writer })).toEqual({
      status: "failed",
    });
    expect(rows).toHaveLength(1);
  });

  it("keeps the clock setting only as a true or false value", async () => {
    const { rows, writer } = memoryProfile();
    expect(await setKeepClockRunning({ on: true }, { userId: "u", writer })).toEqual({
      status: "ok",
    });
    expect(await setKeepClockRunning({ on: "yes" }, { userId: "u", writer })).toEqual({
      status: "invalid",
    });
    expect(rows).toEqual([{ keepClockRunning: true }]);
  });
});

describe("#83 the layout script applies the stored appearance before paint", () => {
  it("adds the same classes as the control and never throws", () => {
    const run = (stored: string | null) => {
      const classes = new Set<string>();
      const localStorage = { getItem: (key: string) => (key === PREFS_KEY ? stored : null) };
      const document = {
        documentElement: { classList: { add: (name: string) => classes.add(name) } },
      };
      new Function("localStorage", "document", PREFS_SCRIPT)(localStorage, document);
      return [...classes];
    };
    expect(run(JSON.stringify({ ...DEFAULT_PREFS, appearance: "night", plainText: true }))).toEqual(
      ["theme-dark", "plain-text"],
    );
    expect(run(JSON.stringify({ ...DEFAULT_PREFS, appearance: "day" }))).toEqual(["theme-light"]);
    expect(run(null)).toEqual([]);
    expect(run("{broken")).toEqual([]);
  });
});

describe("#81 final review: blocked device storage never throws", () => {
  it("deviceStorage gives null when the browser blocks storage, and prefs fall back", async () => {
    const { deviceStorage } = await import("@/lib/me/prefs");
    const original = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: Object.defineProperty({}, "localStorage", {
        get() {
          throw new Error("SecurityError");
        },
      }),
    });
    try {
      expect(deviceStorage()).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, "window", original);
      else delete (globalThis as { window?: unknown }).window;
    }
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(() => writePrefs(null, DEFAULT_PREFS)).not.toThrow();
  });
});

describe("#490 a setting change starts from the stored settings, not a screen's first copy", () => {
  const plainOn = { ...DEFAULT_PREFS, appearance: "night" as const, plainText: true };
  const togglePlain = (current: typeof DEFAULT_PREFS) => ({
    ...current,
    plainText: !current.plainText,
  });

  it("just after a reload Plain text on turns off, and the other choices stay", () => {
    const storage = memoryStorage();
    writePrefs(storage, plainOn);
    // No change made in this visit yet: the screen may still hold the defaults.
    const next = changePrefs(storage, null, togglePlain);
    expect(next).toEqual({ ...plainOn, plainText: false });
    expect(readPrefs(storage)).toEqual(next);
  });

  it("a signal change right after a reload keeps Plain text and the appearance", () => {
    const storage = memoryStorage();
    writePrefs(storage, plainOn);
    const next = changePrefs(storage, null, (current) => ({
      ...current,
      signals: { ...current.signals, newCard: true },
    }));
    expect(next).toMatchObject({ appearance: "night", plainText: true });
    expect(next.signals.newCard).toBe(true);
  });

  it("two quick changes give the second one's result", () => {
    const storage = memoryStorage();
    const first = changePrefs(storage, null, togglePlain);
    const second = changePrefs(storage, first, togglePlain);
    expect(first.plainText).toBe(true);
    expect(second.plainText).toBe(false);
    expect(readPrefs(storage).plainText).toBe(false);
  });

  it("with blocked storage the visit's last change is the starting point", () => {
    const first = changePrefs(throwing, null, togglePlain);
    expect(first.plainText).toBe(true);
    expect(changePrefs(throwing, first, togglePlain).plainText).toBe(false);
    expect(changePrefs(null, first, togglePlain).plainText).toBe(false);
  });
});
