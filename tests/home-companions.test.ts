import { existsSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { companionById as byId } from "@/lib/content/companions";
import { seedContent } from "./support/seed-content";

// The story content as the app reads it (#284), from the seed files.
const seed = seedContent();
const COMPANIONS = seed.companions;
const companionById = (id: string) => byId(COMPANIONS, id);

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
const { CompanionsList, enterFor, reasonFor } = await import("@/app/companions/companions-list");

// #268 (#93): the Companions list. Release 1 shows Oppenheimer and Moriarty only
// (OTHER-COMPANIONS, Yue's option B on 2026-11-14).

const root = path.resolve(import.meta.dirname, "..");

describe("#268 AC7 companion data", () => {
  it("companions list holds Oppenheimer, Moriarty and Snape, and only Oppenheimer can be entered", () => {
    // #502: Snape is added like Moriarty, with no Enter (enterHref null) until the owner says so.
    expect(COMPANIONS.map((companion) => companion.id)).toEqual([
      "oppenheimer",
      "moriarty",
      "snape",
    ]);
    const [opp, mor, snp] = COMPANIONS;
    expect(snp.name).toBe("Severus Snape");
    expect(snp.portrait).toBe("/companions/snape.png");
    expect(snp.enterHref).toBeNull();
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

describe("#268 AC7 the Companions list (COMP)", () => {
  it("Companions shows one radio per companion and Enter starts disabled", () => {
    const html = renderToStaticMarkup(createElement(CompanionsList, { companions: COMPANIONS }));
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toContain("J. Robert Oppenheimer");
    expect(html).toContain("Brilliant · Eloquent · Haunted");
    expect(html).toContain("Professor Moriarty");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Enter<\/button>/);
    expect(html).not.toMatch(/last observed/i);
  });

  it("Enter on Oppenheimer opens his Life Path", () => {
    expect(enterFor(seed.companions, "oppenheimer")).toBe("/companions/oppenheimer");
    expect(enterFor(seed.companions, null)).toBeNull();
    expect(reasonFor(seed.companions, "oppenheimer")).toBeNull();
  });

  it("Moriarty keeps Enter disabled with a visible reason", () => {
    expect(enterFor(seed.companions, "moriarty")).toBeNull();
    expect(reasonFor(seed.companions, "moriarty")).toBe("His stories are not ready yet.");
  });
});
