import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ContentFieldRow } from "@/lib/content-fields/view";
import type { StoryFieldsRow } from "@/lib/content-fields/reader";
import type { StoryListRow } from "@/lib/story-cards/admin";
import { lifePath } from "@/lib/story-cards/life-path";

// #443: the Stories page (ADM-06) as the prototype's Life path table: the Companion's stories
// grouped by Life Path period, each with its Life path description and the state of that text.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const story = (id: string, sequence: number, period: string, pathText = ""): StoryFieldsRow => ({
  id,
  companion_id: "oppenheimer",
  sequence,
  title: `Title ${id}`,
  period,
  goal_short: "",
  who: "",
  opening: "",
  path: pathText,
});

const counts = (id: string, sequence: number, failing = 0): StoryListRow => ({
  id,
  key: `opp.${id}`,
  title: `Title ${id}`,
  sequence,
  parts: 4,
  cards: 9,
  background: true,
  failing,
});

const field = (
  key: string,
  version: number,
  published: boolean,
  published_at: string | null = published ? "2026-11-20T10:00:00Z" : null,
): ContentFieldRow => ({ key, version, body: `${key} v${version}`, published, published_at });

describe("Life path table (#443)", () => {
  it("test_443_stories_are_grouped_by_period_in_story_order_with_the_period_key", () => {
    const periods = lifePath(
      "opp",
      [story("c", 3, "War"), story("a", 1, "Youth"), story("b", 2, "Youth")],
      [counts("a", 1), counts("b", 2), counts("c", 3)],
      [],
    );
    expect(periods.map((period) => [period.number, period.name, period.key])).toEqual([
      [1, "Youth", "chr.opp.period.1"],
      [2, "War", "chr.opp.period.2"],
    ]);
    expect(periods[0].stories.map((row) => [row.sequence, row.id, row.key])).toEqual([
      [1, "a", "opp.a"],
      [2, "b", "opp.b"],
    ]);
  });

  it("test_443_the_state_is_the_state_of_the_life_path_description", () => {
    const periods = lifePath(
      "opp",
      [
        story("empty", 1, "P"),
        story("drafted", 2, "P"),
        story("published", 3, "P", "I go to look at the canyon."),
        story("newer", 4, "P", "I go to look at the mesa."),
      ],
      [],
      [
        field("opp.drafted.path", 1, false),
        field("opp.published.path", 1, true),
        field("opp.newer.path", 1, true),
        field("opp.newer.path", 2, false),
      ],
    );
    const rows = periods[0].stories.map((row) => [row.id, row.description, row.state]);
    expect(rows).toEqual([
      ["empty", { text: null, note: "Not written yet" }, { pill: "draft", label: "Not written" }],
      [
        "drafted",
        { text: null, note: "Nothing published yet" },
        { pill: "draft", label: "Draft v1" },
      ],
      [
        "published",
        { text: "I go to look at the canyon.", note: null },
        { pill: "published", label: "Published" },
      ],
      [
        "newer",
        { text: "I go to look at the mesa.", note: null },
        { pill: "draft", label: "Newer draft v2" },
      ],
    ]);
  });

  it("test_443_a_rolled_back_version_is_not_counted_as_a_draft", () => {
    // v2 was published once and then rolled back to v1: it is an earlier version, not a draft.
    const periods = lifePath(
      "opp",
      [story("s", 1, "P", "Back to the first text.")],
      [],
      [field("opp.s.path", 1, true), field("opp.s.path", 2, false, "2026-11-21T10:00:00Z")],
    );
    expect(periods[0].stories[0].state).toEqual({ pill: "published", label: "Published" });
  });

  it("test_443_parts_and_cards_counts_stay_with_each_story_and_say_what_they_count", () => {
    const periods = lifePath(
      "opp",
      [story("a", 1, "P"), story("b", 2, "P"), story("c", 3, "P")],
      [counts("a", 1), { ...counts("b", 2, 1), parts: 1, cards: 1, background: false }],
      [],
    );
    const [a, b, c] = periods[0].stories;
    expect(a.counts).toEqual({
      parts: "4 parts",
      cards: "9 part cards and a background card",
      failing: null,
    });
    expect(b.counts).toEqual({
      parts: "1 part",
      cards: "1 part card, no background card",
      failing: "1 card fails a check",
    });
    // Cards that could not be read: no counts, rather than a wrong zero.
    expect(c.counts).toBeNull();
  });

  it("test_443_the_page_is_the_prototype_table_with_no_dead_buttons", () => {
    const page = read("src/app/admin/stories/page.tsx");
    const headers = [...page.matchAll(/<th[^>]*scope="col"[^>]*>\s*([^<]*?)\s*<\/th>/g)].map(
      (match) => match[1],
    );
    expect(headers).toEqual(["#", "Story", "Life path description", "Description state"]);
    expect(page).toContain("<PageHead");
    expect(page).toContain('className="admin-panel admin-scroll"');
    expect(page).toContain("admin-period-row");
    expect(page).toContain("<StatePill");
    // Reorder and Add story have no write path yet: owner decisions, never dead buttons.
    expect(page).not.toMatch(/Reorder|Add story/);
    expect(page).not.toContain("<button");
  });
});
