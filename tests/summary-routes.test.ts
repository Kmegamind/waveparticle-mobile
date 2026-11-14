import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accountPathsFor, ACCOUNT_PATHS } from "@/app/_session/paths";
import { showsHeader, showsTabBar } from "@/app/shell-rules";
import { isSessionPath } from "@/app/try/session-paths";
import { accountSessionPathIsHidden } from "@/lib/prototype/config";

// Issue #258: where the summary and the Life Path live, on top of the signed-in focus page (#257).

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const SESSION = "4f0a7c2e-8d1b-4c3a-9e2f-1a2b3c4d5e6f";

describe("#258 AC1 the summary is a signed-in session page in test builds", () => {
  it("uses the Oppenheimer skin, with no tab bar and no header", () => {
    expect(isSessionPath("/end")).toBe(true);
    expect(showsTabBar("/end")).toBe(false);
    expect(showsHeader("/end")).toBe(false);
  });

  it("is hidden while the test path is off, like /focus", () => {
    expect(accountSessionPathIsHidden("/end", false)).toBe(true);
    expect(accountSessionPathIsHidden("/end", true)).toBe(false);
    expect(accountSessionPathIsHidden("/ending", false)).toBe(false);
  });

  it("opens after the last Done of the signed-in focus page, for that session", () => {
    expect(accountPathsFor(SESSION)).toEqual({ ...ACCOUNT_PATHS, end: `/end?session=${SESSION}` });
    expect(read("src/app/focus/account-focus.tsx")).toContain("accountPathsFor(plan.sessionId)");
  });
});

describe("#258 AC10 a signed-in run plays the Life Path's current story", () => {
  it("a new account session takes the current story, not chapter 8", () => {
    const source = read("src/app/focus/account-progress.ts");
    expect(source).toContain("storyForNewSession(progress)");
    expect(source).not.toContain("storyId: DEFAULT_STORY_ID");
  });
});

describe("#258 AC7 AC8 the Life Path", () => {
  it("is a child page of Companions with the tab bar", () => {
    expect(showsTabBar("/companions/oppenheimer")).toBe(true);
    // #268: the Companions list opens it with Enter; the address comes from the companion data.
    expect(read("src/content/companions.ts")).toContain('enterHref: "/companions/oppenheimer"');
  });

  it("Begin opens the goal dialogue", () => {
    expect(read("src/app/companions/oppenheimer/page.tsx")).toMatch(/href="\/goal"[^>]*>\s*Begin/);
  });
});

describe("#258 AC4 no stored line on the new pages", () => {
  it.each([
    "src/app/end/end-screen.tsx",
    "src/app/end/actions.ts",
    "src/app/end/page.tsx",
    "src/app/companions/oppenheimer/page.tsx",
  ])("%s reads no stored card and no fixed story", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/authoredCards|generated\.json|stage0\.json|loadTestStory/);
    expect(source).not.toContain('"site-search"');
  });

  it("the END screen shows the failure message with Retry and no counts", () => {
    const source = read("src/app/end/end-screen.tsx");
    expect(source).toContain("He is not here right now. Please try again.");
    expect(source).toContain("Retry");
    expect(source).not.toMatch(/%|\bof \$\{/);
  });
});
