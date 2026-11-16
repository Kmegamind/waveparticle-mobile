import { describe, expect, it } from "vitest";
import { companionById } from "@/lib/content/companions";
import type { StoryContent } from "@/lib/content/types";
import { storyForNewSession } from "@/lib/summary/life-path";
import { seedContent } from "./support/seed-content";

// #284 review: fallbacks that used to be fixed in code must not depend on table order.

describe("story content fallbacks (#284)", () => {
  it("test_284_a_session_without_a_companion_reads_as_oppenheimer_whatever_the_order", () => {
    const reordered = [...seedContent().companions].reverse();
    expect(reordered[0].id).toBe("moriarty");
    expect(companionById(reordered, "").id).toBe("oppenheimer");
    expect(companionById(reordered, "moriarty").id).toBe("moriarty");
  });

  it("test_284_no_session_opens_when_the_run_has_no_stories", () => {
    const empty: StoryContent = { companions: seedContent().companions, stories: [] };
    expect(storyForNewSession(empty, { userId: "u", goals: [], sessions: [] })).toBeNull();
  });
});
