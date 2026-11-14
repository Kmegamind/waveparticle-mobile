import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANIONS, companionById } from "@/content/companions";

// #268 (#93): the Companions list. Release 1 shows Oppenheimer and Moriarty only
// (OTHER-COMPANIONS, Yue's option B on 2026-11-14).

const root = path.resolve(import.meta.dirname, "..");

describe("#268 AC7 companion data", () => {
  it("companions list holds Oppenheimer and Moriarty only", () => {
    expect(COMPANIONS.map((companion) => companion.id)).toEqual(["oppenheimer", "moriarty"]);
    const [opp, mor] = COMPANIONS;
    expect(opp.name).toBe("J. Robert Oppenheimer");
    expect(opp.tags).toBe("Brilliant · Eloquent · Haunted");
    expect(opp.enterHref).toBe("/companions/oppenheimer");
    expect(mor.name).toBe("Professor Moriarty");
    expect(mor.tags).toBe("Analytical · Enigmatic · Defiant");
    expect(mor.line).toBe("The only way to defeat the devil is to become one yourself.");
    expect(mor.enterHref).toBeNull();
    for (const companion of COMPANIONS) {
      expect(existsSync(path.join(root, "public", companion.portrait)), companion.id).toBe(true);
      expect(companion.tags.split(" · ")).toHaveLength(3);
    }
  });

  it("an unknown companion id reads as Oppenheimer", () => {
    expect(companionById("moriarty").shortName).toBe("Moriarty");
    expect(companionById("unassigned").id).toBe("oppenheimer");
  });
});
