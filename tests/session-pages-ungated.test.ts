import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as config from "@/lib/prototype/config";
import { isPublicPath } from "@/lib/supabase/session";

// Issue #278: the signed-in session pages exist in every environment; /try stays gated (0011).

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const SESSION_DIRS = ["goal", "focus", "rest", "end"] as const;

describe("#278 AC1 /goal, /focus, /rest and /end exist whatever PROTOTYPE_ENABLED is", () => {
  it("the proxy hides only /try", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain("tryPathIsHidden(");
    expect(proxy).not.toContain("accountSessionPathIsHidden");
  });

  it("the config no longer has a rule that hides the session pages", () => {
    for (const name of [
      "isGoalPath",
      "goalPathIsHidden",
      "isAccountSessionPath",
      "accountSessionPathIsHidden",
    ]) {
      expect(Object.keys(config), name).not.toContain(name);
    }
  });

  it("no session page or server action checks the flag", () => {
    for (const dir of SESSION_DIRS) {
      for (const file of [`src/app/${dir}/page.tsx`, `src/app/${dir}/actions.ts`]) {
        expect(read(file), file).not.toContain("isPrototypeEnabled");
      }
    }
  });

  it("they still require sign-in, with the flag on or off", () => {
    for (const pathname of ["/goal", "/focus", "/rest", "/end", "/focus/x"]) {
      expect(isPublicPath(pathname, false), pathname).toBe(false);
      expect(isPublicPath(pathname, true), pathname).toBe(false);
    }
  });
});

describe("#278 AC3 /try stays gated exactly as today", () => {
  it("is hidden and not public while the flag is off", () => {
    for (const pathname of ["/try", "/try/goal", "/try/focus", "/try/end"]) {
      expect(config.tryPathIsHidden(pathname, false), pathname).toBe(true);
      expect(config.tryPathIsHidden(pathname, true), pathname).toBe(false);
      expect(isPublicPath(pathname, false), pathname).toBe(false);
      expect(isPublicPath(pathname, true), pathname).toBe(true);
    }
  });

  it("never hides neighbouring routes", () => {
    for (const pathname of ["/goals", "/ending", "/focused", "/trying"]) {
      expect(config.tryPathIsHidden(pathname, false), pathname).toBe(false);
    }
  });
});
