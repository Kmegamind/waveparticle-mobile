import { describe, expect, it } from "vitest";

import { seedStoryRecords } from "./support/seed-content";

// The seed file of the story content (#284: loaded into the database by scripts/content/import.mjs).
const oppenheimerStories = seedStoryRecords();

describe("Oppenheimer story database", () => {
  it("loads all 26 stories with the required story fields", () => {
    expect(oppenheimerStories).toHaveLength(26);

    for (const story of oppenheimerStories) {
      expect(story.id).toBeTruthy();
      expect(story.sequence).toBeGreaterThanOrEqual(1);
      expect(story.sequence).toBeLessThanOrEqual(26);
      expect(story.title).toBeTruthy();
      expect(story.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(story.goal).toBeTruthy();
      expect(story.facts.length).toBeGreaterThan(0);
      expect(story.forbiddenTerms.length).toBeGreaterThan(0);
    }
  });

  it("marks two to four key slices for every story, stored unconfirmed (KEY-UNCONFIRMED)", () => {
    for (const story of oppenheimerStories) {
      expect(story.keySlices.length).toBeGreaterThanOrEqual(2);
      expect(story.keySlices.length).toBeLessThanOrEqual(4);

      for (const keySlice of story.keySlices) {
        // KEY-UNCONFIRMED (2026-11-15): the machine-derived key moments wait for review.
        expect(keySlice.confirmed).toBe(false);
        expect(keySlice.factIds.length).toBeGreaterThan(0);
        expect(keySlice.keyLine.split(/\s+/).length).toBeLessThanOrEqual(18);
      }
    }
  });

  it("keeps story sequences unique and ordered", () => {
    expect(oppenheimerStories.map((story) => story.sequence)).toEqual(
      Array.from({ length: 26 }, (_, index) => index + 1),
    );
    expect(new Set(oppenheimerStories.map((story) => story.id)).size).toBe(26);
  });
});
