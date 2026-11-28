import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, symlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readCardExport } from "../scripts/content/import-drafts.mjs";
import {
  newCardText,
  newPartTitle,
  writeInventedCardExport,
} from "../e2e/support/invented-card-export.mjs";
import { parseStoryDeck, deckVersions } from "@/lib/content/story-deck";
import type { AccountProgress } from "@/lib/progress/account-progress";
import { applyFocusSnapshot, openFocusSession } from "@/lib/progress/focus-session";
import { premadeStepCards } from "@/lib/progress/premade-cards";
import { publishHistoryEntries, type PublishHistoryRow } from "@/lib/publish-history/admin";
import { historyItemName } from "@/lib/admin/history-names";
import { spreadCards } from "@/lib/story/start";
import { lifePath } from "@/lib/summary/life-path";
import { storyRecord } from "@/lib/me/records";
import { seedContent } from "./support/seed-content";

// #516: the regenerated Oppenheimer cards as drafts next to the published placeholders (the
// `--keep-published` mode of scripts/content/import-drafts.mjs), the story switch-over
// (scripts/content/switch-story.mjs), and stories with 3, 4 or 5 parts on the phone. Every card
// text here is short and invented; the database runs are in story-switch-database.test.ts.

const root = path.join(import.meta.dirname, "..");
const importScript = path.join(root, "scripts", "content", "import-drafts.mjs");
const switchScript = path.join(root, "scripts", "content", "switch-story.mjs");
const run = (script: string, ...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });

const STORIES = [
  { id: "bohr-difficulties", cards: [3, 4, 2] },
  { id: "tolman-lecture", cards: [2, 6, 3, 1] },
  { id: "truchas-morning", cards: [2, 2, 3, 2, 4] },
];
const exportFolder = () => writeInventedCardExport({ stories: STORIES });

describe("#516 the --keep-published mode reads a cards-only export", () => {
  it("test_516_ac1_reads_the_companion_and_parts_and_cards_with_empty_merged_titles", () => {
    const rows = readCardExport(exportFolder());
    expect(rows.companion).toEqual({ id: "oppenheimer", key_code: "opp" });
    expect(rows.stories.map((story: { id: string }) => story.id)).toEqual(
      STORIES.map((story) => story.id),
    );
    expect(rows.parts).toHaveLength(STORIES.reduce((sum, story) => sum + story.cards.length, 0));
    expect(rows.cards).toHaveLength(
      STORIES.reduce((sum, story) => sum + 1 + story.cards.reduce((a, b) => a + b, 0), 0),
    );
  });

  it("test_516_ac1_prints_the_four_forms_and_writes_only_story_cards", () => {
    const folder = exportFolder();
    const sql = run(importScript, folder, "--keep-published");
    expect(sql.status).toBe(0);
    expect(sql.stdout).toMatch(/^begin;$/m);
    expect(sql.stdout).toMatch(/^commit;$/m);
    // Nothing published, no Companion, story, part, field or input row written.
    expect(sql.stdout).not.toMatch(/published = true|published\s*=\s*excluded/);
    for (const table of [
      "companions",
      "stories",
      "story_inputs",
      "story_parts",
      "content_fields",
    ]) {
      expect(sql.stdout).not.toMatch(
        new RegExp(`(insert into|update|delete from) public\\.${table}\\b`),
      );
    }
    expect(sql.stdout).toContain(newCardText(STORIES[0].id, 1, 1));
    const dry = run(importScript, folder, "--keep-published", "--dry-run");
    expect(dry.stdout).toMatch(/^rollback;$/m);
    // #522 I2: the SQL editor shows only the last result, so the report stops the script.
    expect(dry.stdout).toContain("raise exception 'Dry run: nothing was changed.%'");
    expect(dry.stdout).not.toMatch(/^commit;$/m);
    expect(dry.stdout).toContain("published rows changed");
    expect(dry.stdout).toContain(newPartTitle(5));
    const check = run(importScript, folder, "--keep-published", "--check");
    expect(check.stdout).not.toMatch(/^(begin|commit);$/m);
    // The check names keys and md5 sums only, never a card text.
    expect(check.stdout).not.toContain(newCardText(STORIES[0].id, 1, 1));
    expect(check.stdout).not.toMatch(/\b(insert|update|delete)\b/i);
    const undo = run(importScript, folder, "--keep-published", "--undo");
    expect(undo.stdout).toMatch(/delete from public\.story_cards/);
    expect(undo.stdout).toMatch(/created_by is null/);
    expect(undo.stdout).not.toContain(newCardText(STORIES[0].id, 1, 1));
  });

  it("test_516_the_default_mode_points_a_cards_only_export_to_keep_published", () => {
    const result = run(importScript, exportFolder());
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--keep-published");
  });

  it("test_516_refuses_a_link_into_the_repository_and_gaps_it_would_invent", () => {
    const base = mkdtempSync(path.join(tmpdir(), "wp-516-link-"));
    const link = path.join(base, "export");
    symlinkSync(path.join(root, "docs"), link);
    const linked = run(importScript, link, "--keep-published");
    expect(linked.status).toBe(1);
    expect(linked.stderr).toMatch(/outside the repository/);
    rmSync(base, { recursive: true, force: true });

    const refused = (change: Parameters<typeof writeInventedCardExport>[0]["change"]) => {
      const result = run(
        importScript,
        writeInventedCardExport({ stories: STORIES, change }),
        "--keep-published",
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      return result.stderr;
    };
    expect(refused((files) => (files["app/parts_and_cards.json"].key_code = "xyz"))).toMatch(
      /keyCode/,
    );
    expect(refused((files) => (files["app/companion.json"].mode = "fictional"))).toMatch(/mode/);
    expect(refused((files) => (files["app/parts_and_cards.json"].stories = []))).toMatch(
      /no stories/,
    );
    expect(
      refused((files) => (files["app/parts_and_cards.json"].stories[0].parts[0].title = " ")),
    ).toMatch(/part 1 has no title/);
    expect(
      refused((files) => (files["app/parts_and_cards.json"].stories[0].merged_titles = "x")),
    ).toMatch(/merged_titles/);
    expect(refused((files) => (files["app/parts_and_cards.json"] = undefined))).toMatch(
      /no app\/parts_and_cards\.json/,
    );
  });
});

describe("#516 the switch-over script", () => {
  it("test_516_ac4_prints_the_switch_dry_run_check_and_undo_for_one_story", () => {
    const folder = exportFolder();
    const story = STORIES[0].id;
    const sql = run(switchScript, folder, story, "--by", "admin@invented.test");
    expect(sql.status).toBe(0);
    expect(sql.stdout).toMatch(/^begin;$/m);
    expect(sql.stdout).toMatch(/^commit;$/m);
    expect(sql.stdout).toContain("'retire'");
    expect(sql.stdout).toContain("private.story_switches");
    // The cards are named by key and md5; only the part titles are text.
    expect(sql.stdout).not.toContain(newCardText(story, 1, 1));
    expect(sql.stdout).toContain(newPartTitle(3));
    const dry = run(switchScript, folder, story, "--by", "admin@invented.test", "--dry-run");
    expect(dry.stdout).toMatch(/^rollback;$/m);
    expect(dry.stdout).toContain("raise exception 'Dry run: nothing was changed.%'");
    expect(dry.stdout).not.toMatch(/^commit;$/m);
    const undo = run(switchScript, folder, story, "--by", "admin@invented.test", "--undo");
    expect(undo.stdout).toContain("'roll_back'");
    const check = run(switchScript, folder, story, "--check");
    expect(check.status).toBe(0);
    expect(check.stdout).not.toMatch(/\b(insert|update|delete)\b/i);
  });

  it("test_516_ac4_needs_the_acting_admin_and_a_story_of_the_export", () => {
    const folder = exportFolder();
    expect(run(switchScript, folder, STORIES[0].id).status).toBe(2);
    const unknown = run(switchScript, folder, "inv-not-in-export", "--by", "a@invented.test");
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toMatch(/not in the export/);
    const badEmail = run(switchScript, folder, STORIES[0].id, "--by", "not an email");
    expect(badEmail.status).toBe(1);
  });
});

describe("#516 the Publish history shows a retired card and a switch-over", () => {
  const row = (fields: Partial<PublishHistoryRow>): PublishHistoryRow => ({
    id: 1,
    kind: "story_card",
    item_key: "crd.opp.bohr-difficulties.p4.c1",
    version: 1,
    action: "retire",
    acted_by: null,
    acted_by_email: "admin@invented.test",
    acted_at: "2026-11-27T10:00:00Z",
    is_current: false,
    ...fields,
  });

  it("test_516_ac4_a_retired_card_says_retired_and_offers_no_roll_back", () => {
    const [entry] = publishHistoryEntries([row({})], "admin");
    expect(entry.actionLabel).toBe("Retired");
    expect(entry.canRollBack).toBe(false);
  });

  it("test_516_ac4_a_switch_over_row_is_named_and_offers_no_roll_back", () => {
    const [entry] = publishHistoryEntries(
      [row({ kind: "story_switch", item_key: "bohr-difficulties", action: "publish" })],
      "admin",
    );
    expect(entry.kindLabel).toBe("Story switch-over");
    expect(entry.canRollBack).toBe(false);
    const name = historyItemName("story_switch", "bohr-difficulties", {
      companions: [],
      stories: [{ id: "bohr-difficulties", companion_id: "oppenheimer", title: "Invented title" }],
      promptPurpose: {},
    });
    expect(name).toBe("Invented title · switch-over to the new cards");
  });
});

// ---- AC5: stories with 3, 4 and 5 parts and empty merged titles ---------------------------------

/** A get_story_cards answer for an invented deck: cards per part. */
function deckDocument(story: string, cards: number[]) {
  return {
    cards: [
      {
        key: `crd.opp.${story}.bg`,
        version: 1,
        kind: "background",
        part: null,
        position: 1,
        body: newCardText(story, null, 1),
      },
      ...cards.flatMap((count, at) =>
        Array.from({ length: count }, (_, index) => ({
          key: `crd.opp.${story}.p${at + 1}.c${index + 1}`,
          version: 1,
          kind: "part",
          part: at + 1,
          position: index + 1,
          body: newCardText(story, at + 1, index + 1),
        })),
      ),
    ],
  };
}

const PART_DECKS: [string, number[]][] = [
  ["3 parts", [9, 12, 10]],
  ["4 parts", [8, 9, 7, 10]],
  ["5 parts", [6, 10, 8, 9, 7]],
];

describe.each(PART_DECKS)("#516 AC5 a story with %s in a session", (_, cards) => {
  const story = "site-search";
  const deck = parseStoryDeck(deckDocument(story, cards))!;
  const total = cards.reduce((a, b) => a + b, 0);

  it("test_516_ac5_the_session_spreads_every_card_once_in_story_order", () => {
    expect(deck.parts.map((part) => part.length)).toEqual(cards);
    for (let steps = 1; steps <= total + 2; steps += 1) {
      const spread = spreadCards(deck, steps);
      expect(spread).toHaveLength(steps);
      expect(spread[0].opening.key).toBe(`crd.opp.${story}.bg`);
      const shown = spread.flatMap((step, index) => [
        ...(index === 0 ? [] : steps > total && index >= total ? [] : [step.opening]),
        ...step.story,
      ]);
      expect(shown.map((card) => card.key)).toEqual(deck.parts.flat().map((card) => card.key));
      if (steps <= cards.length) {
        // Whole parts stay together: no part is split over two Steps.
        const stepOf = new Map<string, number>();
        spread.forEach((step, index) =>
          [...(index === 0 ? [] : [step.opening]), ...step.story].forEach((card) =>
            stepOf.set(card.key, index),
          ),
        );
        for (const part of deck.parts) {
          expect(new Set(part.map((card) => stepOf.get(card.key))).size).toBe(1);
        }
      }
    }
  });

  it("test_516_ac5_the_focus_page_reads_its_cards_for_every_step", async () => {
    for (const stepCount of [1, cards.length, cards.length + 2]) {
      let pinned: Record<string, number> | null = null;
      const deps = {
        readSession: async () => ({ storyId: story, stepCount, cardVersions: pinned }),
        pinVersions: async (_: string, versions: Record<string, number>) => {
          pinned ??= versions;
        },
        readDeck: async () => deck,
        mayPlay: async () => true,
      };
      for (let index = 0; index < stepCount; index += 1) {
        const answer = await premadeStepCards(
          { sessionId: "00000000-0000-4000-8000-000000000516", index },
          deps,
        );
        expect(answer.status).toBe("ok");
      }
      expect(pinned).toEqual(deckVersions(deck));
    }
  });

  it("test_516_ac5_a_one_step_plan_records_every_card_and_the_life_path_finishes_the_story", () => {
    const content = seedContent();
    const progress: AccountProgress = {
      userId: "user-1",
      goals: [
        {
          id: "goal-1",
          title: "Write the report",
          text: "Write the report",
          status: "in_progress",
          kind: "one_time",
          steps: [{ id: "step-a", position: 0, title: "Outline", description: null, minutes: 25 }],
        },
      ],
      sessions: [],
    } as unknown as AccountProgress;
    let n = 0;
    const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const opened = openFocusSession(progress, "goal-1", {
      storyId: story,
      now: "2026-11-27T10:00:00Z",
      newId,
    })!;
    const session = opened.writes.at(-1)!;
    const [step] = spreadCards(deck, 1);
    const lines = [step.opening, ...step.story].map((card, seq) => ({
      step: 0,
      kind: seq === 0 ? ("background" as const) : ("story_card" as const),
      seq,
      text: card.text,
      pauseNumber: null,
    }));
    const result = applyFocusSnapshot(
      { ...progress, sessions: [session] },
      { sessionId: session.id, current: 1, opened: [true], lines },
      { now: "2026-11-27T10:30:00Z", newId, userId: "user-1" },
    )!;
    // Every card he showed is kept, however many a Step holds.
    expect(result.session.lines.map((line) => line.text)).toEqual(lines.map((line) => line.text));
    const after = {
      ...progress,
      goals: [result.goal],
      sessions: [{ ...result.session, closingLine: "Invented closing line." }],
    } as AccountProgress;
    const row = lifePath(content, after)
      .periods.flatMap((period) => period.rows)
      .find((entry) => entry.id === story)!;
    expect(row.state).toBe("finished");
    const record = JSON.stringify(storyRecord(content, after, session.id));
    expect(record).toContain(newCardText(story, cards.length, cards.at(-1)!));
  });
});

describe("#516 AC5 the plan page and the Life Path never read parts or merged titles", () => {
  it("test_516_ac5_the_goal_and_life_path_code_reads_no_part_titles_or_merged_titles", () => {
    const files = (folder: string): string[] =>
      readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(folder, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [path.join(folder, entry.name)]
            : [],
      );
    const screens = [
      ...files("src/app/goal"),
      ...files("src/app/try/goal"),
      ...files("src/lib/goals"),
      ...files("src/app/companions"),
      "src/lib/summary/life-path.ts",
    ];
    for (const file of screens) {
      const text = readFileSync(path.join(root, file), "utf8");
      expect(text, file).not.toMatch(/story_parts|merged_titles|mergedTitles|story_cards/);
    }
  });
});
