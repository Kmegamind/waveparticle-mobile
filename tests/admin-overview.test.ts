import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { menuCurrent } from "@/app/admin/menu-current";
import {
  BOARD_STAGES,
  DOT_LEGEND,
  boardRow,
  draftKeys,
  statusBoard,
  type BoardInput,
} from "@/lib/story-cards/status-board";
import type { StoryCardRow, StoryListRow } from "@/lib/story-cards/admin";
import { readAdminCss } from "./support/admin-css";

// #440: the Overview (/admin) is the prototype's Status board (ADM-01), built only from data the
// admin has today. Its look is compared with the prototype in e2e/admin-visual.spec.ts.

const root = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const card = (
  story_id: string,
  key: string,
  version: number,
  published: boolean,
  published_at: string | null = published ? "2026-11-16T00:00:00Z" : null,
): StoryCardRow => ({
  key,
  version,
  story_id,
  kind: "part",
  part: 1,
  slice: null,
  position: 1,
  body: "A card.",
  published,
  published_at,
});

const listRow = (
  id: string,
  sequence: number,
  failing = 0,
  over: Partial<StoryListRow> = {},
): StoryListRow => ({
  id,
  key: `opp.${id}`,
  title: `Story ${sequence}`,
  sequence,
  parts: 1,
  cards: 1,
  background: true,
  failing,
  ...over,
});

const inPart = (row: StoryCardRow, part: number): StoryCardRow => ({ ...row, part });

describe("Status board data (#440)", () => {
  it("test_440_a_draft_is_a_never_published_version_above_the_published_one", () => {
    const rows = [
      card("s", "a", 1, true),
      card("s", "a", 2, false),
      card("s", "b", 1, true),
      // Published before and rolled back past: an earlier version, not a draft.
      card("s", "c", 2, false, "2026-11-15T00:00:00Z"),
      card("s", "c", 1, true),
      // Never published at all: a draft.
      card("s", "d", 1, false),
    ];
    expect([...draftKeys(rows)].sort()).toEqual(["a", "d"]);
  });

  it("test_440_only_stages_with_a_data_source_are_shown", () => {
    expect([...BOARD_STAGES]).toEqual(["Cards made", "Checks", "Published"]);
    expect(DOT_LEGEND.map((item) => item.label)).toEqual([
      "done",
      "checks passed",
      "a check failed",
      "not done yet",
    ]);
  });

  it("test_440_a_story_with_every_card_published_and_passing_is_done", () => {
    const row = boardRow(listRow("s", 1), [card("s", "a", 1, true), card("s", "b", 1, true)]);
    expect(row.dots.map((dot) => dot.state)).toEqual(["done", "passed", "done"]);
    expect(row.dots[0].words).toBe("1 of 1 part has cards, background card made");
    expect(row.dots[2].words).toBe("2 of 2 cards published");
    expect(row.published).toBe(true);
  });

  it("test_440_a_draft_waiting_above_published_cards_keeps_the_story_published", () => {
    // Users see every card; the draft is said in the words and counted with the drafts.
    const row = boardRow(listRow("s", 1, 1), [card("s", "a", 1, true), card("s", "a", 2, false)]);
    expect(row.dots.map((dot) => dot.state)).toEqual(["done", "failed", "done"]);
    expect(row.dots[1].words).toBe("1 card fails a check");
    expect(row.dots[2].words).toBe("1 of 1 card published, 1 draft waiting");
    expect(row.published).toBe(true);
  });

  it("test_440_a_card_never_published_keeps_the_story_unpublished", () => {
    const row = boardRow(listRow("s", 1), [card("s", "a", 1, true), card("s", "b", 1, false)]);
    expect(row.dots[2]).toEqual({
      stage: "Published",
      state: "none",
      words: "1 of 2 cards published, 1 draft waiting",
    });
    expect(row.published).toBe(false);
  });

  it("test_440_cards_made_needs_every_part_and_the_background_card", () => {
    // CARDS-PER-PART and SHARED-STORY: cards for every part, one background card per story.
    const some = boardRow(listRow("s", 1, 0, { parts: 3, background: false }), [
      inPart(card("s", "a", 1, true), 1),
    ]);
    expect(some.dots[0]).toEqual({
      stage: "Cards made",
      state: "none",
      words: "1 of 3 parts have cards, no background card",
    });
    const noBackground = boardRow(listRow("s", 1, 0, { parts: 2, background: false }), [
      inPart(card("s", "a", 1, true), 1),
      inPart(card("s", "b", 1, true), 2),
    ]);
    expect(noBackground.dots[0].state).toBe("none");
    const missingPart = boardRow(listRow("s", 1, 0, { parts: 2 }), [
      inPart(card("s", "a", 1, true), 1),
    ]);
    expect(missingPart.dots[0]).toEqual({
      stage: "Cards made",
      state: "none",
      words: "1 of 2 parts have cards, background card made",
    });
    const all = boardRow(listRow("s", 1, 0, { parts: 2 }), [
      inPart(card("s", "a", 1, true), 1),
      inPart(card("s", "b", 1, true), 2),
    ]);
    expect(all.dots[0].state).toBe("done");
  });

  it("test_440_a_story_without_cards_is_not_started", () => {
    const row = boardRow(listRow("s", 1, 0, { background: false }), []);
    expect(row.dots.map((dot) => dot.state)).toEqual(["none", "none", "none"]);
    expect(row.dots[0].words).toBe("no cards yet");
  });

  const input = (over: Partial<BoardInput> = {}): BoardInput => ({
    companions: [
      {
        id: "oppenheimer",
        name: "J. Robert Oppenheimer",
        short_name: "Oppenheimer",
        key_code: "opp",
        mode: "historical",
      },
      {
        id: "moriarty",
        name: "Professor Moriarty",
        short_name: "Moriarty",
        key_code: "mor",
        mode: "fictional",
      },
    ],
    stories: [
      { id: "one", companion_id: "oppenheimer" },
      { id: "two", companion_id: "oppenheimer" },
    ],
    fields: [
      { key: "chr.mor.who", version: 1, published: false, published_at: null },
      { key: "opp.one.title", version: 1, published: false, published_at: null },
    ],
    cardCompanionId: "oppenheimer",
    storyRows: [listRow("one", 1, 1), listRow("two", 2)],
    cards: [card("one", "crd.opp.one.a", 1, true), card("one", "crd.opp.one.a", 2, false)],
    promptDrafts: 1,
    ...over,
  });

  it("test_440_the_four_tiles_count_companions_stories_drafts_and_published_stories", () => {
    const board = statusBoard(input());
    expect(board.tiles).toEqual([
      { value: 2, label: "Companions (1 shown to users, 1 not ready)" },
      // Story one has its background card and cards for its one part; story two has none.
      { value: 1, label: "stories with all their cards made, of 2" },
      // One card draft, two field drafts, one prompt draft.
      { value: 4, label: "drafts waiting for an admin to publish" },
      // Story one's card is published (a draft waits above it); story two has no cards.
      { value: 1, label: "stories with every card published" },
    ]);
  });

  it("test_440_a_source_that_cannot_be_read_shows_no_number", () => {
    const board = statusBoard(input({ promptDrafts: null, storyRows: null }));
    expect(board.tiles.map((tile) => tile.value)).toEqual([2, null, null, null]);
    expect(board.rows).toEqual([]);
  });

  it("test_440_one_panel_per_companion_from_his_data", () => {
    const board = statusBoard(input());
    expect(board.panels).toEqual([
      {
        id: "oppenheimer",
        name: "Oppenheimer",
        code: "chr.opp",
        note: "Historical · 2 stories · shown to users · 1 card, 1 fail a check · 2 drafts waiting",
      },
      {
        id: "moriarty",
        name: "Moriarty",
        code: "chr.mor",
        note: "Fictional · no stories yet · not ready · 1 draft waiting",
      },
    ]);
    expect(board.boardName).toBe("Oppenheimer");
  });
});

describe("Overview page (#440)", () => {
  const page = read("src/app/admin/page.tsx");

  it("test_440_ac1_the_overview_is_the_status_board", () => {
    expect(page).toContain("<Breadcrumb");
    expect(page).toContain("<PageHead");
    expect(page).toContain('title="Status board"');
    for (const name of [
      "admin-tiles",
      "admin-tile",
      "admin-grid3",
      "admin-board",
      "admin-legend",
      "admin-dot",
    ]) {
      expect(page).toContain(name);
    }
    expect(page).toContain("statusBoard(");
    // Nothing on the page is sample data.
    expect(page).not.toMatch(/sample data/i);
  });

  it("test_440_ac1_the_menu_has_the_status_board_row", () => {
    const shell = read("src/app/admin/admin-shell.tsx");
    expect(shell).toContain('heading: "Overview"');
    expect(shell).toContain('{ href: "/admin", id: "ADM-01", label: "Status board" }');
  });

  it("test_440_ac1_the_status_board_row_is_current_on_the_overview_only", () => {
    expect(menuCurrent("/admin", "/admin")).toBe("page");
    expect(menuCurrent("/admin/prompts", "/admin")).toBeUndefined();
    expect(menuCurrent("/admin/prompts/plan_split", "/admin")).toBeUndefined();
  });

  it("test_440_the_board_parts_use_admin_tokens", () => {
    const css = readAdminCss();
    const block = (selector: string) => {
      const start = css.indexOf(`\n${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf("}", start));
    };
    expect(block(".admin-tile")).toContain("padding: var(--adm-tile-pad)");
    expect(block(".admin-tile-number")).toContain("font-family: var(--adm-font-display)");
    expect(block(".admin-dot")).toContain("width: var(--adm-dot-size)");
    expect(block(".admin-dot-done")).toContain("background: var(--adm-ok)");
    expect(block(".admin-dot-failed")).toContain("background: var(--adm-bad-soft)");
    for (const selector of [".admin-tile", ".admin-dot", ".admin-legend"]) {
      expect(block(selector)).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });
});
