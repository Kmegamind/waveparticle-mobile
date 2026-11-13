import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { goalPathIsHidden, isGoalPath } from "@/lib/prototype/config";
import { setStepCards, syncSession } from "@/lib/prototype/session";
import { isSessionPath } from "@/app/try/session-paths";

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function filesUnder(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });
}

describe("#32 /goal exists only when the test path is on", () => {
  it("is hidden while PROTOTYPE_ENABLED is off", () => {
    expect(isGoalPath("/goal")).toBe(true);
    expect(isGoalPath("/goal/x")).toBe(true);
    expect(isGoalPath("/goals")).toBe(false);
    expect(goalPathIsHidden("/goal", false)).toBe(true);
    expect(goalPathIsHidden("/goal", true)).toBe(false);
    expect(goalPathIsHidden("/goals", false)).toBe(false);
  });

  it("the proxy answers 404 for a hidden /goal", () => {
    expect(read("src/proxy.ts")).toContain("goalPathIsHidden(");
  });

  it("is a session page, so it uses the Oppenheimer skin", () => {
    expect(isSessionPath("/goal")).toBe(true);
  });
});

describe("#32 AC6 /try never touches the account save", () => {
  it("no file under src/app/try imports the account save path", () => {
    for (const file of filesUnder("src/app/try")) {
      const text = read(file);
      expect(text, file).not.toContain("@/lib/goals");
      expect(text, file).not.toMatch(/app\/goal\/actions|["']\.\.\/\.\.\/goal\//);
    }
  });
});

describe("#32 the account actions", () => {
  it("require the switch and a signed-in user", () => {
    const actions = read("src/app/goal/actions.ts");
    expect(actions).toContain('"use server"');
    expect(actions).toContain("isPrototypeEnabled()");
    expect(actions).toContain("getCurrentUser(");
    expect(actions).toContain("createSupabaseGoalWriter(");
  });

  it("the page passes them to the shared dialogue", () => {
    const page = read("src/app/goal/page.tsx");
    expect(page).toContain("notFound()");
    expect(page).toMatch(/redirect\("\/auth\/sign-in"\)/);
    expect(page).toMatch(/<GoalDialogue[^>]*start={startGoalAction}/);
  });
});

describe("#32 AC1 the clock starts when his first card is shown", () => {
  it("has no clock until the Step's cards arrive", () => {
    const plan = {
      goal: { text: "Write the report", minutes: 30 },
      steps: [{ title: "Draft it", description: "", minutes: 30 }],
    };
    const session = syncSession(null, plan, 1);
    expect(session.current).toBe(0);
    expect(session.steps[0].clock).toBeNull();
    const shown = setStepCards(session, 0, { opening: "He writes.", story: [] }, 1_000);
    expect(shown.steps[0].clock).not.toBeNull();
  });
});
