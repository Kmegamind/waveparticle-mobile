import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { accountSessionPathIsHidden } from "@/lib/prototype/config";
import { isSessionPath } from "@/app/try/session-paths";
import { showsHeader, showsTabBar } from "@/app/shell-rules";

// Issue #258: where the summary and the Life Path live.

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const pages = [
  "src/app/end/end-screen.tsx",
  "src/app/end/actions.ts",
  "src/app/companions/oppenheimer/page.tsx",
  "src/app/companions/oppenheimer/begin-button.tsx",
];

describe("#258 AC1 the summary is a session page, signed in, in test builds", () => {
  it("uses the Oppenheimer skin and has no tab bar", () => {
    expect(isSessionPath("/end")).toBe(true);
    expect(showsTabBar("/end")).toBe(false);
    // Prototype v4 END has no app header (the logo never shows inside a session).
    expect(showsHeader("/end")).toBe(false);
  });

  it("is hidden while the test path is off, like /goal", () => {
    expect(accountSessionPathIsHidden("/end", false)).toBe(true);
    expect(accountSessionPathIsHidden("/end", true)).toBe(false);
    expect(accountSessionPathIsHidden("/ending", false)).toBe(false);
  });

  it("sends a signed-in user from the focus page's /try/end to /end", () => {
    expect(read("src/app/try/end/page.tsx")).toMatch(/redirect\("\/end"\)/);
  });
});

describe("#258 AC7 the Life Path is a child page of Companions with the tab bar", () => {
  it("shows the tab bar", () => {
    expect(showsTabBar("/companions/oppenheimer")).toBe(true);
  });

  it("is linked from Companions", () => {
    expect(read("src/app/companions/page.tsx")).toContain('href="/companions/oppenheimer"');
  });
});

describe("#258 AC4 AC11 no stored line and no protected screen", () => {
  it.each(pages)("%s reads no stored card and no fixed story", (file) => {
    expect(existsSync(path.join(root, file)), file).toBe(true);
    const source = read(file);
    expect(source).not.toMatch(/authoredCards|generated\.json|stage0\.json|loadTestStory/);
    expect(source).not.toContain('"site-search"');
  });

  it("the END screen shows the failure message with Retry", () => {
    const source = read("src/app/end/end-screen.tsx");
    expect(source).toContain("He is not here right now. Please try again.");
    expect(source).toContain("Retry");
    expect(source).not.toMatch(/%|\bof \$\{/);
  });

  it("Begin keeps the chosen story for the goal dialogue", () => {
    const source = read("src/app/companions/oppenheimer/begin-button.tsx");
    expect(source).toContain("storyId");
    expect(source).toContain('"/goal"');
  });
});
