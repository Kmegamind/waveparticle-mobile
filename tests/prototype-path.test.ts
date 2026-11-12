import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPrototypeEnabled, isTryPath, tryPathIsHidden } from "@/lib/prototype/config";
import {
  STORAGE_KEY,
  emptyPrototypeState,
  loadPrototypeState,
  resetPrototypeState,
  savePrototypeState,
  type PrototypeState,
} from "@/lib/prototype/store";
import { loadTestStory } from "@/lib/prototype/test-story";
import { isPublicPath } from "@/lib/supabase/session";

const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe("#208 AC1 the test path is off unless PROTOTYPE_ENABLED is 1", () => {
  it("is enabled only by the exact value 1", () => {
    expect(isPrototypeEnabled({ PROTOTYPE_ENABLED: "1" })).toBe(true);
    for (const value of [undefined, "", "0", "true", "yes", " 1"]) {
      expect(isPrototypeEnabled({ PROTOTYPE_ENABLED: value })).toBe(false);
    }
  });

  it("hides /try and its children with a 404 when the flag is off, and only them", () => {
    expect(tryPathIsHidden("/try", false)).toBe(true);
    expect(tryPathIsHidden("/try/focus", false)).toBe(true);
    expect(tryPathIsHidden("/try", true)).toBe(false);
    expect(tryPathIsHidden("/tryout", false)).toBe(false);
    expect(tryPathIsHidden("/", false)).toBe(false);
    expect(isTryPath("/trying")).toBe(false);
  });

  it("does not make /try public when the flag is off", () => {
    expect(isPublicPath("/try", false)).toBe(false);
    expect(isPublicPath("/try/goal", false)).toBe(false);
  });
});

describe("#208 AC2 signed-out visitors may open /try only when enabled", () => {
  it("makes /try and its children public when enabled", () => {
    expect(isPublicPath("/try", true)).toBe(true);
    expect(isPublicPath("/try/focus", true)).toBe(true);
  });

  it("keeps the account routes private either way", () => {
    for (const enabled of [true, false]) {
      for (const route of ["/", "/goals", "/companions", "/me", "/tryout", "/trying"]) {
        expect(isPublicPath(route, enabled)).toBe(false);
      }
    }
  });

  it("keeps sign-in and the safety page public as before", () => {
    expect(isPublicPath("/auth/sign-in", false)).toBe(true);
    expect(isPublicPath("/safety", false)).toBe(true);
  });
});

describe("#208 AC4 progress is kept in this browser only", () => {
  const filled: PrototypeState = {
    ...emptyPrototypeState(),
    goal: { text: "Write the report", minutes: 60 },
    steps: [{ title: "Outline", description: "List the sections.", minutes: 20 }],
  };

  it("starts empty", () => {
    expect(loadPrototypeState(memoryStorage())).toEqual(emptyPrototypeState());
  });

  it("survives a save and a reload", () => {
    const storage = memoryStorage();
    savePrototypeState(storage, filled);
    expect(loadPrototypeState(storage)).toEqual(filled);
  });

  it("falls back to empty for broken or old data instead of crashing", () => {
    expect(loadPrototypeState(memoryStorage({ [STORAGE_KEY]: "{not json" }))).toEqual(
      emptyPrototypeState(),
    );
    expect(
      loadPrototypeState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 0 }) })),
    ).toEqual(emptyPrototypeState());
  });

  it("is cleared by reset", () => {
    const storage = memoryStorage();
    savePrototypeState(storage, filled);
    resetPrototypeState(storage);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
    expect(loadPrototypeState(storage)).toEqual(emptyPrototypeState());
  });

  it("still works when the browser refuses storage", () => {
    const broken = {
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
    expect(loadPrototypeState(broken)).toEqual(emptyPrototypeState());
    expect(() => savePrototypeState(broken, filled)).not.toThrow();
    expect(() => resetPrototypeState(broken)).not.toThrow();
  });
});

describe("#208 AC5 chapter 8 test data loads as a typed story", () => {
  const story = loadTestStory();

  it("names the story and marks itself as test data", () => {
    expect(story.id).toBe("site-search");
    expect(story.title).toBe("The Canyon and the Mesa");
    expect(story.isTestData).toBe(true);
  });

  it("has a background card and four Steps with cards", () => {
    expect(story.backgroundCard.length).toBeGreaterThan(0);
    expect(story.steps).toHaveLength(4);
    for (const step of story.steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.cards.length).toBeGreaterThan(0);
      step.cards.forEach((card) => expect(card.length).toBeGreaterThan(0));
    }
  });

  it("does not repeat the background card inside Step 1", () => {
    expect(story.steps[0].cards).not.toContain(story.backgroundCard);
  });

  it("has a pause message, rest replies, a return line and a closing line", () => {
    expect(story.pauseMessage.length).toBeGreaterThan(0);
    expect(story.restReplies.length).toBeGreaterThan(0);
    expect(story.returnLine.length).toBeGreaterThan(0);
    expect(story.closingLine.length).toBeGreaterThan(0);
  });
});

describe("#208 AC6 the decision is recorded", () => {
  it("has a decision record that names the flag, Preview only and the cost risk", () => {
    const file = "docs/decisions/0011-prototype-test-path.md";
    expect(existsSync(path.join(__dirname, "..", file))).toBe(true);
    const text = read(file);
    expect(text).toContain("PROTOTYPE_ENABLED");
    expect(text).toMatch(/Preview only/i);
    expect(text).toMatch(/cost/i);
    expect(text).toContain("#208");
  });
});
